"""Recreate the Oblique demo catalogue and content on another store.
usage: clone.py <target-store-subdomain> [step ...]
steps: collections products files publish pages blog menus (default: all, in that order)
Reads products.json, collections.json and content.json exported from the Oblique store.
Each step skips things that already exist (matched by handle or filename)."""
import json, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gql import run

HERE = os.path.dirname(os.path.abspath(__file__))
STORE = sys.argv[1]
STEPS = sys.argv[2:] or ['collections', 'products', 'files', 'publish', 'pages', 'blog', 'menus']
STATE_PATH = os.path.join(HERE, 'state-%s.json' % STORE)
state = json.load(open(STATE_PATH)) if os.path.exists(STATE_PATH) else {}
def save(): json.dump(state, open(STATE_PATH, 'w'), indent=1)

def load(name):
    d = json.load(open(os.path.join(HERE, name), encoding='utf-8'))
    return d.get('data', d)
P, C, T = load('products.json'), load('collections.json'), load('content.json')
CDN = 'https://cdn.shopify.com/s/files/1/0861/2144/7664/files/'
clean = lambda url: url.split('?')[0]
basename = lambda url: clean(url).rsplit('/', 1)[-1]

def gql(query, variables=None, mutate=False):
    res = run(STORE, query, variables, mutate)
    if res.get('errors'):
        raise RuntimeError(json.dumps(res['errors'])[:800])
    return res.get('data', res)

def check(payload, label):
    errs = payload.get('userErrors') or []
    if errs:
        print('  !', label, errs)
    return not errs

# ---------------------------------------------------------------- collections
def collections():
    have = {n['handle']: n['id'] for n in gql('{ collections(first: 50) { nodes { id handle } } }')['collections']['nodes']}
    for c in C['collections']['nodes']:
        if c['handle'] in have:
            continue
        inp = {'handle': c['handle'], 'title': c['title'], 'descriptionHtml': c['descriptionHtml'], 'sortOrder': c['sortOrder']}
        if c.get('image'):
            inp['image'] = {'src': clean(c['image']['url']), 'altText': c['image'].get('altText') or c['title']}
        d = gql('mutation($input: CollectionInput!) { collectionCreate(input: $input) { collection { id handle } userErrors { field message } } }', {'input': inp}, True)['collectionCreate']
        if check(d, c['handle']):
            have[c['handle']] = d['collection']['id']
            print('  collection', c['handle'])
    state['collections'] = have; save()

# ---------------------------------------------------------------- products
def products():
    cols = state.get('collections') or {}
    have = {n['handle'] for n in gql('{ products(first: 100) { nodes { handle } } }')['products']['nodes']}
    for p in P['products']['nodes']:
        if p['handle'] in have:
            continue
        options = [{'name': o['name'], 'position': o['position'], 'values': [{'name': v['name']} for v in o['optionValues']]} for o in p['options']]
        variants = []
        for v in p['variants']['nodes']:
            var = {'optionValues': [{'optionName': s['name'], 'name': s['value']} for s in v['selectedOptions']],
                   'price': v['price'], 'sku': v['sku'], 'inventoryItem': {'tracked': v['inventoryItem']['tracked']}}
            if v.get('compareAtPrice'):
                var['compareAtPrice'] = v['compareAtPrice']
            variants.append(var)
        files = [{'originalSource': clean(m['image']['url']), 'alt': m.get('alt') or p['title'], 'contentType': 'IMAGE'} for m in p['media']['nodes'] if m.get('image')]
        inp = {'title': p['title'], 'handle': p['handle'], 'status': 'ACTIVE', 'vendor': p['vendor'], 'productType': p['productType'],
               'tags': p['tags'], 'descriptionHtml': p['descriptionHtml'],
               'collections': [cols[c['handle']] for c in p['collections']['nodes'] if c['handle'] in cols],
               'productOptions': options, 'variants': variants, 'files': files}
        d = gql('mutation($input: ProductSetInput!) { productSet(input: $input, synchronous: true) { product { id handle } userErrors { field message } } }', {'input': inp}, True)['productSet']
        if check(d, p['handle']):
            print('  product', p['handle'])

# ---------------------------------------------------------------- files the theme refers to
def theme_files():
    names = set()
    demo = os.path.join(HERE, '..', 'demo-theme')
    for root in ('templates', 'sections', 'config'):
        for f in os.listdir(os.path.join(demo, root)):
            if f.endswith('.json'):
                names |= set(re.findall(r'shopify://shop_images/([^"]+)', open(os.path.join(demo, root, f), encoding='utf-8').read()))
    return names

def files():
    want = theme_files()
    have = set()
    after = None
    while True:
        q = 'query($after: String) { files(first: 100, after: $after) { nodes { ... on MediaImage { image { url } } } pageInfo { hasNextPage endCursor } } }'
        d = gql(q, {'after': after})['files']
        have |= {basename(n['image']['url']) for n in d['nodes'] if n.get('image')}
        if not d['pageInfo']['hasNextPage']:
            break
        after = d['pageInfo']['endCursor']
    alts = {basename(n['image']['url']): n.get('alt') for n in C['files']['nodes'] if n.get('image')}
    missing = sorted(want - have)
    print('  theme photos needed:', len(want), 'missing:', len(missing))
    for i in range(0, len(missing), 10):
        batch = [{'originalSource': CDN + n, 'alt': alts.get(n) or '', 'contentType': 'IMAGE'} for n in missing[i:i + 10]]
        d = gql('mutation($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { id } userErrors { field message } } }', {'files': batch}, True)['fileCreate']
        check(d, 'files %d' % i)

