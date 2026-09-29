import os, json, hashlib
root = os.path.dirname(os.path.abspath(__file__))
files = ['./', 'index.html', 'manifest.webmanifest']
for d in ['css', 'js', 'icons']:
    for dp, dn, fn in os.walk(os.path.join(root, d)):
        for f in sorted(fn):
            p = os.path.relpath(os.path.join(dp, f), root).replace(os.sep, '/')
            if p.endswith(('.svg', '.png', '.css', '.js')) and not p.startswith('icons/maskable.svg') and p != 'icons/icon.svg':
                files.append(p)
h = hashlib.sha1()
for f in files[1:]:
    with open(os.path.join(root, f), 'rb') as fh: h.update(fh.read())
version = h.hexdigest()[:10]
src = open(os.path.join(root, 'sw.template.js')).read()
src = src.replace('__VERSION__', version).replace('__ASSETS__', json.dumps(files, indent=2))
open(os.path.join(root, 'sw.js'), 'w').write(src)
print(version, len(files))
