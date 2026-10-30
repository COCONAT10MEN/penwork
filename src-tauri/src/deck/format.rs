//! The `.pwpptx` container (docs/DECK-FORMAT.md): a zip of HTML slides, assets and JSON.
//! This file knows nothing about Tauri, so it can be tested on its own.

use serde::Serialize;
use serde_json::Value;
use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

pub const MIMETYPE: &str = "application/vnd.penwork.deck";
pub const FORMAT_NAME: &str = "penwork-deck";
pub const FORMAT_VERSION: u64 = 1;

const MAX_SLIDES: usize = 500;
const MAX_TOTAL_BYTES: u64 = 200 * 1024 * 1024;
const MAX_ASSET_BYTES: u64 = 50 * 1024 * 1024;
const MAX_NAME_CHARS: usize = 120;

/// Files this app reads and rewrites itself. Everything else is kept untouched on save.
const KNOWN_ENTRIES: [&str; 7] = [
    "mimetype",
    "manifest.json",
    "slides.html",
    "theme.css",
    "widgets.js",
    "notes.json",
    "ink.json",
];

#[derive(Debug, thiserror::Error)]
pub enum DeckError {
    #[error("This file isn't a Penwork deck.")]
    NotADeck,
    #[error("This deck is damaged: {0}")]
    Damaged(String),
    #[error("This deck was made by a newer Penwork. Update Penwork to open it.")]
    NewerFormat,
    #[error("This deck is too large: {0}")]
    TooLarge(String),
    #[error("Couldn't read or write the file: {0}")]
    Io(#[from] std::io::Error),
}

impl DeckError {
    /// A stable name for the frontend, separate from the wording.
    pub fn code(&self) -> &'static str {
        match self {
            DeckError::NotADeck => "not-a-deck",
            DeckError::Damaged(_) => "damaged",
            DeckError::NewerFormat => "newer-format",
            DeckError::TooLarge(_) => "too-large",
            DeckError::Io(_) => "io",
        }
    }
}

impl Serialize for DeckError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = s.serialize_struct("DeckError", 2)?;
        st.serialize_field("code", self.code())?;
        st.serialize_field("message", &self.to_string())?;
        st.end()
    }
}

impl From<zip::result::ZipError> for DeckError {
    fn from(e: zip::result::ZipError) -> Self {
        match e {
            zip::result::ZipError::Io(io) => DeckError::Io(io),
            other => DeckError::Damaged(other.to_string()),
        }
    }
}

/// Everything in a deck except its assets, which are read one at a time when a slide asks.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckContent {
    pub manifest: Value,
    pub slides_html: String,
    pub theme_css: Option<String>,
    pub widgets_js: Option<String>,
    pub notes: Option<Value>,
    pub ink: Option<Value>,
}

/// Safe names only: a zip can claim any path, and these end up in URLs and on the page.
pub fn is_safe_entry_name(name: &str) -> bool {
    !name.is_empty()
        && name.chars().count() <= MAX_NAME_CHARS
        && !name.starts_with('/')
        && !name.contains('\\')
        && !name.contains(':')
        && !name.contains('\0')
        && name.split('/').all(|part| part != ".." && part != ".")
}

