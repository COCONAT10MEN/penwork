//! The fonts installed on this PC, so an edit to a PDF's text can be written in the font the text
//! already uses: the list of them (from the registry, as Windows keeps it), and one font's file.
//! Only a font on that list can be read; nothing else on the disk is reachable through here.

use tauri::ipc::Response;

/// One installed font: its name as Windows lists it ("Calibri Bold (TrueType)") and its file.
#[derive(serde::Serialize, Clone)]
pub struct InstalledFont {
    pub name: String,
    pub file: String,
}

#[cfg(windows)]
fn installed() -> Vec<InstalledFont> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumValueW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE,
        KEY_READ, REG_SZ, REG_VALUE_TYPE,
    };

    const KEY: &str = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts";
    let fonts_dir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into()) + "\\Fonts\\";
    let key: Vec<u16> = KEY.encode_utf16().chain([0]).collect();
    let mut out = Vec::new();
    // Fonts for everyone, then the ones installed for this user only.
    for root in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
        let mut open = HKEY::default();
        // SAFETY: the key name is a valid, nul-terminated wide string and `open` is written once.
        if unsafe { RegOpenKeyExW(root, PCWSTR(key.as_ptr()), Some(0), KEY_READ, &mut open) }
            .is_err()
        {
            continue;
        }
        for index in 0.. {
            let mut name = [0u16; 512];
            let mut name_len = name.len() as u32;
            let mut data = [0u8; 2048];
            let mut data_len = data.len() as u32;
            let mut kind = 0u32;
            // SAFETY: every buffer is passed with its true length, which the call updates.
            let found = unsafe {
                RegEnumValueW(
                    open,
                    index,
                    Some(windows::core::PWSTR(name.as_mut_ptr())),
                    &mut name_len,
                    None,
                    Some(&mut kind as *mut u32),
                    Some(data.as_mut_ptr()),
                    Some(&mut data_len),
                )
            };
            if found.is_err() {
                break;
            }
            if REG_VALUE_TYPE(kind) != REG_SZ {
                continue;
            }
            let wide: Vec<u16> = data[..data_len as usize]
                .chunks_exact(2)
                .map(|p| u16::from_le_bytes([p[0], p[1]]))
                .take_while(|&c| c != 0)
                .collect();
            let file = String::from_utf16_lossy(&wide);
            let name = String::from_utf16_lossy(&name[..name_len as usize]);
            // A bare file name is in the Windows Fonts folder; a user's own font has its full path.
            let file = if file.contains('\\') { file } else { format!("{fonts_dir}{file}") };
            out.push(InstalledFont { name, file });
        }
        // SAFETY: `open` was opened above and is closed once.
        unsafe {
            let _ = RegCloseKey(open);
        }
    }
    out
}

#[cfg(not(windows))]
fn installed() -> Vec<InstalledFont> {
    Vec::new()
}

#[tauri::command]
pub fn installed_fonts() -> Vec<InstalledFont> {
    installed()
}

/// The file of one installed font, by its name on the list.
#[tauri::command]
pub fn installed_font_file(name: String) -> Result<Response, String> {
    let font = installed()
        .into_iter()
        .find(|f| f.name == name)
        .ok_or("not an installed font")?;
    let lower = font.file.to_ascii_lowercase();
    if !(lower.ends_with(".ttf") || lower.ends_with(".otf")) {
        return Err("not a font file the PDF can carry".into());
    }
    std::fs::read(&font.file).map(Response::new).map_err(|e| e.to_string())
}
