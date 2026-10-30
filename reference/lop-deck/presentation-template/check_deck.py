#!/usr/bin/env python3
"""Open a deck in headless Chromium, reveal every slide fully, screenshot it, and report
console errors + anything that sticks out of the safe area.

  pip install playwright && playwright install chromium        (once)
  python check_deck.py My_Deck.html [shots_dir]

Look at the PNGs afterwards (or the printed contact sheet path) — the numbers only catch overflow,
not ugly spacing.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright
src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'deck_shots'
JS = '''()=>{const s=document.querySelector('.slide.show');const o=[];
 s.querySelectorAll('.sec *,.main *').forEach(e=>{if(e.closest('svg')||e.closest('.quiz'))return;const r=e.getBoundingClientRect();if(!r.width||!r.height)return;
   if(r.bottom>1080-50||r.right>1920-100||(r.left<100&&r.left>0))o.push(e.tagName+'.'+(typeof e.className==='string'?e.className:'')+' "'+(e.textContent||'').trim().slice(0,30)+'" bottom='+Math.round(r.bottom)+' right='+Math.round(r.right)+' left='+Math.round(r.left));});
 const h=s.querySelector('.sec h2');if(h&&h.getBoundingClientRect().right>1920-120-480)o.push('TITLE too long (collides with the session badge): '+h.textContent);
 return o.slice(0,4);}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1920, 'height': 1080})
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGE ERROR ' + str(e)))
        await pg.goto('file://' + os.path.abspath(src)); await pg.wait_for_timeout(700)
        await pg.evaluate("document.getElementById('toast').style.display='none'")
        n = await pg.evaluate('window.__n'); os.makedirs(out, exist_ok=True); bad = 0
        for i in range(n):
            await pg.evaluate('window.__go(%d)' % i); await pg.wait_for_timeout(1100)
            await pg.evaluate('window.__all()'); await pg.wait_for_timeout(900)
            await pg.screenshot(path='%s/slide_%02d.png' % (out, i + 1))
            if await pg.evaluate("document.querySelector('.slide.show').classList.contains('hero')"):
                hr = await pg.evaluate("(()=>{const h=document.querySelector('.slide.show h1');return h?Math.round(h.getBoundingClientRect().right):0})()")
                if hr > 1800: bad += 1; print('slide', i + 1, 'COVER TITLE too long (right edge %d)' % hr)
            else:
                r = await pg.evaluate(JS)
                if r: bad += 1; print('slide', i + 1, 'OVERFLOW:', *r, sep='\n   ')
        print('%d slides, %d with overflow, console errors: %s' % (n, bad, errs or 'none'))
        try:
            from PIL import Image
            ims = [Image.open('%s/slide_%02d.png' % (out, i + 1)).resize((640, 360)) for i in range(n)]
            cols = 3; rows = (n + cols - 1) // cols; W = Image.new('RGB', (640 * cols, 360 * rows), 'white')
            for k, im in enumerate(ims): W.paste(im, ((k % cols) * 640, (k // cols) * 360))
            W.save(out + '/contact_sheet.png'); print('contact sheet:', out + '/contact_sheet.png')
        except Exception: pass
        await b.close()
asyncio.run(main())
