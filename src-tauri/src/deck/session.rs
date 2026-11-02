//! Open decks, and the private address their slides load from.
//!
//! Slides run in a sandboxed iframe that loads from this custom scheme, not from `srcdoc`:
//! a srcdoc page inherits the app's security policy (deck scripts wouldn't run), and blob
//! URLs fail inside a sandbox. Each response carries its own policy (docs/ARCHITECTURE-DECKS.md).

use super::format::{read_asset, read_deck, DeckContent, DeckError};
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

pub(super) struct Session {
    /// The `.pwpptx` assets are read from. None for a deck that exists only in memory so far.
    pub(super) source: Option<PathBuf>,
    /// Where Save writes. It differs from `source` after recovering unsaved work.
    pub(super) target: Option<PathBuf>,
    pub(super) manifest: Value,
    pub(super) notes: Option<Value>,
    /// Sanitised by the frontend before it reaches this page.
    pub(super) slides_html: String,
    pub(super) theme_css: String,
    pub(super) widgets_js: String,
    lang: String,
    dir: String,
    /// Images pulled out of the slides by the frontend. Checked before `source`.
    pub(super) assets: HashMap<String, Vec<u8>>,
}

#[derive(Default)]
pub struct Sessions(pub(super) Mutex<HashMap<String, Session>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedDeck {
    pub(super) token: String,
    pub(super) path: String,
    /// Changes when the file does, so a cached thumbnail can tell it is out of date.
    pub(super) stamp: String,
    /// Kept in the app's own folder, so it needs Save as before it has a home of its own.
    pub(super) draft: bool,
    pub(super) content: DeckContent,
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

pub(super) fn file_stamp(path: &Path) -> String {
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

pub(super) fn app_folder(app: &AppHandle, name: &str) -> Result<PathBuf, DeckError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DeckError::Damaged(e.to_string()))?
        .join(name);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub(super) async fn read_in_background(file: PathBuf) -> Result<DeckContent, DeckError> {
    tauri::async_runtime::spawn_blocking(move || read_deck(&file))
        .await
        .map_err(|e| DeckError::Damaged(e.to_string()))?
}

pub(super) fn start_session(
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

pub(super) fn is_draft(app: &AppHandle, file: &Path) -> bool {
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

/// The frontend sanitises the slides and hands them back, so nothing unsanitised is ever served.
#[tauri::command]
pub fn set_deck_slides(token: String, html: String, sessions: State<'_, Sessions>) {
    if let Some(session) = sessions.0.lock().unwrap().get_mut(&token) {
        session.slides_html = html;
    }
}

/// Speaker notes, so Save and the recovery copy have the same ones as the editor.
#[tauri::command]
pub fn set_deck_notes(token: String, notes: Option<Value>, sessions: State<'_, Sessions>) {
    if let Some(session) = sessions.0.lock().unwrap().get_mut(&token) {
        session.notes = notes;
    }
}

/// Adds an image the user picked, under a new name so it can't replace another slide's.
#[tauri::command]
pub fn add_image_file(token: String, path: String, sessions: State<'_, Sessions>) -> Result<String, DeckError> {
    const MOST: u64 = 20 * 1024 * 1024;
    let file = Path::new(&path);
    let extension = file.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let known = ["png", "jpg", "jpeg", "webp", "gif"].contains(&extension.as_str());
    if !known || fs::metadata(file)?.len() > MOST {
        return Err(DeckError::Damaged("not an image Penwork can use".into()));
    }
    let bytes = fs::read(file)?;
    let name = format!("assets/{}.{extension}", uuid::Uuid::new_v4().simple());
    let mut guard = sessions.0.lock().unwrap();
    let session = guard.get_mut(&token).ok_or_else(|| DeckError::Damaged("not open".into()))?;
    session.assets.insert(name.clone(), bytes);
    Ok(name)
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