fn read_limited(entry: impl Read, limit: u64, name: &str) -> Result<Vec<u8>, DeckError> {
    // The size in a zip's header can lie, so stop at the limit whatever it claims.
    let mut bytes = Vec::new();
    entry.take(limit + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > limit {
        return Err(DeckError::TooLarge(format!("{name} is over the limit")));
    }
    Ok(bytes)
}

fn read_text(zip: &mut ZipArchive<BufReader<File>>, name: &str) -> Result<Option<String>, DeckError> {
    let Ok(entry) = zip.by_name(name) else {
        return Ok(None);
    };
    let bytes = read_limited(entry, MAX_TOTAL_BYTES, name)?;
    String::from_utf8(bytes)
        .map(Some)
        .map_err(|_| DeckError::Damaged(format!("{name} isn't UTF-8 text")))
}

fn read_json(zip: &mut ZipArchive<BufReader<File>>, name: &str) -> Result<Option<Value>, DeckError> {
    match read_text(zip, name)? {
        None => Ok(None),
        Some(text) => serde_json::from_str(&text)
            .map(Some)
            .map_err(|e| DeckError::Damaged(format!("{name}: {e}"))),
    }
}

fn open_zip(path: &Path) -> Result<ZipArchive<BufReader<File>>, DeckError> {
    let file = BufReader::new(File::open(path)?);
    // Anything that isn't a zip at all is "not a deck", not "damaged".
    ZipArchive::new(file).map_err(|e| match e {
        zip::result::ZipError::Io(io) => DeckError::Io(io),
        _ => DeckError::NotADeck,
    })
}

fn check_entries(zip: &mut ZipArchive<BufReader<File>>) -> Result<(), DeckError> {
    let mut total: u64 = 0;
    for i in 0..zip.len() {
        let entry = zip.by_index(i)?;
        let name = entry.name()?.to_string();
        if !is_safe_entry_name(&name) {
            return Err(DeckError::Damaged(format!("unsafe file name: {name}")));
        }
        total = total.saturating_add(entry.size());
        if total > MAX_TOTAL_BYTES {
            return Err(DeckError::TooLarge("over 200 MB in total".into()));
        }
        if name.starts_with("assets/") && entry.size() > MAX_ASSET_BYTES {
            return Err(DeckError::TooLarge(format!("{name} is over 50 MB")));
        }
    }
    Ok(())
}

fn check_manifest(manifest: &Value) -> Result<(), DeckError> {
    if manifest.get("format").and_then(Value::as_str) != Some(FORMAT_NAME) {
        return Err(DeckError::NotADeck);
    }
    let version = manifest
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| DeckError::Damaged("manifest has no version".into()))?;
    if version > FORMAT_VERSION {
        return Err(DeckError::NewerFormat);
    }
    Ok(())
}

pub fn read_deck(path: &Path) -> Result<DeckContent, DeckError> {
    let mut zip = open_zip(path)?;
    check_entries(&mut zip)?;

    let mimetype = read_text(&mut zip, "mimetype")?.ok_or(DeckError::NotADeck)?;
    if mimetype.trim() != MIMETYPE {
        return Err(DeckError::NotADeck);
    }
    let manifest = read_json(&mut zip, "manifest.json")?
        .ok_or_else(|| DeckError::Damaged("manifest.json is missing".into()))?;
    check_manifest(&manifest)?;
    let slides_html = read_text(&mut zip, "slides.html")?
        .ok_or_else(|| DeckError::Damaged("slides.html is missing".into()))?;
    if slides_html.matches("<section").count() > MAX_SLIDES {
        return Err(DeckError::TooLarge("over 500 slides".into()));
    }

    Ok(DeckContent {
        manifest,
        slides_html,
        theme_css: read_text(&mut zip, "theme.css")?,
        widgets_js: read_text(&mut zip, "widgets.js")?,
        notes: read_json(&mut zip, "notes.json")?,
        ink: read_json(&mut zip, "ink.json")?,
    })
}

/// One asset (`assets/...`), read when a slide asks for it, so a large deck isn't all in memory.
pub fn read_asset(path: &Path, name: &str) -> Result<Vec<u8>, DeckError> {
    if !name.starts_with("assets/") || !is_safe_entry_name(name) {
        return Err(DeckError::Damaged(format!("unsafe file name: {name}")));
    }
    let mut zip = open_zip(path)?;
    let entry = zip.by_name(name)?;
    read_limited(entry, MAX_ASSET_BYTES, name)
}

/// What Save writes. Assets and unknown files are copied from `source` unchanged.
pub struct DeckWrite<'a> {
    pub content: &'a DeckContent,
    pub source: Option<&'a Path>,
    /// New or replaced assets, as (name, bytes).
    pub assets: &'a [(&'a str, &'a [u8])],
}

fn temp_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(".tmp");
    PathBuf::from(name)
}

