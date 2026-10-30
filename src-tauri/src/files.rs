//! Small JSON files in the app data folder, written so a crash can't leave half a file.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Only these names: the frontend can't use this to touch anything else on disk.
const ALLOWED: [&str; 2] = ["library.json", "settings.json"];

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
