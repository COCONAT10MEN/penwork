//! Open decks, and the private address their slides load from.
//!
//! Slides run in a sandboxed iframe that loads from this custom scheme, not from `srcdoc`:
//! a srcdoc page inherits the app's security policy (deck scripts wouldn't run), and blob
//! URLs fail inside a sandbox. Each response carries its own policy (docs/ARCHITECTURE-DECKS.md).

use super::format::{read_asset, read_deck, write_deck, DeckContent, DeckError, DeckWrite};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::{AppHandle, Manager, State};

pub const SCHEME: &str = "penwork-deck";

/// `http://<scheme>.localhost` is how WebView2 sees a custom scheme.
const SOURCES: &str = "http://penwork-deck.localhost penwork-deck:";

const ENGINE_CSS: &str = include_str!("../../../src/runtime/engine.css");
const APP_CSS: &str = include_str!("../../../src/runtime/app.css");
const ENGINE_JS: &str = include_str!("../../../src/runtime/engine.js");
/// perfect-freehand, wrapped so a plain script can use it. The page has no module loader.
const FREEHAND_JS: &str = concat!(
    "(function(){var module={exports:{}},exports=module.exports;\n",
    include_str!("../../../node_modules/perfect-freehand/dist/cjs/index.js"),
    "\n;window.__pf=module.exports;})();"
);

struct Session {
    /// The `.pwpptx` assets are read from. None for a deck that exists only in memory so far.
    source: Option<PathBuf>,
    /// Where Save writes. It differs from `source` after recovering unsaved work.
    target: Option<PathBuf>,
    manifest: Value,
    notes: Option<Value>,
    /// Sanitised by the frontend before it reaches this page.
    slides_html: String,
    theme_css: String,
    widgets_js: String,
    lang: String,
    dir: String,
    /// Images pulled out of the slides by the frontend. Checked before `source`.
    assets: HashMap<String, Vec<u8>>,
}

#[derive(Default)]
pub struct Sessions(Mutex<HashMap<String, Session>>);

/// Images of the slides on the app's own clipboard, so they survive the source deck being closed.
#[derive(Default)]
pub struct SlideClipboard(Mutex<Vec<(String, Vec<u8>)>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedDeck {
    token: String,
    path: String,
    /// Changes when the file does, so a cached thumbnail can tell it is out of date.
    stamp: String,
    /// Kept in the app's own folder, so it needs Save as before it has a home of its own.
    draft: bool,
    content: DeckContent,
}

#[derive(Serialize)]
pub struct SavedDeck {
    path: String,
    stamp: String,
}

fn manifest_text(manifest: &Value, key: &str, fallback: &str) -> String {
    let value = manifest.get(key).and_then(|v| v.as_str()).unwrap_or(fallback);
    // These go into an HTML attribute, so only plain language codes are let through.
    if value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        value.to_string()
    } else {
        fallback.to_string()
    }
}

fn file_stamp(path: &Path) -> String {
    let modified = fs::metadata(path).and_then(|m| m.modified()).ok();
    let age = modified.and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok());
    age.map_or_else(String::new, |d| d.as_millis().to_string())
}

fn new_session(source: Option<PathBuf>, manifest: Value, theme_css: String, widgets_js: String) -> Session {
    Session {
        target: source.clone(),
        source,
        notes: None,
        lang: manifest_text(&manifest, "lang", "en"),
        dir: manifest_text(&manifest, "dir", "ltr"),
        manifest,
        slides_html: String::new(),
        theme_css,
        widgets_js,
        assets: HashMap::new(),
    }
}

fn app_folder(app: &AppHandle, name: &str) -> Result<PathBuf, DeckError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DeckError::Damaged(e.to_string()))?
        .join(name);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

async fn read_in_background(file: PathBuf) -> Result<DeckContent, DeckError> {
    tauri::async_runtime::spawn_blocking(move || read_deck(&file))
        .await
        .map_err(|e| DeckError::Damaged(e.to_string()))?
}

fn start_session(
    sessions: &Sessions,
    source: PathBuf,
    target: PathBuf,
    content: &DeckContent,
) -> String {
    let token = uuid::Uuid::new_v4().simple().to_string();
    let mut session = new_session(
        Some(source),
        content.manifest.clone(),
        content.theme_css.clone().unwrap_or_default(),
        content.widgets_js.clone().unwrap_or_default(),
    );
    session.target = Some(target);
    session.notes = content.notes.clone();
    sessions.0.lock().unwrap().insert(token.clone(), session);
    token
}