# ---------------------------------------------------------------- publish to the online store
def publish():
    pubs = {n['name']: n['id'] for n in gql('{ publications(first: 10) { nodes { id name } } }')['publications']['nodes']}
    online = pubs.get('Online Store')
    ids = [n['id'] for n in gql('{ products(first: 100) { nodes { id } } }')['products']['nodes']]
    ids += [n['id'] for n in gql('{ collections(first: 50) { nodes { id } } }')['collections']['nodes']]
    for i in range(0, len(ids), 20):
        body = ' '.join('p%d: publishablePublish(id: "%s", input: [{publicationId: "%s"}]) { userErrors { field message } }' % (j, gid, online) for j, gid in enumerate(ids[i:i + 20]))
        d = gql('mutation { %s }' % body, None, True)
        for k, v in d.items():
            check(v, k)
    print('  published', len(ids))

# ---------------------------------------------------------------- pages
def pages():
    have = {n['handle']: n['id'] for n in gql('{ pages(first: 50) { nodes { id handle } } }')['pages']['nodes']}
    for p in T['pages']['nodes']:
        if p['handle'] in have:
            continue
        inp = {'title': p['title'], 'handle': p['handle'], 'body': p['body'], 'isPublished': p['isPublished']}
        if p.get('templateSuffix'):
            inp['templateSuffix'] = p['templateSuffix']
        d = gql('mutation($page: PageCreateInput!) { pageCreate(page: $page) { page { id handle } userErrors { field message } } }', {'page': inp}, True)['pageCreate']
        if check(d, p['handle']):
            have[p['handle']] = d['page']['id']
            print('  page', p['handle'])
    state['pages'] = have; save()

# ---------------------------------------------------------------- blog and published articles
def blog():
    blogs = {n['handle']: n['id'] for n in gql('{ blogs(first: 10) { nodes { id handle } } }')['blogs']['nodes']}
    for b in T['blogs']['nodes']:
        if b['handle'] not in blogs:
            d = gql('mutation($blog: BlogCreateInput!) { blogCreate(blog: $blog) { blog { id handle } userErrors { field message } } }',
                    {'blog': {'title': b['title'], 'handle': b['handle'], 'commentPolicy': b['commentPolicy']}}, True)['blogCreate']
            if not check(d, b['handle']):
                continue
            blogs[b['handle']] = d['blog']['id']
        have = {n['handle'] for n in gql('query($q: String) { articles(first: 50, query: $q) { nodes { handle } } }', {'q': 'blog_id:' + blogs[b['handle']].rsplit('/', 1)[-1]})['articles']['nodes']}
        for a in b['articles']['nodes']:
            if not a['isPublished'] or a['handle'] in have:
                continue
            inp = {'blogId': blogs[b['handle']], 'title': a['title'], 'handle': a['handle'], 'body': a['body'], 'summary': a['summary'],
                   'tags': a['tags'], 'isPublished': True, 'author': {'name': a['author']['name'] if a.get('author') else 'Studio'}}
            if a.get('image'):
                inp['image'] = {'url': clean(a['image']['url']), 'altText': a['image'].get('altText') or a['title']}
            d = gql('mutation($article: ArticleCreateInput!) { articleCreate(article: $article) { article { id handle } userErrors { field message } } }', {'article': inp}, True)['articleCreate']
            if check(d, a['handle']):
                print('  article', a['handle'])
    state['blogs'] = blogs; save()

# ---------------------------------------------------------------- menus
def map_item(item, ids):
    out = {'title': item['title'], 'type': item['type']}
    url = item.get('url') or ''
    path = re.sub(r'^https?://[^/]+', '', url)
    m = re.match(r'^/(collections|pages|blogs|products)/([^/?#]+)(?:/([^/?#]+))?', path)
    if item['type'] == 'COLLECTION' and m and m.group(2) in ids['collections']:
        out['resourceId'] = ids['collections'][m.group(2)]
    elif item['type'] == 'PAGE' and m and m.group(2) in ids['pages']:
        out['resourceId'] = ids['pages'][m.group(2)]
    elif item['type'] == 'BLOG' and m and m.group(2) in ids['blogs']:
        out['resourceId'] = ids['blogs'][m.group(2)]
    elif item['type'] in ('COLLECTION', 'PAGE', 'BLOG', 'PRODUCT', 'ARTICLE'):
        out['type'] = 'HTTP'
        out['url'] = path or '/'
    else:
        if url:
            out['url'] = path or url
    kids = [map_item(k, ids) for k in item.get('items') or []]
    if kids:
        out['items'] = kids
    return out

def menus():
    ids = {'collections': state.get('collections', {}), 'pages': state.get('pages', {}), 'blogs': state.get('blogs', {})}
    have = {n['handle']: n['id'] for n in gql('{ menus(first: 20) { nodes { id handle } } }')['menus']['nodes']}
    for m in T['menus']['nodes']:
        if m['handle'] == 'customer-account-main-menu':
            continue
        items = [map_item(i, ids) for i in m['items']]
        if m['handle'] in have:
            d = gql('mutation($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) { menuUpdate(id: $id, title: $title, items: $items) { menu { handle } userErrors { field message } } }',
                    {'id': have[m['handle']], 'title': m['title'], 'items': items}, True)['menuUpdate']
        else:
            d = gql('mutation($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) { menuCreate(title: $title, handle: $handle, items: $items) { menu { handle } userErrors { field message } } }',
                    {'title': m['title'], 'handle': m['handle'], 'items': items}, True)['menuCreate']
        if check(d, m['handle']):
            print('  menu', m['handle'])

STEP_FUNCS = {'collections': collections, 'products': products, 'files': files, 'publish': publish, 'pages': pages, 'blog': blog, 'menus': menus}
for step in STEPS:
    print('==', step)
    STEP_FUNCS[step]()
print('done')
