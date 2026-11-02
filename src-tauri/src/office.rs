//! Word, Excel and PDF files. The frontend libraries read and write the formats; this only moves
//! bytes, and only for these file types.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

const KINDS: [&str; 4] = ["docx", "xlsx", "csv", "pdf"];

/// Stops a mistaken pick filling the 8 GB of memory the app shares with everything else.
const MAX_BYTES: u64 = 512 * 1024 * 1024;

fn checked(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    let known = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| KINDS.contains(&e.to_ascii_lowercase().as_str()));
    if known {
        Ok(path)
    } else {
        Err("not a document Penwork opens".into())
    }
}

#[tauri::command]
pub fn read_office_file(path: String) -> Result<Response, String> {
    let path = checked(&path)?;
    let size = fs::metadata(&path).map_err(|_| "missing".to_string())?.len();
    if size > MAX_BYTES {
        return Err("too large".into());
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(Response::new(bytes))
}

/// The body is the path's length (4 bytes), the path, then the file. A path can hold letters a
/// request header can't.
fn split_body(body: &[u8]) -> Option<(String, &[u8])> {
    let (head, rest) = body.split_first_chunk::<4>()?;
    let length = u32::from_le_bytes(*head) as usize;
    if rest.len() < length {
        return None;
    }
    let (path, file) = rest.split_at(length);
    Some((String::from_utf8(path.to_vec()).ok()?, file))
}

/// The libraries don't keep everything a file can hold, so what Save replaced stays one step back.
fn keep_previous(app: &AppHandle, path: &Path) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = dir.join("before-save");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut hasher = DefaultHasher::new();
    path.to_string_lossy().to_lowercase().hash(&mut hasher);
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    let copy = dir.join(format!("{:016x}-{name}", hasher.finish()));
    fs::copy(path, copy).map(|_| ()).map_err(|e| e.to_string())
}

/// Only ever called by Save or Save as. A half-written temp file is all a crash can leave behind.
#[tauri::command]
pub fn save_office_file(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("expected raw bytes".into());
    };
    let (path, file) = split_body(body).ok_or("damaged request")?;
    let path = checked(&path)?;
    if path.is_file() {
        keep_previous(&app, &path)?;
    }
    let mut temp = path.clone().into_os_string();
    temp.push(".pwtmp");
    fs::write(&temp, file).map_err(|e| e.to_string())?;
    fs::rename(&temp, &path).map_err(|e| {
        let _ = fs::remove_file(&temp);
        e.to_string()
    })
}

/// Stays in the same folder with the same type, and never replaces another file.
fn rename_problem(from: &Path, to: &Path) -> Option<&'static str> {
    let same_type = from.extension().map(|e| e.to_ascii_lowercase())
        == to.extension().map(|e| e.to_ascii_lowercase());
    if from.parent() != to.parent() || !same_type {
        return Some("not a rename");
    }
    let only_case = from.to_string_lossy().to_lowercase() == to.to_string_lossy().to_lowercase();
    (to.exists() && !only_case).then_some("taken")
}

#[tauri::command]
pub fn rename_office_file(from: String, to: String) -> Result<(), String> {
    let (from, to) = (checked(&from)?, checked(&to)?);
    if let Some(problem) = rename_problem(&from, &to) {
        return Err(problem.into());
    }
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_document_types_are_touched() {
        assert!(checked("C:/a/report.DOCX").is_ok());
        assert!(checked("C:/a/page.html").is_err());
        assert!(checked("C:/a/talk.pwpptx").is_err());
        assert!(checked("C:/a/no-extension").is_err());
    }

    #[test]
    fn the_body_splits_into_path_and_file() {
        let path = "C:/مستند.pdf".as_bytes();
        let mut body = (path.len() as u32).to_le_bytes().to_vec();
        body.extend_from_slice(path);
        body.extend_from_slice(&[1, 2, 3]);
        let (read, file) = split_body(&body).unwrap();
        assert_eq!(read, "C:/مستند.pdf");
        assert_eq!(file, &[1, 2, 3]);
    }

    #[test]
    fn a_rename_stays_in_its_folder_and_type() {
        let from = Path::new("C:/a/report.docx");
        assert_eq!(rename_problem(from, Path::new("C:/a/new.docx")), None);
        assert_eq!(rename_problem(from, Path::new("C:/b/new.docx")), Some("not a rename"));
        assert_eq!(rename_problem(from, Path::new("C:/a/new.pdf")), Some("not a rename"));
    }

    #[test]
    fn a_rename_never_replaces_another_file() {
        let dir = std::env::temp_dir().join("penwork-rename-test");
        fs::create_dir_all(&dir).unwrap();
        let (a, b) = (dir.join("a.pdf"), dir.join("b.pdf"));
        fs::write(&a, "a").unwrap();
        fs::write(&b, "b").unwrap();
        assert_eq!(rename_problem(&a, &b), Some("taken"));
        assert_eq!(rename_problem(&a, &dir.join("A.pdf")), None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_short_body_is_refused() {
        assert!(split_body(&[200, 0, 0, 0, 1]).is_none());
        assert!(split_body(&[1]).is_none());
    }
}
