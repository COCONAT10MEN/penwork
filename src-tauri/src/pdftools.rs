//! What the PDF tools need from the system: reading the files a tool is given, writing the files it
//! makes (always new ones, never over another file), and WebView2's own print-to-PDF for Word and
//! spreadsheets.

use std::fs;
use std::path::{Path, PathBuf};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::WebviewWindow;

/// What a tool may write: the formats it makes, nothing that could run.
const OUTPUTS: [&str; 9] = ["pdf", "docx", "xlsx", "pptx", "png", "jpg", "txt", "md", "csv"];
/// What a tool may be given to read.
const INPUTS: [&str; 8] = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "bmp", "docx"];
const MAX_BYTES: u64 = 512 * 1024 * 1024;

fn has_extension(path: &Path, allowed: &[&str]) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| allowed.contains(&e.to_ascii_lowercase().as_str()))
}

/// "report.pdf" is taken: "report (2).pdf", and so on.
fn free_path(wanted: &Path) -> PathBuf {
    if !wanted.exists() {
        return wanted.to_path_buf();
    }
    let stem = wanted.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = wanted.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let dir = wanted.parent().unwrap_or(Path::new("."));
    (2..)
        .map(|n| dir.join(format!("{stem} ({n}){ext}")))
        .find(|p| !p.exists())
        .unwrap_or_else(|| wanted.to_path_buf())
}

#[tauri::command]
pub fn read_input_file(path: String) -> Result<Response, String> {
    let path = PathBuf::from(path);
    if !has_extension(&path, &INPUTS) {
        return Err("not a file the tools read".into());
    }
    let size = fs::metadata(&path).map_err(|_| "missing".to_string())?.len();
    if size > MAX_BYTES {
        return Err("too large".into());
    }
    fs::read(&path).map(Response::new).map_err(|e| e.to_string())
}

/// The body is the wanted path's length (4 bytes), the path, then the file. Returns where it went.
#[tauri::command]
pub fn write_new_file(request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("expected raw bytes".into());
    };
    let (head, rest) = body.split_first_chunk::<4>().ok_or("damaged request")?;
    let length = u32::from_le_bytes(*head) as usize;
    if rest.len() < length {
        return Err("damaged request".into());
    }
    let (path, file) = rest.split_at(length);
    let wanted = PathBuf::from(String::from_utf8(path.to_vec()).map_err(|e| e.to_string())?);
    if !has_extension(&wanted, &OUTPUTS) || !wanted.parent().is_some_and(Path::is_dir) {
        return Err("not somewhere a tool may write".into());
    }
    let target = free_path(&wanted);
    let mut temp = target.clone().into_os_string();
    temp.push(".pwtmp");
    fs::write(&temp, file).map_err(|e| e.to_string())?;
    fs::rename(&temp, &target).map_err(|e| {
        let _ = fs::remove_file(&temp);
        e.to_string()
    })?;
    Ok(target.to_string_lossy().to_string())
}

