#!/usr/bin/env python3
"""Packs, unpacks and checks Penwork presentations (.pwpptx). Python standard library only.

  python pwpptx.py pack <folder> <out.pwpptx>
  python pwpptx.py unpack <in.pwpptx> <folder>
  python pwpptx.py check <folder or .pwpptx> [--shots <folder>]

--shots needs Playwright (pip install playwright && playwright install chromium). It reports text
that runs off the slide. Everything else works anywhere Python does.
"""
import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

MIMETYPE = "application/vnd.penwork.deck"
KNOWN = ["manifest.json", "slides.html", "theme.css", "widgets.js", "notes.json"]
MOST_SLIDES = 500
MOST_ASSET = 50 * 1024 * 1024

FORBIDDEN_TAGS = ["iframe", "object", "embed", "link", "meta", "base", "form", "style"]
NOT_ALLOWED_WRAPPERS = ["<html", "<head", "<body", "<!doctype"]


def read_parts(source):
    """Name -> bytes, from a folder or a .pwpptx."""
    path = Path(source)
    if path.is_dir():
        return {
            f.relative_to(path).as_posix(): f.read_bytes()
            for f in sorted(path.rglob("*"))
            if f.is_file()
        }
    with zipfile.ZipFile(path) as z:
        return {name: z.read(name) for name in z.namelist() if not name.endswith("/")}


def check_manifest(parts, problems):
    if "manifest.json" not in parts:
        problems.append("manifest.json is missing")
        return
    try:
        manifest = json.loads(parts["manifest.json"].decode("utf-8"))
    except ValueError as error:
        problems.append(f"manifest.json isn't valid JSON: {error}")
        return
    if not isinstance(manifest, dict):
        problems.append("manifest.json must be an object")
        return
    if manifest.get("format") != "penwork-deck":
        problems.append('manifest.json needs "format": "penwork-deck"')
    if manifest.get("version") != 1:
        problems.append('manifest.json needs "version": 1')
    if not manifest.get("title"):
        problems.append('manifest.json needs a "title"')


def check_quizzes(html, problems):
    for block in re.findall(r'<script type="application/json">(.*?)</script>', html, re.S):
        try:
            data = json.loads(block)
        except ValueError as error:
            problems.append(f"a quiz's JSON is broken: {error}")
            continue
        if not isinstance(data, list):
            problems.append("a quiz's JSON must be a list of questions")
            continue
        for number, question in enumerate(data, 1):
            options = question.get("o") if isinstance(question, dict) else None
            if not isinstance(options, list) or not 2 <= len(options) <= 4:
                problems.append(f"quiz question {number} needs 2 to 4 options")
            elif not isinstance(question.get("a"), int) or not 0 <= question["a"] < len(options):
                problems.append(f"quiz question {number}'s answer isn't one of its options")


def check_slides(parts, problems):
    if "slides.html" not in parts:
        problems.append("slides.html is missing")
        return
    html = parts["slides.html"].decode("utf-8")
    no_comments = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    count = len(re.findall(r'<section[^>]*class="[^"]*\bslide\b', no_comments))
    if count == 0:
        problems.append('slides.html has no <section class="slide"> blocks')
    if count > MOST_SLIDES:
        problems.append(f"{count} slides is too many (the limit is {MOST_SLIDES})")
    lower = no_comments.lower()
    for wrapper in NOT_ALLOWED_WRAPPERS:
        if wrapper in lower:
            problems.append(f"slides.html must not contain {wrapper}>: only the slides go in it")
    for tag in FORBIDDEN_TAGS:
        if re.search(rf"<{tag}[\s>]", lower):
            problems.append(f"<{tag}> isn't allowed in a slide")
    for script in re.findall(r"<script([^>]*)>", lower):
        if 'type="application/json"' not in script:
            problems.append("<script> is only allowed for quiz data")
    if re.search(r"\son\w+\s*=", lower):
        problems.append("on...= attributes aren't allowed: they would be removed")
    for source in re.findall(r'(?:src|href)\s*=\s*"([^"]*)"', no_comments):
        if not source.startswith(("assets/", "data:image/", "#")):
            problems.append(f"this reaches outside the file and would be removed: {source[:60]}")
    for used in re.findall(r'src\s*=\s*"(assets/[^"]+)"', no_comments):
        if used not in parts:
            problems.append(f"{used} is used but isn't in the presentation")
    check_quizzes(no_comments, problems)