fn is_draft(app: &AppHandle, file: &Path) -> bool {
    let drafts = app_folder(app, "drafts").ok();
    drafts.is_some_and(|dir| file.parent() == Some(dir.as_path()))
}

#[tauri::command]
pub async fn open_deck(
    path: String,
    app: AppHandle,
    sessions: State<'_, Sessions>,
) -> Result<OpenedDeck, DeckError> {
    let file = PathBuf::from(&path);
    let content = read_in_background(file.clone()).await?;
    let token = start_session(&sessions, file.clone(), file.clone(), &content);
    Ok(OpenedDeck { token, stamp: file_stamp(&file), draft: is_draft(&app, &file), path, content })
}

/// Everything Save needs, copied out so the file can be written without holding up the slide page.
struct Snapshot {
    content: DeckContent,
    source: Option<PathBuf>,
    assets: Vec<(String, Vec<u8>)>,
}

fn snapshot(session: &Session, ink: Option<Value>) -> Snapshot {
    let optional = |text: &str| (!text.is_empty()).then(|| text.to_string());
    Snapshot {
        content: DeckContent {
            manifest: session.manifest.clone(),
            slides_html: session.slides_html.clone(),
            theme_css: optional(&session.theme_css),
            widgets_js: optional(&session.widgets_js),
            notes: session.notes.clone(),
            ink,
        },
        source: session.source.clone(),
        assets: session.assets.iter().map(|(name, bytes)| (name.clone(), bytes.clone())).collect(),
    }
}

async fn write_snapshot(snap: Snapshot, target: PathBuf) -> Result<(), DeckError> {
    tauri::async_runtime::spawn_blocking(move || {
        let assets: Vec<(&str, &[u8])> =
            snap.assets.iter().map(|(name, bytes)| (name.as_str(), bytes.as_slice())).collect();
        let write = DeckWrite {
            content: &snap.content,
            source: snap.source.as_deref(),
            assets: &assets,
        };
        write_deck(&target, &write)
    })
    .await
    .map_err(|e| DeckError::Damaged(e.to_string()))?
}

/// Save, or Save as when there's a `path`. This is the only way a user's `.pwpptx` is ever written.
#[tauri::command]
pub async fn save_deck(
    token: String,
    path: Option<String>,
    manifest: Value,
    ink: Option<Value>,
    sessions: State<'_, Sessions>,
) -> Result<SavedDeck, DeckError> {
    let (snap, target) = {
        let mut guard = sessions.0.lock().unwrap();
        let session = guard
            .get_mut(&token)
            .ok_or_else(|| DeckError::Damaged("this presentation is no longer open".into()))?;
        session.manifest = manifest;
        let target = path.map(PathBuf::from).or_else(|| session.target.clone());
        let target = target.ok_or_else(|| DeckError::Damaged("there is nowhere to save to".into()))?;
        (snapshot(session, ink), target)
    };
    write_snapshot(snap, target.clone()).await?;
    if let Some(session) = sessions.0.lock().unwrap().get_mut(&token) {
        session.source = Some(target.clone());
        session.target = Some(target.clone());
    }
    Ok(SavedDeck { stamp: file_stamp(&target), path: target.to_string_lossy().into_owned() })
}

/// Recovery files are named by library id, so these ids become part of a path.
fn recovery_path(app: &AppHandle, id: &str) -> Result<PathBuf, DeckError> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(DeckError::Damaged(format!("not a deck id: {id}")));
    }
    Ok(app_folder(app, "recovery")?.join(format!("{id}.pwpptx")))
}

/// Autosave. Never touches the user's file: it goes to a separate copy in the app's folder.
#[tauri::command]
pub async fn write_recovery(
    token: String,
    id: String,
    ink: Option<Value>,
    app: AppHandle,
    sessions: State<'_, Sessions>,
) -> Result<(), DeckError> {
    let target = recovery_path(&app, &id)?;
    let snap = {
        let guard = sessions.0.lock().unwrap();
        let session = guard
            .get(&token)
            .ok_or_else(|| DeckError::Damaged("this presentation is no longer open".into()))?;
        snapshot(session, ink)
    };
    write_snapshot(snap, target).await
}

#[tauri::command]
pub fn list_recovery(app: AppHandle) -> Result<Vec<String>, DeckError> {
    let mut ids = Vec::new();
    for entry in fs::read_dir(app_folder(&app, "recovery")?)? {
        let path = entry?.path();
        let is_deck = path.extension().is_some_and(|e| e == "pwpptx");
        if let (true, Some(stem)) = (is_deck, path.file_stem().and_then(|s| s.to_str())) {
            ids.push(stem.to_string());
        }
    }
    Ok(ids)
}

