mod accent;
mod capture;
pub mod deck;
mod files;
mod window;

use deck::session::{self, Sessions, SlideClipboard};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_window_state::StateFlags;

/// A file passed on the command line (double-click, Open with) before the page is ready.
#[derive(Default)]
struct PendingOpen(Mutex<Option<String>>);

/// Double-clicking a deck runs `Penwork.exe <path>`; the first argument that is a file wins.
fn file_argument(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|arg| !arg.starts_with('-') && std::path::Path::new(arg).is_file())
        .cloned()
}

#[tauri::command]
fn take_pending_open(pending: tauri::State<'_, PendingOpen>) -> Option<String> {
    pending.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // First, so a second launch hands over its file and exits before anything else starts.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            if let Some(path) = file_argument(&args) {
                let _ = app.emit("open-file", path);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .manage(Sessions::default())
        .manage(SlideClipboard::default())
        .manage(PendingOpen::default())
        .register_uri_scheme_protocol(session::SCHEME, |ctx, request| {
            session::handle(&ctx.app_handle().state::<Sessions>(), &request)
        })
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            *app.state::<PendingOpen>().0.lock().unwrap() = file_argument(&args);
            accent::watch(app.handle().clone());
            window::prepare(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            accent::get_accent_color,
            capture::capture_view,
            take_pending_open,
            files::read_app_file,
            files::write_app_file,
            files::existing_paths,
            files::read_logo_file,
            files::write_thumb,
            files::read_thumb,
            files::delete_thumb,
            files::export_toolbar,
            files::read_toolbar_file,
            files::read_ink,
            files::write_ink,
            files::delete_ink,
            session::open_deck,
            session::create_deck_session,
            session::add_deck_asset,
            session::write_draft,
            session::save_deck,
            session::write_recovery,
            session::list_recovery,
            session::delete_recovery,
            session::open_recovery,
            session::delete_draft,
            session::copy_slide_assets,
            session::paste_slide_assets,
            session::set_deck_slides,
            session::close_deck,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
