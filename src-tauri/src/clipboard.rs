//! Reads text from the clipboard for Paste from AI. The WebView's own clipboard API can wait
//! forever on a permission prompt. Like every command, this is out of reach of deck code.

#[cfg(windows)]
fn read_text() -> Option<String> {
    use windows::Win32::Foundation::{HGLOBAL, HWND};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard,
    };
    use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};

    const CF_UNICODETEXT: u32 = 13;

    // SAFETY: the pointer is only read while the clipboard is open and the memory is locked, and
    // Windows guarantees this format ends with a zero.
    unsafe {
        IsClipboardFormatAvailable(CF_UNICODETEXT).ok()?;
        OpenClipboard(Some(HWND::default())).ok()?;
        let text = GetClipboardData(CF_UNICODETEXT).ok().and_then(|handle| {
            let memory = HGLOBAL(handle.0);
            let start = GlobalLock(memory).cast::<u16>();
            if start.is_null() {
                return None;
            }
            let length = (0..).take_while(|&i| *start.add(i) != 0).count();
            let text = String::from_utf16_lossy(std::slice::from_raw_parts(start, length));
            let _ = GlobalUnlock(memory);
            Some(text)
        });
        let _ = CloseClipboard();
        text
    }
}

#[cfg(not(windows))]
fn read_text() -> Option<String> {
    None
}

/// Empty when there's no text on the clipboard.
#[tauri::command]
pub fn read_clipboard_text() -> String {
    read_text().unwrap_or_default()
}
