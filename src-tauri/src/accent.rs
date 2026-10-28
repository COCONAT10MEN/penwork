//! The OS accent color, used as the theme's seed color. Windows only for now; other platforms
//! return `None` and the frontend falls back to Ink blue.

use tauri::{AppHandle, Emitter};

pub const CHANGED_EVENT: &str = "accent-color-changed";

#[cfg(windows)]
fn read() -> Option<String> {
    use windows::UI::ViewManagement::{UIColorType, UISettings};
    let settings = UISettings::new().ok()?;
    let c = settings.GetColorValue(UIColorType::Accent).ok()?;
    Some(format!("#{:02X}{:02X}{:02X}", c.R, c.G, c.B))
}

#[cfg(not(windows))]
fn read() -> Option<String> {
    None
}

#[tauri::command]
pub fn get_accent_color() -> Option<String> {
    read()
}

/// Emits `accent-color-changed` whenever the user picks a new accent color in Windows Settings.
#[cfg(windows)]
pub fn watch(app: AppHandle) {
    use windows::Foundation::TypedEventHandler;
    use windows::UI::ViewManagement::UISettings;

    let Ok(settings) = UISettings::new() else { return };
    let handler = TypedEventHandler::new(move |_, _| {
        let _ = app.emit(CHANGED_EVENT, read());
        Ok(())
    });
    if settings.ColorValuesChanged(&handler).is_ok() {
        // The subscription lives as long as this object; the app needs it until it quits.
        std::mem::forget(settings);
    }
}

#[cfg(not(windows))]
pub fn watch(_app: AppHandle) {}