#[tauri::command]
pub fn delete_recovery(id: String, app: AppHandle) -> Result<(), DeckError> {
    let _ = fs::remove_file(recovery_path(&app, &id)?);
    Ok(())
}

/// Opens the recovery copy, but Save still writes to the deck's own file.
#[tauri::command]
pub async fn open_recovery(
    id: String,
    path: String,
    app: AppHandle,
    sessions: State<'_, Sessions>,
) -> Result<OpenedDeck, DeckError> {
    let copy = recovery_path(&app, &id)?;
    let file = PathBuf::from(&path);
    let content = read_in_background(copy.clone()).await?;
    let token = start_session(&sessions, copy, file.clone(), &content);
    Ok(OpenedDeck { token, stamp: file_stamp(&file), draft: is_draft(&app, &file), path, content })
}

/// A draft that was just saved somewhere real. Only ever a file in the app's own drafts folder.
#[tauri::command]
pub fn delete_draft(path: String, app: AppHandle) -> Result<(), DeckError> {
    let file = PathBuf::from(path);
    if is_draft(&app, &file) {
        let _ = fs::remove_file(file);
    }
    Ok(())
}

/// Copying slides takes their images along, so they can be pasted into another deck later.
#[tauri::command]
pub fn copy_slide_assets(
    token: String,
    names: Vec<String>,
    sessions: State<'_, Sessions>,
    clipboard: State<'_, SlideClipboard>,
) -> Result<(), DeckError> {
    let mut copied = Vec::new();
    let guard = sessions.0.lock().unwrap();
    let session = guard
        .get(&token)
        .ok_or_else(|| DeckError::Damaged("this presentation is no longer open".into()))?;
    for name in names {
        let bytes = match (session.assets.get(&name), &session.source) {
            (Some(bytes), _) => Some(bytes.clone()),
            (None, Some(source)) => read_asset(source, &name).ok(),
            (None, None) => None,
        };
        if let Some(bytes) = bytes {
            copied.push((name, bytes));
        }
    }
    *clipboard.0.lock().unwrap() = copied;
    Ok(())
}

#[tauri::command]
pub fn paste_slide_assets(
    token: String,
    sessions: State<'_, Sessions>,
    clipboard: State<'_, SlideClipboard>,
) {
    if let Some(session) = sessions.0.lock().unwrap().get_mut(&token) {
        for (name, bytes) in clipboard.0.lock().unwrap().iter() {
            session.assets.insert(name.clone(), bytes.clone());
        }
    }
}

/// A new deck. It has no file of its own yet, so its images stay in memory.
#[tauri::command]
pub fn create_deck_session(
    manifest: Value,
    theme_css: String,
    widgets_js: String,
    sessions: State<'_, Sessions>,
) -> String {
    let token = uuid::Uuid::new_v4().simple().to_string();
    let session = new_session(None, manifest, theme_css, widgets_js);
    sessions.0.lock().unwrap().insert(token.clone(), session);
    token
}

/// Raw bytes, because a base64 or JSON copy of a large image is slow to pass across.
#[tauri::command]
pub fn add_deck_asset(request: tauri::ipc::Request<'_>, sessions: State<'_, Sessions>) -> Result<(), String> {
    let header_text = |name: &str| {
        let value = request.headers().get(name).and_then(|v| v.to_str().ok());
        value.map(str::to_string).ok_or_else(|| format!("missing {name}"))
    };
    let (token, name) = (header_text("deck-token")?, header_text("asset-name")?);
    if !name.starts_with("assets/") || !super::format::is_safe_entry_name(&name) {
        return Err(format!("unsafe file name: {name}"));
    }
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    if let Some(session) = sessions.0.lock().unwrap().get_mut(&token) {
        session.assets.insert(name, bytes.clone());
    }
    Ok(())
}

/// A new deck has no file yet, so it is kept in the app's own folder until it is saved somewhere,
/// so closing it doesn't lose it.
#[tauri::command]
pub fn write_draft(token: String, app: AppHandle, sessions: State<'_, Sessions>) -> Result<String, DeckError> {
    let dir = app_folder(&app, "drafts")?;
    let path = dir.join(format!("{}.pwpptx", uuid::Uuid::new_v4().simple()));

    let mut guard = sessions.0.lock().unwrap();
    let session = guard
        .get_mut(&token)
        .ok_or_else(|| DeckError::Damaged("this presentation is no longer open".into()))?;
    let optional = |text: &str| (!text.is_empty()).then(|| text.to_string());
    let content = DeckContent {
        manifest: session.manifest.clone(),
        slides_html: session.slides_html.clone(),
        theme_css: optional(&session.theme_css),
        widgets_js: optional(&session.widgets_js),
        notes: None,
        ink: None,
    };
    let assets: Vec<(&str, &[u8])> =
        session.assets.iter().map(|(name, bytes)| (name.as_str(), bytes.as_slice())).collect();
    write_deck(&path, &DeckWrite { content: &content, source: None, assets: &assets })?;
    session.source = Some(path.clone());
    session.target = Some(path.clone());
    Ok(path.to_string_lossy().into_owned())
}

