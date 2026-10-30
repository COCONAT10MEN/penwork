//! The first-launch window size. After that, the window-state plugin remembers it.

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
    window.show()
}
