"""Small helpers for editing theme JSON templates that start with a /* comment */ header."""
import json, re


def load(path):
    raw = open(path, encoding='utf-8').read()
    m = re.match(r'^\s*/\*.*?\*/\s*', raw, re.S)
    head = m.group(0) if m else ''
    return head, json.loads(raw[len(head):])


def save(path, head, data):
    open(path, 'w', encoding='utf-8', newline='\n').write(head + json.dumps(data, indent=2, ensure_ascii=False) + '\n')
