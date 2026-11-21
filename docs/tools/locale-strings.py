"""Merge new storefront strings into the locale files.
usage: python locale-strings.py <strings.json>
strings.json: {"en.default": {"products.fit": {...}}, "fr": {"cart.look_add": "..."}, ...}
A dotted key names the parent path; its value (object or string) is merged there.
Keeps each file's comment header and line endings."""
import json, os, re, sys

LOC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'locales')
data = json.load(open(sys.argv[1], encoding='utf-8'))


def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


for lang, entries in data.items():
    p = os.path.join(LOC, lang + '.json')
    raw = open(p, 'rb').read().decode('utf-8')
    crlf = '\r\n' in raw
    raw = raw.replace('\r\n', '\n')
    m = re.match(r'^\s*/\*.*?\*/\s*', raw, re.S)
    head = m.group(0) if m else ''
    d = json.loads(raw[len(head):])
    for path, value in entries.items():
        keys = path.split('.')
        node = d
        for k in keys[:-1]:
            node = node.setdefault(k, {})
        if isinstance(value, dict) and isinstance(node.get(keys[-1]), dict):
            merge(node[keys[-1]], value)
        else:
            node[keys[-1]] = value
    out = head + json.dumps(d, indent=2, ensure_ascii=False) + '\n'
    if crlf:
        out = out.replace('\n', '\r\n')
    open(p, 'wb').write(out.encode('utf-8'))
    print('updated', lang)
