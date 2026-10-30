#!/usr/bin/env python3
"""Merge a block of <section class="slide"> elements into deck-template.html.

  python build_deck.py my-slides.html My_Deck.html --title "Session 2 · Topic — Course"
  python build_deck.py my-slides.html My_Deck.html --css my-theme.css      # optional CSS appended to the theme block
  python build_deck.py my-slides.html My_Deck.html --js widgets.js         # optional widget code  W.name=function(root){...};

my-slides.html must contain ONLY <section class="slide ..."> … </section> elements
(no <html>/<head>/<body>, no <script> except the quiz JSON). Output = one self-contained .html file.
"""
import argparse, os, re, sys
ap = argparse.ArgumentParser()
ap.add_argument('slides'); ap.add_argument('out')
ap.add_argument('--title', default=None, help='text for the browser tab <title>')
ap.add_argument('--css', default=None, help='file with extra CSS (palette overrides, slide-specific rules)')
ap.add_argument('--js', default=None, help='file with widget code: W.name=function(root){...};')
ap.add_argument('--template', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'deck-template.html'))
a = ap.parse_args()
t = open(a.template, encoding='utf-8').read()
s = open(a.slides, encoding='utf-8').read().strip()
if '<html' in s.lower() or '<body' in s.lower():
    sys.exit('slides file must contain only <section class="slide"> elements, not a full page')
if s.count('<section') != s.count('</section>') or '<section' not in s:
    sys.exit('slides file: unbalanced or missing <section> tags')
i = t.index('<!-- SLIDES:START'); i = t.index('-->', i) + 3
j = t.index('<!-- SLIDES:END -->')
t = t[:i] + '\n' + s + '\n' + t[j:]
if a.title:
    t = re.sub(r'<title>.*?</title>', '<title>' + a.title.replace('\\', '\\\\') + '</title>', t, count=1, flags=re.S)
if a.css:
    c = open(a.css, encoding='utf-8').read()
    k = t.index('</style></head>')
    t = t[:k] + '\n/* --- extra css --- */\n' + c + '\n' + t[k:]
if a.js:
    m = t.index('/* ---- quiz ---- */')
    t = t[:m] + open(a.js, encoding='utf-8').read() + '\n' + t[m:]
open(a.out, 'w', encoding='utf-8').write(t)
print('wrote', a.out, '·', s.count('<section'), 'slides ·', len(t) // 1024, 'KB')
