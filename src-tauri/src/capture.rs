//! A picture of the window, for deck thumbnails. WebView2 takes it itself, after the sandboxed
//! slide has been drawn. So the thumbnail is exactly what was on screen, and deck code has no way
//! to supply a different picture, as it could if the slide page rendered its own.

use tauri::ipc::Response;
use tauri::WebviewWindow;

#[cfg(windows)]
mod platform {
    use tauri::async_runtime::Sender;
    use tauri::WebviewWindow;
    use webview2_com::CapturePreviewCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG;
    use windows::Win32::Foundation::E_FAIL;
    use windows::Win32::System::Com::{IStream, STATFLAG_NONAME, STGC_DEFAULT, STREAM_SEEK_SET, STATSTG};
    use windows::Win32::UI::Shell::SHCreateMemStream;

    type Picture = Result<Vec<u8>, String>;

    fn read_all(stream: &IStream) -> windows::core::Result<Vec<u8>> {
        // SAFETY: the stream was created here and the buffer outlives the calls that fill it.
        unsafe {
            stream.Commit(STGC_DEFAULT)?;
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

    pub fn capture(window: &WebviewWindow, done: Sender<Picture>) -> tauri::Result<()> {
        window.with_webview(move |view| {
            let finished = done.clone();
            let start = move || -> windows::core::Result<()> {
                // SAFETY: called on the main thread, as WebView2 requires, by with_webview.
                unsafe {
                    let webview = view.controller().CoreWebView2()?;
                    let stream = SHCreateMemStream(None).ok_or(windows::core::Error::from(E_FAIL))?;
                    let filled = stream.clone();
                    let handler = CapturePreviewCompletedHandler::create(Box::new(move |result| {
                        let picture = result
                            .and_then(|()| read_all(&filled))
                            .map_err(|e| e.to_string());
                        let _ = finished.try_send(picture);
                        Ok(())
                    }));
                    webview.CapturePreview(
                        COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
                        &stream,
                        &handler,
                    )
                }
            };
            if let Err(error) = start() {
                let _ = done.try_send(Err(error.to_string()));
            }
        })
    }
}

/// A PNG of the whole window content. The frontend crops it to the slide.
#[tauri::command]
pub async fn capture_view(window: WebviewWindow) -> Result<Response, String> {
    #[cfg(windows)]
    {
        let (send, mut receive) = tauri::async_runtime::channel(1);
        platform::capture(&window, send).map_err(|e| e.to_string())?;
        let picture = receive.recv().await.ok_or("the capture was dropped")??;
        Ok(Response::new(picture))
    }
    #[cfg(not(windows))]
    {
        let _ = window;
        Err("thumbnails aren't available on this platform yet".into())
    }
}
