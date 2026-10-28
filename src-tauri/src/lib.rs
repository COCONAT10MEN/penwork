mod accent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            accent::watch(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![accent::get_accent_color])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
