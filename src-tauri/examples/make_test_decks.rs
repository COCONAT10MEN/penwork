//! Builds the decks in test-files/ from the owner's template. Run from src-tauri:
//!   cargo run --example make_test_decks
//! Not part of the app.

use penwork_lib::deck::format::{write_deck, DeckContent, DeckWrite};
use serde_json::json;
use std::fs;
use std::path::Path;

const TEMPLATE: &str = include_str!("../../reference/lop-deck/deck-template.html");
const SMALL_PNG: &[u8] = include_bytes!("../icons/128x128.png");
const SMALL_SVG: &[u8] = b"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 120 120\">\
<circle cx=\"60\" cy=\"60\" r=\"56\" fill=\"#0aa0c8\"/></svg>";

fn between<'a>(text: &'a str, from: &str, to: &str) -> &'a str {
    let start = text.find(from).expect("start marker") + from.len();
    let end = text[start..].find(to).expect("end marker") + start;
    &text[start..end]
}

fn manifest(title: &str) -> serde_json::Value {
    json!({
        "format": "penwork-deck",
        "version": 1,
        "engine": "lop-1",
        "title": title,
        "lang": "en",
        "dir": "ltr",
        "stage": { "w": 1920, "h": 1080 },
        "brand": { "badgeWord": "SESSION", "badgeNumber": "1", "deckName": title },
        "created": "2026-10-30T18:00:00Z",
        "modified": "2026-10-30T18:00:00Z",
        "generator": "make_test_decks"
    })
}

/// Deck code that tries everything it shouldn't, and reports what happened.
const PROBE_JS: &str = r#"
W.probe = function (root) {
  var r = {};
  function t(name, fn) { try { r[name] = fn(); } catch (e) { r[name] = "blocked: " + e.name; } }
  t("tauriInternals", function () { return typeof window.__TAURI_INTERNALS__; });
  t("tauriGlobal", function () { return typeof window.__TAURI__; });
  t("webviewBridge", function () { return typeof (window.chrome && window.chrome.webview); });
  t("parentDocument", function () { return "REACHED " + parent.document.title; });
  t("topLocation", function () { return "REACHED " + top.location.href; });
  t("localStorage", function () { return "REACHED " + localStorage.length; });
  t("cookie", function () { return "REACHED " + document.cookie; });
  var jobs = [
    ["fetchIpc", "http://ipc.localhost/get_accent_color"],
    ["fetchInternet", "https://example.com/"],
    ["fetchApp", "http://localhost:1420/"],
    ["fetchOwnAsset", "assets/icon.png"]
  ].map(function (j) {
    return fetch(j[1], { mode: "no-cors" }).then(
      function () { r[j[0]] = "REACHED"; },
      function (e) { r[j[0]] = "blocked: " + e.name; }
    );
  });
  var img = new Promise(function (done) {
    var i = new Image();
    i.onload = function () { r.imageInternet = "REACHED"; done(); };
    i.onerror = function () { r.imageInternet = "blocked"; done(); };
    i.src = "https://example.com/x.png";
  });
  Promise.all(jobs.concat([img])).then(function () {
    parent.postMessage({ v: 1, id: "probe", type: "probe", payload: r }, "*");
    root.textContent = "probe finished";
  });
};
"#;

const WIDGET_SLIDE: &str = r#"<section class="slide" data-title="Try it" data-bg="900,-420,1.2;1500,500,.9;-120,820,1.2;1650,-120,.7">
  <div class="body"><div class="sec"><div class="eb">Test</div><h2>A widget from widgets.js</h2></div>
  <div class="main"><div data-w="counter"></div></div></div>
</section>"#;

const WIDGET_JS: &str = r#"
W.counter = function (root) {
  var n = 0;
  root.innerHTML = '<button type="button" class="card" style="font-size:40px">Clicked 0 times</button>';
  root.firstChild.onclick = function () { n++; root.firstChild.textContent = "Clicked " + n + " times"; };
};
"#;