def check_parts(parts):
    problems = []
    check_manifest(parts, problems)
    check_slides(parts, problems)
    for name, data in parts.items():
        if name == "mimetype":
            continue
        if ".." in name.split("/") or name.startswith("/") or len(name) > 120:
            problems.append(f"bad file name: {name}")
        if name.startswith("assets/") and len(data) > MOST_ASSET:
            problems.append(f"{name} is over 50 MB")
        if name not in KNOWN and not name.startswith("assets/"):
            print(f"note: {name} isn't a Penwork file; it will be kept but not used")
    return problems


def pack(folder, out):
    parts = read_parts(folder)
    parts.pop("mimetype", None)
    problems = check_parts(parts)
    if problems:
        print("Not packed:")
        for problem in problems:
            print("  -", problem)
        return 1
    with zipfile.ZipFile(out, "w") as z:
        # First and uncompressed, so the type can be read without unpacking anything.
        z.writestr(zipfile.ZipInfo("mimetype"), MIMETYPE, zipfile.ZIP_STORED)
        for name, data in parts.items():
            z.writestr(name, data, zipfile.ZIP_DEFLATED)
    print(f"Packed {out}")
    return 0


def unpack(source, folder):
    target = Path(folder)
    for name, data in read_parts(source).items():
        file = (target / name).resolve()
        if target.resolve() not in file.parents:
            print(f"Skipped an unsafe name: {name}")
            continue
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
    print(f"Unpacked into {folder}")
    return 0


OVERFLOW = """() => {
  const s = document.querySelector('.slide.show'), o = [];
  s.querySelectorAll('.sec *,.main *').forEach(e => {
    if (e.closest('svg') || e.closest('.quiz')) return;
    const r = e.getBoundingClientRect();
    if (r.bottom > 1030 || r.right > 1820 || (r.left < 100 && r.left > 0)) o.push(e.tagName);
  });
  const h = s.querySelector('.sec h2');
  if (h && h.getBoundingClientRect().right > 1320) o.push('title runs into the badge');
  return o.slice(0, 4);
}"""


def shots(source, folder):
    """A rough look without the real engine, which only the app has: it shows layout, not motion."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("--shots needs Playwright. Skipped.")
        return
    parts = read_parts(source)
    css = parts.get("theme.css", b"").decode("utf-8")
    html = parts["slides.html"].decode("utf-8")
    page_html = (
        f"<!doctype html><meta charset=utf-8><style>{css}"
        "body{margin:0}.slide{display:none;width:1920px;height:1080px;position:relative}"
        ".slide.show{display:block}.st{opacity:1}</style>"
        f"{html}"
    )
    Path(folder).mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        page.set_content(page_html)
        count = page.evaluate("document.querySelectorAll('.slide').length")
        for i in range(count):
            page.evaluate(
                "i => document.querySelectorAll('.slide').forEach("
                "(s, k) => s.classList.toggle('show', k === i))",
                i,
            )
            page.screenshot(path=f"{folder}/slide_{i + 1:02}.png")
            over = page.evaluate(OVERFLOW)
            if over:
                print(f"slide {i + 1} may run off the slide: {over}")
        browser.close()
    print(f"Pictures are in {folder}. They lack the app's styles, so judge the layout in Penwork.")


def check(source, shot_folder):
    problems = check_parts(read_parts(source))
    for problem in problems:
        print("  -", problem)
    if shot_folder and not problems:
        shots(source, shot_folder)
    print("No problems found." if not problems else f"{len(problems)} problem(s).")
    return 1 if problems else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    jobs = parser.add_subparsers(dest="job", required=True)
    pack_job = jobs.add_parser("pack")
    pack_job.add_argument("folder")
    pack_job.add_argument("out")
    unpack_job = jobs.add_parser("unpack")
    unpack_job.add_argument("source")
    unpack_job.add_argument("folder")
    check_job = jobs.add_parser("check")
    check_job.add_argument("source")
    check_job.add_argument("--shots")
    args = parser.parse_args()
    if args.job == "pack":
        return pack(args.folder, args.out)
    if args.job == "unpack":
        return unpack(args.source, args.folder)
    return check(args.source, args.shots)


if __name__ == "__main__":
    sys.exit(main())
