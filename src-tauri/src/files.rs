//! Small JSON files in the app data folder, written so a crash can't leave half a file.

use std::fs;
use std::path::{Path, PathBuf};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

/// Only these names: the frontend can't use this to touch anything else on disk.
const ALLOWED: [&str; 3] = ["library.json", "settings.json", "toolbar.json"];

/// A logo may be at most 200 KB; that check is in the frontend, with its wording. This stops a
/// huge file being read just to refuse it.
const MAX_LOGO_BYTES: u64 = 1024 * 1024;

fn app_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    if !ALLOWED.contains(&name) {
        return Err(format!("not an app file: {name}"));
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}

#[tauri::command]
pub fn read_app_file(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let path = app_file(&app, &name)?;
    match fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn write_app_file(app: AppHandle, name: String, text: String) -> Result<(), String> {
    let path = app_file(&app, &name)?;
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, text).map_err(|e| e.to_string())?;
    fs::rename(&temp, &path).map_err(|e| {
        let _ = fs::remove_file(&temp);
        e.to_string()
    })
}

/// Which of these files still exist, so Home can mark the ones that were moved or deleted.
#[tauri::command]
pub fn existing_paths(paths: Vec<String>) -> Vec<bool> {
    paths.iter().map(|path| Path::new(path).is_file()).collect()
}

/// Reads the logo the user picked. Only `.svg`: this is not a general file reader.
#[tauri::command]
pub fn read_logo_file(path: String) -> Result<String, String> {
    let file = Path::new(&path);
    let is_svg = file.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("svg"));
    if !is_svg {
        return Err("not an svg".into());
    }
    if fs::metadata(file).map_err(|e| e.to_string())?.len() > MAX_LOGO_BYTES {
        return Err("too large".into());
    }
    fs::read_to_string(file).map_err(|e| e.to_string())
}

fn has_extension(file: &Path, wanted: &str) -> bool {
    file.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case(wanted))
}

/// Toolbar settings export, to a place the user just chose. Only `.json`.
#[tauri::command]
pub fn export_toolbar(path: String, text: String) -> Result<(), String> {
    let file = Path::new(&path);
    if !has_extension(file, "json") {
        return Err("not a json file".into());
    }
    fs::write(file, text).map_err(|e| e.to_string())
}

/// Toolbar settings import, from a file the user just chose. Only `.json`.
#[tauri::command]
pub fn read_toolbar_file(path: String) -> Result<String, String> {
    let file = Path::new(&path);
    if !has_extension(file, "json") {
        return Err("not a json file".into());
    }
    if fs::metadata(file).map_err(|e| e.to_string())?.len() > MAX_LOGO_BYTES {
        return Err("too large".into());
    }
    fs::read_to_string(file).map_err(|e| e.to_string())
}

/// A presentation's ink, kept in the app's folder until Save writes it into the file (M4).
fn ink_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(format!("not a deck id: {id}"));
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("ink");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{id}.json")))
}

#[tauri::command]
pub fn read_ink(app: AppHandle, id: String) -> Result<Option<String>, String> {
    match fs::read_to_string(ink_path(&app, &id)?) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn write_ink(app: AppHandle, id: String, text: String) -> Result<(), String> {
    let path = ink_path(&app, &id)?;
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, text).map_err(|e| e.to_string())?;
    fs::rename(&temp, &path).map_err(|e| {
        let _ = fs::remove_file(&temp);
        e.to_string()
    })
}

/// Ids come from library.json, so they are checked before they become part of a path.
fn thumb_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(format!("not a deck id: {id}"));
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("thumbs");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{id}.webp")))
}

#[tauri::command]
pub fn write_thumb(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let id = request.headers().get("deck-id").and_then(|v| v.to_str().ok()).unwrap_or_default();
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    fs::write(thumb_path(&app, id)?, bytes).map_err(|e| e.to_string())
}

/// Empty when there is no thumbnail yet.
#[tauri::command]
pub fn read_thumb(app: AppHandle, id: String) -> Result<Response, String> {
    let bytes = fs::read(thumb_path(&app, &id)?).unwrap_or_default();
    Ok(Response::new(bytes))
}

#[tauri::command]
pub fn delete_thumb(app: AppHandle, id: String) -> Result<(), String> {
    let _ = fs::remove_file(thumb_path(&app, &id)?);
    Ok(())
}
