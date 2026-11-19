"""Empaqueta la build de Vite (dist/) en un único HTML jugable y en el zip de la release.

Uso:  npx vite build --base ./ --outDir dist  &&  python tools/pack.py
Escribe docs/jugar.html (GitHub Pages), release/YUGURE-alpha-0.3.html y release/YUGURE-alpha-0.3.zip.
"""
import glob
import re
import zipfile

VERSION = '0.3'
html = open('dist/index.html', encoding='utf-8').read()
js = open(glob.glob('dist/assets/index-*.js')[0], encoding='utf-8').read()
js = js.replace('</script', '<\\/script')  # que el código no cierre la etiqueta antes de tiempo
m = re.search(r'<script type="module"[^>]*src="[^"]+"></script>', html)
html = html[:m.start()] + '<script type="module">' + js + '</script>' + html[m.end():]
html = html.replace('<title>YŪGURE</title>', f'<title>YŪGURE · alpha {VERSION}</title>')

for p in ['docs/jugar.html', 'release/YUGURE.html', f'release/YUGURE-alpha-{VERSION}.html']:
    open(p, 'w', encoding='utf-8').write(html)

LEEME = open('tools/LEEME.txt', encoding='utf-8').read()
with zipfile.ZipFile(f'release/YUGURE-alpha-{VERSION}.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr('YUGURE/YUGURE.html', html)
    z.writestr('YUGURE/LEEME.txt', LEEME)
print(f'ok · {len(html) // 1024} KB')
