//! The first-launch window size (after that, the window-state plugin remembers it), and WebView2
//! told not to act like a browser.

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri_plugin_window_state::DEFAULT_FILENAME;

const WORK_AREA_SHARE: f64 = 0.9;

fn is_first_launch(app: &AppHandle) -> bool {
    app.path()
        .app_config_dir()
        .map(|dir| !dir.join(DEFAULT_FILENAME).exists())
        .unwrap_or(false)
}

/// About 90% of the work area, centred. It must not open maximized, even on 1366×768.
fn fit_to_work_area(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()? else {
        return Ok(());
    };
    let area = monitor.work_area();
    let width = (f64::from(area.size.width) * WORK_AREA_SHARE) as u32;
    let height = (f64::from(area.size.height) * WORK_AREA_SHARE) as u32;
    window.set_size(PhysicalSize::new(width, height))?;
    window.set_position(PhysicalPosition::new(
        area.position.x + (area.size.width - width) as i32 / 2,
        area.position.y + (area.size.height - height) as i32 / 2,
    ))
}

/// The window starts hidden so sizing it can't be seen; this shows it.
pub fn prepare(app: &AppHandle) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    if is_first_launch(app) {
        fit_to_work_area(&window)?;
    }
    #[cfg(windows)]
    native::apply(&window)?;
    window.show()
}

#[cfg(windows)]
mod native {
    use tauri::WebviewWindow;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2PermissionRequestedEventArgs, ICoreWebView2Settings3, ICoreWebView2Settings4,
        ICoreWebView2Settings5, ICoreWebView2Settings6, COREWEBVIEW2_PERMISSION_KIND,
        COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
        COREWEBVIEW2_PERMISSION_STATE_DENY,
    };
    use webview2_com::PermissionRequestedEventHandler;
    use windows::core::{Interface, PWSTR};

    /// The app's own page, in a release build and in `tauri dev`. Never a slide page.
    const APP_PAGES: [&str; 2] = ["http://tauri.localhost", "http://localhost:1420"];

    /// Paste in the app's own text menu needs the clipboard. Slides never get it.
    fn answer_permission(
        args: &ICoreWebView2PermissionRequestedEventArgs,
    ) -> windows::core::Result<()> {
        // SAFETY: WebView2 calls this on the main thread with valid arguments, and the address it
        // returns is ours to read and free.
        unsafe {
            let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
            args.PermissionKind(&raw mut kind)?;
            if kind != COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ {
                return Ok(());
            }
            let mut uri = PWSTR::null();
            args.Uri(&raw mut uri)?;
            let address = uri.to_string().unwrap_or_default();
            windows::Win32::System::Com::CoTaskMemFree(Some(uri.0.cast()));
            let ours = APP_PAGES.iter().any(|page| address.starts_with(page));
            args.SetState(if ours {
                COREWEBVIEW2_PERMISSION_STATE_ALLOW
            } else {
                COREWEBVIEW2_PERMISSION_STATE_DENY
            })
        }
    }

    pub fn apply(window: &WebviewWindow) -> tauri::Result<()> {
        window.with_webview(|view| {
            let setup = || -> windows::core::Result<()> {
                // SAFETY: called on the main thread, as WebView2 requires, by with_webview.
                unsafe {
                    let webview = view.controller().CoreWebView2()?;
                    let settings = webview.Settings()?;
                    settings.SetIsStatusBarEnabled(false)?;
                    settings.SetIsZoomControlEnabled(false)?;
                    settings.SetIsBuiltInErrorPageEnabled(false)?;
                    // Right-click menus are the app's own (features/notices/TextMenu.tsx).
                    settings.SetAreDefaultContextMenusEnabled(false)?;
                    settings
                        .cast::<ICoreWebView2Settings3>()?
                        .SetAreBrowserAcceleratorKeysEnabled(false)?;
                    let autofill = settings.cast::<ICoreWebView2Settings4>()?;
                    autofill.SetIsPasswordAutosaveEnabled(false)?;
                    autofill.SetIsGeneralAutofillEnabled(false)?;
                    settings.cast::<ICoreWebView2Settings5>()?.SetIsPinchZoomEnabled(false)?;
                    settings.cast::<ICoreWebView2Settings6>()?.SetIsSwipeNavigationEnabled(false)?;

                    let handler = PermissionRequestedEventHandler::create(Box::new(|_, args| {
                        args.map_or(Ok(()), |args| answer_permission(&args))
                    }));
                    let mut token = 0i64;
                    webview.add_PermissionRequested(&handler, &raw mut token)
                }
            };
            if let Err(error) = setup() {
                eprintln!("Couldn't set up the window: {error}");
            }
        })
    }
}
