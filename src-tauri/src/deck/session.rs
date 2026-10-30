//! Open decks, and the private address their slides load from.
//!
//! Slides run in a sandboxed iframe that loads from this custom scheme, not from `srcdoc`:
//! a srcdoc page inherits the app's security policy (deck scripts wouldn't run), and blob
//! URLs fail inside a sandbox. Each response carries its own policy (docs/ARCHITECTURE-DECKS.md).

use super::format::{read_asset, read_deck, DeckContent, DeckError};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::State;

pub const SCHEME: &str = "penwork-deck";

/// `http://<scheme>.localhost` is how WebView2 sees a custom scheme.
const SOURCES: &str = "http://penwork-deck.localhost penwork-deck:";

const ENGINE_CSS: &str = include_str!("../../../src/runtime/engine.css");
const VIEWER_JS: &str = include_str!("../../../src/runtime/viewer.js");

struct Session {
    path: PathBuf,
    /// Sanitised by the frontend before it reaches this page.
    slides_html: String,
    theme_css: String,
    widgets_js: String,
    lang: String,
    dir: String,
}

#[derive(Default)]
pub struct Sessions(Mutex<HashMap<String, Session>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedDeck {
    token: String,
    path: String,
    content: DeckContent,
}

fn manifest_text(content: &DeckContent, key: &str, fallback: &str) -> String {
    let value = content.manifest.get(key).and_then(|v| v.as_str()).unwrap_or(fallback);
    // These go into an HTML attribute, so only plain language codes are let through.
    if value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        value.to_string()
    } else {
        fallback.to_string()
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
    let session = Session {
        path: file,
        slides_html: String::new(),
        theme_css: content.theme_css.clone().unwrap_or_default(),
        widgets_js: content.widgets_js.clone().unwrap_or_default(),
        lang: manifest_text(&content, "lang", "en"),
        dir: manifest_text(&content, "dir", "ltr"),
    };
    sessions.0.lock().unwrap().insert(token.clone(), session);
    Ok(OpenedDeck { token, path, content })
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
            let deck = session.path.clone();
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