/// The frontend sanitises the slides and hands them back, so nothing unsanitised is ever served.
#[tauri::command]
pub fn set_deck_slides(token: String, html: String, sessions: State<'_, Sessions>) {
    if let Some(session) = sessions.0.lock().unwrap().get_mut(&token) {
        session.slides_html = html;
    }
}

#[tauri::command]
pub fn close_deck(token: String, sessions: State<'_, Sessions>) {
    sessions.0.lock().unwrap().remove(&token);
}

fn page(session: &Session) -> String {
    format!(
        "<!doctype html><html lang=\"{}\" dir=\"{}\"><head><meta charset=\"utf-8\">\
         <title>Slides</title><link rel=\"stylesheet\" href=\"engine.css\">\
         <link rel=\"stylesheet\" href=\"app.css\">\
         <link rel=\"stylesheet\" href=\"theme.css\"></head><body>\
         <div id=\"stage\"><div id=\"bgl\"><div class=\"blob b0\"></div><div class=\"blob b1\"></div>\
         <div class=\"blob b2\"></div><div class=\"blob b3\"></div></div>{}</div>\
         <div id=\"wb\"><div id=\"wbg\"></div><div id=\"wbbar\"><i></i></div></div><div id=\"inkwrap\"></div>\
         <div id=\"dock\"></div><div id=\"ov\"></div><div id=\"toast\"></div>\
         <script src=\"freehand.js\"></script><script src=\"engine.js\"></script><script src=\"widgets.js\"></script></body></html>",
        session.lang, session.dir, session.slides_html
    )
}

fn content_type(name: &str) -> &'static str {
    match name.rsplit('.').next().map(str::to_ascii_lowercase).as_deref() {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        _ => "application/octet-stream",
    }
}

fn respond(status: StatusCode, kind: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    let policy = format!(
        "default-src 'none'; script-src {SOURCES}; style-src {SOURCES} 'unsafe-inline'; \
         img-src {SOURCES} data:; font-src {SOURCES} data:"
    );
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, kind)
        .header(header::CONTENT_SECURITY_POLICY, policy)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .header(header::CACHE_CONTROL, "no-store")
        .body(body)
        .expect("static headers are valid")
}

fn not_found() -> Response<Vec<u8>> {
    respond(StatusCode::NOT_FOUND, "text/plain", Vec::new())
}

fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = text.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Answers `/<token>/<file>`. Without a valid token there is nothing to see.
pub fn handle(sessions: &Sessions, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let Some(path) = percent_decode(request.uri().path().trim_start_matches('/')) else {
        return not_found();
    };
    let Some((token, file)) = path.split_once('/') else {
        return not_found();
    };
    let guard = sessions.0.lock().unwrap();
    let Some(session) = guard.get(token) else {
        return not_found();
    };
    let text = |kind: &str, body: &str| respond(StatusCode::OK, kind, body.as_bytes().to_vec());
    match file {
        "index.html" => text("text/html; charset=utf-8", &page(session)),
        "engine.css" => text("text/css; charset=utf-8", ENGINE_CSS),
        "theme.css" => text("text/css; charset=utf-8", &session.theme_css),
        "app.css" => text("text/css; charset=utf-8", APP_CSS),
        "engine.js" => text("text/javascript; charset=utf-8", ENGINE_JS),
        "freehand.js" => text("text/javascript; charset=utf-8", FREEHAND_JS),
        "widgets.js" => text("text/javascript; charset=utf-8", &session.widgets_js),
        name if name.starts_with("assets/") => {
            if let Some(bytes) = session.assets.get(name) {
                return respond(StatusCode::OK, content_type(name), bytes.clone());
            }
            let Some(deck) = session.source.clone() else {
                return not_found();
            };
            // Reading an asset can be slow, so the lock isn't held for it.
            drop(guard);
            match read_asset(&deck, name) {
                Ok(bytes) => respond(StatusCode::OK, content_type(name), bytes),
                Err(_) => not_found(),
            }
        }
        _ => not_found(),
    }
}