fn write_zip(temp: &Path, deck: &DeckWrite) -> Result<(), DeckError> {
    let file = File::create(temp)?;
    let mut zip = ZipWriter::new(file);
    let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    let deflated = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    // First and uncompressed, so the file type can be recognized from the first bytes.
    zip.start_file("mimetype", stored)?;
    zip.write_all(MIMETYPE.as_bytes())?;

    let c = deck.content;
    let manifest = serde_json::to_string_pretty(&c.manifest)
        .map_err(|e| DeckError::Damaged(e.to_string()))?;
    zip.start_file("manifest.json", deflated)?;
    zip.write_all(manifest.as_bytes())?;
    zip.start_file("slides.html", deflated)?;
    zip.write_all(c.slides_html.as_bytes())?;
    if let Some(css) = &c.theme_css {
        zip.start_file("theme.css", deflated)?;
        zip.write_all(css.as_bytes())?;
    }
    if let Some(js) = &c.widgets_js {
        zip.start_file("widgets.js", deflated)?;
        zip.write_all(js.as_bytes())?;
    }
    for (name, value) in [("notes.json", &c.notes), ("ink.json", &c.ink)] {
        if let Some(json) = value {
            let text =
                serde_json::to_string(json).map_err(|e| DeckError::Damaged(e.to_string()))?;
            zip.start_file(name, deflated)?;
            zip.write_all(text.as_bytes())?;
        }
    }

    for (name, bytes) in deck.assets {
        if !name.starts_with("assets/") || !is_safe_entry_name(name) {
            return Err(DeckError::Damaged(format!("unsafe file name: {name}")));
        }
        zip.start_file(*name, deflated)?;
        zip.write_all(bytes)?;
    }

    if let Some(source) = deck.source {
        let mut old = open_zip(source)?;
        for i in 0..old.len() {
            let entry = old.by_index_raw(i)?;
            let name = entry.name()?.into_owned();
            let replaced = deck.assets.iter().any(|(n, _)| *n == name);
            if !KNOWN_ENTRIES.contains(&name.as_str()) && !replaced {
                zip.raw_copy_file(entry)?;
            }
        }
    }

    let file = zip.finish()?;
    file.sync_all()?;
    Ok(())
}

