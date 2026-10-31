fn main() {
    // Naming the commands puts them under Tauri's permission system, so each one needs a grant in
    // capabilities/default.json. That grant covers the app's own pages only, not deck code in the
    // sandboxed iframe, even though Tauri's helper script also appears inside that iframe.
    let manifest = tauri_build::AppManifest::new().commands(&[
        "get_accent_color",
        "take_pending_open",
        "read_app_file",
        "write_app_file",
        "open_deck",
        "set_deck_slides",
        "close_deck",
        "create_deck_session",
        "add_deck_asset",
        "write_draft",
        "existing_paths",
        "read_logo_file",
        "write_thumb",
        "read_thumb",
        "delete_thumb",
        "capture_view",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to run the Tauri build script");
}
