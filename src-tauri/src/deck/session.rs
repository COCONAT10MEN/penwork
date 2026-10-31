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
const VIEWER_JS: &str = include_str!("../../../src/runtime/viewer.js");

struct Session {
    /// The `.pwpptx` assets are read from. None for a deck that exists only in memory so far.
    source: Option<PathBuf>,
    manifest: Value,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedDeck {
    token: String,
    path: String,
    /// Changes when the file does, so a cached thumbnail can tell it is out of date.
    stamp: String,
    content: DeckContent,
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
        source,
        lang: manifest_text(&manifest, "lang", "en"),
        dir: manifest_text(&manifest, "dir", "ltr"),
        manifest,
        slides_html: String::new(),
        theme_css,
        widgets_js,
        assets: HashMap::new(),
    }
}

#[tauri::command]
pub async fn open_deck(path: String, sessions: State<'_, Sessions>) -> Result<OpenedDeck, DeckError> {
    let file = PathBuf::from(&path);
    let reader = file.clone();
    let content = tauri::async_runtime::spawn_blocking(move || read_deck(&reader))
        .await
        .map_err(|e| DeckError::Damaged(e.to_string()))??;

    let token = uuid::Uuid::new_v4().simple().to_string();
    let session = new_session(
        Some(file.clone()),
        content.manifest.clone(),
        content.theme_css.clone().unwrap_or_default(),
        content.widgets_js.clone().unwrap_or_default(),
    );
    sessions.0.lock().unwrap().insert(token.clone(), session);
    Ok(OpenedDeck { token, stamp: file_stamp(&file), path, content })
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

/// A new deck has no file yet, so it is kept in the app's own folder until
/// Save as arrives in M4, so closing it doesn't lose it.
#[tauri::command]
pub fn write_draft(token: String, app: AppHandle, sessions: State<'_, Sessions>) -> Result<String, DeckError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DeckError::Damaged(e.to_string()))?
        .join("drafts");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.pwpptx", uuid::Uuid::new_v4().simple()));

    let mut guard = sessions.0.lock().unwrap();
    let session = guard
        .get_mut(&token)
        .ok_or_else(|| DeckError::Damaged("this deck is no longer open".into()))?;
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
         <link rel=\"stylesheet\" href=\"theme.css\"></head><body>\
         <div id=\"stage\"><div id=\"bgl\"><div class=\"blob b0\"></div><div class=\"blob b1\"></div>\
         <div class=\"blob b2\"></div><div class=\"blob b3\"></div></div>{}</div>\
         <script src=\"viewer.js\"></script><script src=\"widgets.js\"></script></body></html>",
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
        "viewer.js" => text("text/javascript; charset=utf-8", VIEWER_JS),
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