/// Writes next to the target, then renames over it, so a crash can't leave half a deck.
pub fn write_deck(path: &Path, deck: &DeckWrite) -> Result<(), DeckError> {
    let temp = temp_path(path);
    let result = write_zip(&temp, deck).and_then(|()| fs::rename(&temp, path).map_err(Into::into));
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct TempDir(PathBuf);
    impl TempDir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("penwork-{name}-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
        fn file(&self, name: &str) -> PathBuf {
            self.0.join(name)
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn content() -> DeckContent {
        DeckContent {
            manifest: json!({"format": FORMAT_NAME, "version": 1, "title": "Waves", "extra": "kept"}),
            slides_html: "<section class=\"slide\" data-id=\"s-1\">Hi</section>".into(),
            theme_css: Some(":root{--teal:#0aa0c8}".into()),
            widgets_js: None,
            notes: Some(json!({"s-1": "Say hello"})),
            ink: None,
        }
    }

    fn raw_zip(path: &Path, entries: &[(&str, &str)]) {
        let mut zip = ZipWriter::new(File::create(path).unwrap());
        for (name, text) in entries {
            zip.start_file(*name, SimpleFileOptions::default()).unwrap();
            zip.write_all(text.as_bytes()).unwrap();
        }
        zip.finish().unwrap();
    }

    fn write_new(path: &Path) {
        let c = content();
        write_deck(path, &DeckWrite { content: &c, source: None, assets: &[] }).unwrap();
    }

    #[test]
    fn round_trips_a_deck() {
        let dir = TempDir::new("round");
        let path = dir.file("a.pwpptx");
        write_new(&path);
        let back = read_deck(&path).unwrap();
        assert_eq!(back.manifest["title"], "Waves");
        assert_eq!(back.manifest["extra"], "kept");
        assert_eq!(back.slides_html, content().slides_html);
        assert_eq!(back.theme_css, content().theme_css);
        assert_eq!(back.notes, content().notes);
    }

    #[test]
    fn mimetype_is_first_and_uncompressed() {
        let dir = TempDir::new("mime");
        let path = dir.file("a.pwpptx");
        write_new(&path);
        let mut zip = open_zip(&path).unwrap();
        let first = zip.by_index(0).unwrap();
        assert_eq!(first.name().unwrap(), "mimetype");
        assert_eq!(first.compression(), CompressionMethod::Stored);
    }

    #[test]
    fn saving_keeps_assets_and_unknown_files() {
        let dir = TempDir::new("keep");
        let path = dir.file("a.pwpptx");
        raw_zip(
            &path,
            &[
                ("mimetype", MIMETYPE),
                ("manifest.json", "{\"format\":\"penwork-deck\",\"version\":1}"),
                ("slides.html", "<section class=\"slide\">Old</section>"),
                ("assets/pic.png", "PNGDATA"),
                ("future/thing.bin", "KEEP ME"),
            ],
        );
        let mut c = read_deck(&path).unwrap();
        c.slides_html = "<section class=\"slide\">New</section>".into();
        write_deck(&path, &DeckWrite { content: &c, source: Some(&path), assets: &[] }).unwrap();

        assert!(read_deck(&path).unwrap().slides_html.contains("New"));
        assert_eq!(read_asset(&path, "assets/pic.png").unwrap(), b"PNGDATA");
        let mut zip = open_zip(&path).unwrap();
        assert!(zip.by_name("future/thing.bin").is_ok());
        assert!(!temp_path(&path).exists());
    }

    #[test]
    fn refuses_a_newer_format() {
        let dir = TempDir::new("newer");
        let path = dir.file("a.pwpptx");
        raw_zip(
            &path,
            &[
                ("mimetype", MIMETYPE),
                ("manifest.json", "{\"format\":\"penwork-deck\",\"version\":2}"),
                ("slides.html", ""),
            ],
        );
        assert_eq!(read_deck(&path).unwrap_err().code(), "newer-format");
    }

    #[test]
    fn refuses_files_that_are_not_decks() {
        let dir = TempDir::new("not");
        let text = dir.file("a.pwpptx");
        fs::write(&text, "just some text").unwrap();
        assert_eq!(read_deck(&text).unwrap_err().code(), "not-a-deck");

        let other_zip = dir.file("b.pwpptx");
        raw_zip(&other_zip, &[("hello.txt", "hi")]);
        assert_eq!(read_deck(&other_zip).unwrap_err().code(), "not-a-deck");
    }

    #[test]
    fn reports_a_missing_or_broken_manifest_as_damaged() {
        let dir = TempDir::new("broken");
        let path = dir.file("a.pwpptx");
        raw_zip(&path, &[("mimetype", MIMETYPE), ("slides.html", "")]);
        assert_eq!(read_deck(&path).unwrap_err().code(), "damaged");
        raw_zip(&path, &[("mimetype", MIMETYPE), ("manifest.json", "{nope")]);
        assert_eq!(read_deck(&path).unwrap_err().code(), "damaged");
    }

    #[test]
    fn refuses_path_escapes() {
        for bad in ["../evil.txt", "assets/../../evil", "/etc/passwd", "C:/x", "a\\b", "", "./x"] {
            assert!(!is_safe_entry_name(bad), "{bad}");
        }
        assert!(is_safe_entry_name("assets/pic one.png"));

        let dir = TempDir::new("escape");
        let path = dir.file("a.pwpptx");
        raw_zip(&path, &[("mimetype", MIMETYPE), ("../evil.txt", "x")]);
        assert_eq!(read_deck(&path).unwrap_err().code(), "damaged");
        assert!(read_asset(&path, "../evil.txt").is_err());
        assert!(read_asset(&path, "slides.html").is_err());
    }

    #[test]
    fn a_failed_save_leaves_the_original_alone() {
        let dir = TempDir::new("fail");
        let path = dir.file("a.pwpptx");
        write_new(&path);
        let before = fs::read(&path).unwrap();
        let missing = dir.file("gone.pwpptx");
        let c = content();
        assert!(write_deck(&path, &DeckWrite { content: &c, source: Some(&missing), assets: &[] }).is_err());
        assert_eq!(fs::read(&path).unwrap(), before);
        assert!(!temp_path(&path).exists());
    }
}
