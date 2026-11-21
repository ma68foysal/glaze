"""Keep the three demo-store copies of the theme in step with the repo.

The copies live outside the repo in D:\\cracktab\\oblique-demo\\<name>, because their
templates and settings carry demo-store resources (shopify://shop_images, store
handles, custom metafield links) that must never ship.

  python demo.py rebuild <name|all>   take the JSON (templates, section groups,
                                      settings_data) from the live theme through
                                      the Admin API, and the code from the repo.
                                      Never uses `shopify theme pull`.
  python demo.py sync [name|all]      copy repo code into the copies; refresh the
                                      presets inside each settings_data from the repo.

Push a copy with shopify.cmd theme push --path <copy> --store <store> --theme <id>.
"""
import json, os, re, shutil, filecmp, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'demo-clone'))
import gql  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
ROOT = r'D:\cracktab\oblique-demo'
STORES = {
    'oblique': ('skinova-hveyg6a1', 167169687792),
    'club': ('oblique-club-vrjg1qy6', 155517223095),
    'hush': ('oblique-hush-jqtqsh01', 186698170583),
}
CODE_DIRS = ['assets', 'blocks', 'layout', 'locales', 'sections', 'snippets']
STORE_JSON = ['templates/*.json', 'sections/*.json', 'config/settings_data.json']


def split_header(raw):
    m = re.match(r'^\s*/\*.*?\*/\s*', raw, re.S)
    head = m.group(0) if m else ''
    return head, json.loads(raw[len(head):])


def copy_code(dst):
    changed = []
    for d in CODE_DIRS + ['config', 'templates']:
        src = os.path.join(REPO, d)
        os.makedirs(os.path.join(dst, d), exist_ok=True)
        for f in sorted(os.listdir(src)):
            sp = os.path.join(src, f)
            if not os.path.isfile(sp):
                continue
            rel = d + '/' + f
            # Store-owned JSON stays as the store has it.
            if d == 'templates' and f.endswith('.json'):
                continue
            if d == 'sections' and f.endswith('.json'):
                continue
            if rel == 'config/settings_data.json':
                continue
            dp = os.path.join(dst, d, f)
            if not os.path.exists(dp) or not filecmp.cmp(sp, dp, shallow=False):
                shutil.copy2(sp, dp)
                changed.append(rel)
    # Files removed from the repo go from the copy too (code dirs only).
    for d in CODE_DIRS:
        for f in os.listdir(os.path.join(dst, d)):
            if d == 'sections' and f.endswith('.json'):
                continue
            if not os.path.exists(os.path.join(REPO, d, f)):
                os.remove(os.path.join(dst, d, f))
                changed.append('removed ' + d + '/' + f)
    return changed


def refresh_presets(dst):
    p = os.path.join(dst, 'config', 'settings_data.json')
    if not os.path.exists(p):
        return
    head, mine = split_header(open(p, encoding='utf-8').read())
    _, repo = split_header(open(os.path.join(REPO, 'config', 'settings_data.json'), encoding='utf-8').read())
    mine['presets'] = repo['presets']
    open(p, 'w', encoding='utf-8', newline='\n').write(head + json.dumps(mine, indent=2, ensure_ascii=False) + '\n')


def rebuild(name):
    store, tid = STORES[name]
    dst = os.path.join(ROOT, name)
    os.makedirs(dst, exist_ok=True)
    r = gql.run(store, '''query($f: [String!]) { theme(id: "gid://shopify/OnlineStoreTheme/%d") { name
        files(first: 250, filenames: $f) { nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } } } } }''' % tid,
                {'f': STORE_JSON})
    files = r['theme']['files']['nodes']
    for n in files:
        p = os.path.join(dst, *n['filename'].split('/'))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'w', encoding='utf-8', newline='\n').write(n['body']['content'])
    changed = copy_code(dst)
    print(name, '<-', r['theme']['name'], len(files), 'store files,', len(changed), 'code files')


def sync(name):
    dst = os.path.join(ROOT, name)
    changed = copy_code(dst)
    refresh_presets(dst)
    print(name, ':', ', '.join(changed) if changed else 'code up to date')


if __name__ == '__main__':
    cmd = sys.argv[1]
    which = sys.argv[2] if len(sys.argv) > 2 else 'all'
    names = list(STORES) if which == 'all' else [which]
    for n in names:
        (rebuild if cmd == 'rebuild' else sync)(n)
