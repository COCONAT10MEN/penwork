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
    use webview2_com::ContextMenuRequestedEventHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Settings3, ICoreWebView2Settings4, ICoreWebView2Settings5,
        ICoreWebView2Settings6, ICoreWebView2_11,
    };
    use windows::core::{Interface, BOOL, PWSTR};

    /// What a right-click on a text box may offer. Everything else in the menu is about the web.
    const TEXT_MENU: [&str; 4] = ["cut", "copy", "paste", "selectAll"];

    fn keep_text_items(
        args: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2ContextMenuRequestedEventArgs,
    ) -> windows::core::Result<()> {
        // SAFETY: WebView2 calls this on the main thread with valid arguments, and the name it
        // returns is ours to read and free.
        unsafe {
            let items = args.MenuItems()?;
            let mut count = 0u32;
            items.Count(&raw mut count)?;
            for index in (0..count).rev() {
                let item = items.GetValueAtIndex(index)?;
                let mut name = PWSTR::null();
                item.Name(&raw mut name)?;
                let text = name.to_string().unwrap_or_default();
                windows::Win32::System::Com::CoTaskMemFree(Some(name.0.cast()));
                if !TEXT_MENU.contains(&text.as_str()) {
                    items.RemoveValueAtIndex(index)?;
                }
            }
            Ok(())
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
                    settings.cast::<ICoreWebView2Settings3>()?.SetAreBrowserAcceleratorKeysEnabled(false)?;
                    let autofill = settings.cast::<ICoreWebView2Settings4>()?;
                    autofill.SetIsPasswordAutosaveEnabled(false)?;
                    autofill.SetIsGeneralAutofillEnabled(false)?;
                    settings.cast::<ICoreWebView2Settings5>()?.SetIsPinchZoomEnabled(false)?;
                    settings.cast::<ICoreWebView2Settings6>()?.SetIsSwipeNavigationEnabled(false)?;

                    // Right-click: a text box keeps Cut, Copy and Paste, and nothing else has a menu.
                    let handler = ContextMenuRequestedEventHandler::create(Box::new(|_, args| {
                        let Some(args) = args else {
                            return Ok(());
                        };
                        let target = args.ContextMenuTarget()?;
                        let mut editable = BOOL::default();
                        target.IsEditable(&raw mut editable)?;
                        if editable.as_bool() {
                            keep_text_items(&args)
                        } else {
                            args.SetHandled(true)
                        }
                    }));
                    let mut token = 0i64;
                    webview.cast::<ICoreWebView2_11>()?.add_ContextMenuRequested(&handler, &raw mut token)
                }
            };
            if let Err(error) = setup() {
                eprintln!("Couldn't set up the window: {error}");
            }
        })
    }
}