const SLIDES_ONLY: &str = r#"<section class="slide hero" data-title="Waves" data-bg="1300,-320,1;-260,620,1;1560,760,1;120,-300,.9">
  <div class="kick">Physics · Waves</div>
  <div class="mid"><div class="sdot big" data-m="sdot"><b class="sv">LESSON</b><b class="sn">2</b></div><h1 class="snm big" data-m="snm">Waves</h1></div>
  <div class="toc"><div class="c"><i>1</i>Frequency</div><div class="c"><i>2</i>Wavelength</div></div>
</section>
<section class="slide" data-title="Frequency" data-bg="900,-420,1.2;1500,500,.9;-120,820,1.2;1650,-120,.7">
  <div class="spill"><span class="sdot" data-m="sdot"><b class="sv">LESSON</b><b class="sn">2</b></span><span class="snm" data-m="snm">Waves</span></div>
  <div class="body"><div class="sec"><div class="eb">Part 01</div><h2>Frequency</h2></div>
  <div class="main"><div class="card soft"><h3><span class="tri">▶</span>Definition</h3><div style="font-size:29px">Oscillations per second, measured in hertz.</div></div></div></div>
</section>"#;

fn write(path: &Path, content: &DeckContent, assets: &[(&str, &[u8])]) {
    write_deck(path, &DeckWrite { content, source: None, assets }).expect("write deck");
    println!("wrote {}", path.display());
}

fn main() {
    let out = Path::new("../test-files");
    fs::create_dir_all(out).expect("test-files folder");

    let slides = between(TEMPLATE, "<!-- SLIDES:START (build_deck.py replaces everything between these two markers) -->", "<!-- SLIDES:END -->").trim();
    let theme = between(TEMPLATE, "<style id=\"theme\">", "</style></head>");

    write(
        &out.join("demo.pwpptx"),
        &DeckContent {
            manifest: manifest("Newton's Second Law"),
            slides_html: slides.to_string(),
            theme_css: Some(theme.to_string()),
            widgets_js: None,
            notes: None,
            ink: None,
        },
        &[],
    );

    let probe_slide = "<section class=\"slide\" data-title=\"Sandbox probe\"><div class=\"body\">\
        <div class=\"sec\"><div class=\"eb\">Test</div><h2>Sandbox probe</h2></div><div class=\"main\">\
        <img src=\"assets/icon.png\" alt=\"Image from the deck\" width=\"128\" height=\"128\">\
        <img src=\"assets/circle.svg\" alt=\"SVG from the deck\" width=\"128\" height=\"128\">\
        <div data-w=\"probe\">running…</div></div></div></section>";
    write(
        &out.join("sandbox-probe.pwpptx"),
        &DeckContent {
            manifest: manifest("Sandbox probe"),
            slides_html: probe_slide.to_string(),
            theme_css: None,
            widgets_js: Some(PROBE_JS.to_string()),
            notes: None,
            ink: None,
        },
        &[("assets/icon.png", SMALL_PNG), ("assets/circle.svg", SMALL_SVG)],
    );

    fs::write(out.join("broken.pwpptx"), "This is not a zip file, so it can't be opened.")
        .expect("broken file");
    println!("wrote broken.pwpptx");

    write(
        &out.join("widget.pwpptx"),
        &DeckContent {
            manifest: manifest("Deck with a widget"),
            slides_html: WIDGET_SLIDE.to_string(),
            theme_css: Some(theme.to_string()),
            widgets_js: Some(WIDGET_JS.to_string()),
            notes: None,
            ink: None,
        },
        &[],
    );

    fs::write(out.join("newtons-second-law.html"), TEMPLATE).expect("template copy");
    println!("wrote newtons-second-law.html");
    fs::write(out.join("slides-only.html"), SLIDES_ONLY).expect("slides-only file");
    println!("wrote slides-only.html");
}
