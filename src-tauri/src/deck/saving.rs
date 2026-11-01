//! Writing decks: Save, recovery copies and drafts, plus the slide clipboard.

use super::format::{read_asset, write_deck, DeckContent, DeckError, DeckWrite};
use super::session::{
    app_folder, file_stamp, is_draft, read_in_background, start_session, OpenedDeck, Session, Sessions,
};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, State};

/// Images of the slides on the app's own clipboard, so they survive the source deck being closed.
#[derive(Default)]
pub struct SlideClipboard(Mutex<Vec<(String, Vec<u8>)>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedDeck {
    path: String,
    stamp: String,
    images_lost: bool,
}

/// Everything Save needs, copied out so the file can be written without holding up the slide page.
struct Snapshot {
    content: DeckContent,
    source: Option<PathBuf>,
    assets: Vec<(String, Vec<u8>)>,
    /// The file it was opened from has gone, so images only it held can't be copied.
    source_gone: bool,
}

fn snapshot(session: &Session, ink: Option<Value>) -> Snapshot {
    let optional = |text: &str| (!text.is_empty()).then(|| text.to_string());
    let source = session.source.clone().filter(|file| file.exists());
    Snapshot {
        source_gone: session.source.is_some() && source.is_none(),
        content: DeckContent {
            manifest: session.manifest.clone(),
            slides_html: session.slides_html.clone(),
            theme_css: optional(&session.theme_css),
            widgets_js: optional(&session.widgets_js),
            notes: session.notes.clone(),
            ink,
        },
        source,
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
    let images_lost = snap.source_gone;
    write_snapshot(snap, target.clone()).await?;
    if let Some(session) = sessions.0.lock().unwrap().get_mut(&token) {
        session.source = Some(target.clone());
        session.target = Some(target.clone());
    }
    Ok(SavedDeck {
        stamp: file_stamp(&target),
        path: target.to_string_lossy().into_owned(),
        images_lost,
    })
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

/// Whether the recovery copy is newer than the file. A file changed since would lose those changes.
#[tauri::command]
pub fn recovery_is_newer(id: String, path: String, app: AppHandle) -> Result<bool, DeckError> {
    let modified = |file: &Path| fs::metadata(file).and_then(|m| m.modified()).ok();
    let copy = modified(&recovery_path(&app, &id)?);
    Ok(match (copy, modified(Path::new(&path))) {
        (Some(copy), Some(file)) => copy >= file,
        _ => true,
    })
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
/// Returns the names that couldn't be read.
#[tauri::command]
pub async fn copy_slide_assets(
    token: String,
    names: Vec<String>,
    sessions: State<'_, Sessions>,
    clipboard: State<'_, SlideClipboard>,
) -> Result<Vec<String>, DeckError> {
    let (mut copied, source, missing) = {
        let guard = sessions.0.lock().unwrap();
        let session = guard
            .get(&token)
            .ok_or_else(|| DeckError::Damaged("this presentation is no longer open".into()))?;
        let (held, missing): (Vec<_>, Vec<_>) =
            names.into_iter().partition(|name| session.assets.contains_key(name));
        let copied: Vec<_> =
            held.into_iter().map(|name| (session.assets[&name].clone(), name)).collect();
        (copied, session.source.clone(), missing)
    };
    let mut failed = Vec::new();
    for name in missing {
        match source.as_deref().map(|file| read_asset(file, &name)) {
            Some(Ok(bytes)) => copied.push((bytes, name)),
            _ => failed.push(name),
        }
    }
    *clipboard.0.lock().unwrap() = copied.into_iter().map(|(bytes, name)| (name, bytes)).collect();
    Ok(failed)
}

/// Two decks can each have an image with the same name. A pasted one that differs comes in under
/// a new name, so it can't replace what other slides show. Returns those renames.
#[tauri::command]
pub fn paste_slide_assets(
    token: String,
    sessions: State<'_, Sessions>,
    clipboard: State<'_, SlideClipboard>,
) -> Vec<(String, String)> {
    let mut renames = Vec::new();
    let mut guard = sessions.0.lock().unwrap();
    let Some(session) = guard.get_mut(&token) else {
        return renames;
    };
    for (name, bytes) in clipboard.0.lock().unwrap().iter() {
        let there = session.assets.get(name).cloned().or_else(|| {
            session.source.as_deref().and_then(|file| read_asset(file, name).ok())
        });
        match there {
            Some(there) if there == *bytes => {}
            Some(_) => {
                let extension = name.rsplit('.').next().unwrap_or("png");
                let fresh = format!("assets/{}.{extension}", uuid::Uuid::new_v4().simple());
                session.assets.insert(fresh.clone(), bytes.clone());
                renames.push((name.clone(), fresh));
            }
            None => {
                session.assets.insert(name.clone(), bytes.clone());
            }
        }
    }
    renames
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