/// A new folder beside the file, for tools that make many files (split, pictures).
#[tauri::command]
pub fn make_folder(parent: String, name: String) -> Result<String, String> {
    let parent = PathBuf::from(parent);
    if !parent.is_dir() || name.contains(['/', '\\', ':']) || name.trim().is_empty() {
        return Err("not a folder name".into());
    }
    let target = free_path(&parent.join(name.trim()));
    fs::create_dir(&target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[cfg(windows)]
mod print {
    use tauri::async_runtime::Sender;
    use tauri::WebviewWindow;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2_16, ICoreWebView2_2,
    };
    use webview2_com::PrintToPdfStreamCompletedHandler;
    use windows::core::Interface;
    use windows::Win32::Foundation::E_FAIL;
    use windows::Win32::System::Com::{IStream, STATFLAG_NONAME, STATSTG, STREAM_SEEK_SET};

    type Pdf = Result<Vec<u8>, String>;

    fn read_all(stream: &IStream) -> windows::core::Result<Vec<u8>> {
        // SAFETY: the stream comes from WebView2 and the buffer outlives the calls that fill it.
        unsafe {
            stream.Seek(0, STREAM_SEEK_SET, None)?;
            let mut stat = STATSTG::default();
            stream.Stat(&raw mut stat, STATFLAG_NONAME)?;
            let mut bytes = vec![0u8; stat.cbSize as usize];
            let mut read = 0u32;
            stream
                .Read(bytes.as_mut_ptr().cast(), bytes.len() as u32, Some(&raw mut read))
                .ok()?;
            bytes.truncate(read as usize);
            Ok(bytes)
        }
    }

    /// The document's page size, no margins (its own print styles set them), backgrounds on, no
    /// header or footer.
    pub fn to_pdf(window: &WebviewWindow, width: f64, height: f64, done: Sender<Pdf>) -> tauri::Result<()> {
        window.with_webview(move |view| {
            let finished = done.clone();
            let start = move || -> windows::core::Result<()> {
                // SAFETY: called on the main thread, as WebView2 requires, by with_webview.
                unsafe {
                    let webview = view.controller().CoreWebView2()?;
                    let environment: ICoreWebView2Environment6 =
                        webview.cast::<ICoreWebView2_2>()?.Environment()?.cast()?;
                    let settings = environment.CreatePrintSettings()?;
                    settings.SetPageWidth(width)?;
                    settings.SetPageHeight(height)?;
                    for set in [
                        settings.SetMarginTop(0.0),
                        settings.SetMarginBottom(0.0),
                        settings.SetMarginLeft(0.0),
                        settings.SetMarginRight(0.0),
                    ] {
                        set?;
                    }
                    settings.SetShouldPrintBackgrounds(true.into())?;
                    settings.SetShouldPrintHeaderAndFooter(false.into())?;
                    let handler = PrintToPdfStreamCompletedHandler::create(Box::new(
                        move |result, stream: Option<IStream>| {
                            let pdf = result
                                .and_then(|()| stream.ok_or_else(|| windows::core::Error::from(E_FAIL)))
                                .and_then(|s| read_all(&s))
                                .map_err(|e| e.to_string());
                            let _ = finished.try_send(pdf);
                            Ok(())
                        },
                    ));
                    webview.cast::<ICoreWebView2_16>()?.PrintToPdfStream(&settings, &handler)
                }
            };
            if let Err(error) = start() {
                let _ = done.try_send(Err(error.to_string()));
            }
        })
    }
}

/// The window's page as a PDF, through its print styles: the frontend shows only the document.
#[tauri::command]
pub async fn print_to_pdf(window: WebviewWindow, width: f64, height: f64) -> Result<Response, String> {
    // Inches; anything odd falls back to A4.
    let (width, height) = if (1.0..=50.0).contains(&width) && (1.0..=50.0).contains(&height) {
        (width, height)
    } else {
        (8.27, 11.69)
    };
    #[cfg(windows)]
    {
        let (send, mut receive) = tauri::async_runtime::channel(1);
        print::to_pdf(&window, width, height, send).map_err(|e| e.to_string())?;
        let pdf = receive.recv().await.ok_or("printing was dropped")??;
        Ok(Response::new(pdf))
    }
    #[cfg(not(windows))]
    {
        let _ = (window, width, height);
        Err("printing to PDF isn't available on this platform yet".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_a_free_name() {
        let dir = std::env::temp_dir().join(format!("pw-tools-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let first = dir.join("a.pdf");
        assert_eq!(free_path(&first), first);
        fs::write(&first, b"x").unwrap();
        assert_eq!(free_path(&first), dir.join("a (2).pdf"));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn only_known_types() {
        assert!(has_extension(Path::new("x.PDF"), &OUTPUTS));
        assert!(!has_extension(Path::new("x.exe"), &OUTPUTS));
        assert!(!has_extension(Path::new("x.html"), &INPUTS));
    }
}
