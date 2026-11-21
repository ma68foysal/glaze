"""Copy the Oblique demo catalogue (catalogue.json, from export_catalogue.py) to another demo store.
usage: copy_catalogue.py <target-subdomain> [step ...]
steps: colors products fabric publish   (default: all, in that order)

- colors:   enables the standard shopify--color-pattern metaobject and shopify.color-pattern
            metafield, then upserts the colour entries by handle.
- products: productSet per product, matched by handle. Existing products first get their
            old photos detached (fileUpdate referencesToRemove; the files stay in Files).
            Sets category, options, variants (prices, SKUs, stock, variant photos), photos,
            collections and every metafield except fabric_image.
- fabric:   custom.fabric_image -> the target store's copy of the same photo (same position).
- publish:  publishes every copied product to the Online Store.
Nothing is deleted. State (product GIDs, done handles) goes to copy-state-<store>.json."""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gql import run

HERE = os.path.dirname(os.path.abspath(__file__))
STORE = sys.argv[1]
STEPS = sys.argv[2:] or ['colors', 'products', 'fabric', 'publish']
SRC = json.load(open(os.path.join(HERE, 'catalogue.json'), encoding='utf-8'))
STATE_PATH = os.path.join(HERE, 'copy-state-%s.json' % STORE)
state = json.load(open(STATE_PATH)) if os.path.exists(STATE_PATH) else {'products': {}, 'fabric': {}}
def save(): json.dump(state, open(STATE_PATH, 'w'), indent=1)
SKIP_MF = {('custom', 'fabric_image')} | {('custom', k) for k in ('care_wash_30', 'care_wash_hand', 'care_no_bleach', 'care_no_tumble', 'care_iron_low', 'care_dry_flat', 'care_dry_clean', 'care_no_dry_clean')}
clean = lambda url: url.split('?')[0]
log = lambda *a: print(*a, flush=True)

def gql(query, variables=None, mutate=False, tries=3):
    for i in range(tries):
        try:
            res = run(STORE, query, variables, mutate)
        except Exception as e:
            if i == tries - 1: raise
            log('  retry after', str(e)[:200]); time.sleep(5); continue
        if res.get('errors') or 'error' in res:
            msg = json.dumps(res.get('errors') or res.get('error'))[:1500]
            if 'THROTTLED' in msg and i < tries - 1:
                time.sleep(10); continue
            raise RuntimeError(msg)
        return res.get('data', res)

def errs(payload, label):
    e = payload.get('userErrors') or []
    if e: log('  !', label, e)
    return e

# ---------------------------------------------------------------- colours
def colors():
    d = gql('mutation { standardMetaobjectDefinitionEnable(type: "shopify--color-pattern") { metaobjectDefinition { id } userErrors { field message code } } }', None, True)
    errs(d['standardMetaobjectDefinitionEnable'], 'metaobject definition')
    d = gql('mutation { standardMetafieldDefinitionEnable(ownerType: PRODUCT, namespace: "shopify", key: "color-pattern", pin: false) { createdDefinition { id } userErrors { field message code } } }', None, True)
    errs(d['standardMetafieldDefinitionEnable'], 'metafield definition')
    ids = {}
    for m in SRC['colors']:
        fields = [{'key': f['key'], 'value': f['value']} for f in m['fields'] if f['value'] is not None]
        d = gql('''mutation($h: MetaobjectHandleInput!, $m: MetaobjectUpsertInput!) { metaobjectUpsert(handle: $h, metaobject: $m) {
                   metaobject { id handle } userErrors { field message code } } }''',
                {'h': {'type': 'shopify--color-pattern', 'handle': m['handle']},
                 'm': {'fields': fields}}, True)['metaobjectUpsert']
        if not errs(d, m['handle']):
            ids[m['handle']] = d['metaobject']['id']
    state['colors'] = ids; save()
    log('  colours', len(ids))

# ---------------------------------------------------------------- products
def target_products():
    out, after = {}, None
    while True:
        d = gql('''query($a: String) { products(first: 100, after: $a) { pageInfo { hasNextPage endCursor }
                   nodes { id handle media(first: 20) { nodes { id } } } } }''', {'a': after})['products']
        for n in d['nodes']: out[n['handle']] = n
        if not d['pageInfo']['hasNextPage']: return out
        after = d['pageInfo']['endCursor']

def products():
    colors_ids = state.get('colors') or {}
    meta = gql('{ locations(first: 5) { nodes { id } } collections(first: 50) { nodes { id handle } } }')
    loc = meta['locations']['nodes'][0]['id']
    cols = {c['handle']: c['id'] for c in meta['collections']['nodes']}
    have = target_products()
    for p in SRC['products']:
        h = p['handle']
        if os.environ.get('ONLY') and h not in os.environ['ONLY'].split(','):
            continue
        if h in state['products'] and state['products'][h].get('done'):
            continue
        existing = have.get(h)
        # detach the old photos (files stay in Files)
        if existing and existing['media']['nodes'] and not state['products'].get(h, {}).get('detached'):
            pid = existing['id']
            body = ' '.join('f%d: fileUpdate(files: [{id: "%s", referencesToRemove: ["%s"]}]) { userErrors { field message } }' % (i, m['id'], pid)
                            for i, m in enumerate(existing['media']['nodes']))
            d = gql('mutation { %s }' % body, None, True)
            for k, v in d.items(): errs(v, h + ' detach ' + k)
            state['products'].setdefault(h, {})['detached'] = True; save()

        src_urls = [clean(m['image']['url']) for m in p['media']['nodes'] if m.get('image')]
        files = [{'originalSource': u, 'alt': m.get('alt') or p['title'], 'contentType': 'IMAGE'}
                 for u, m in zip(src_urls, [m for m in p['media']['nodes'] if m.get('image')])]
        alt_of = {f['originalSource']: f['alt'] for f in files}
        variants = []
        for v in p['variants']['nodes']:
            var = {'optionValues': [{'optionName': s['name'], 'name': s['value']} for s in v['selectedOptions']],
                   'price': v['price'], 'taxable': v['taxable'], 'inventoryPolicy': v['inventoryPolicy'],
                   'inventoryItem': {'tracked': v['inventoryItem']['tracked'], 'requiresShipping': v['inventoryItem']['requiresShipping']}}
            for k in ('sku', 'barcode', 'compareAtPrice'):
                if v.get(k): var[k] = v[k]
            if v['inventoryItem']['tracked'] and not existing:
                var['inventoryQuantities'] = [{'locationId': loc, 'name': 'available', 'quantity': max(v['inventoryQuantity'] or 0, 0)}]
            if v.get('image'):
                u = clean(v['image']['url'])
                var['file'] = {'originalSource': u, 'alt': alt_of.get(u, p['title']), 'contentType': 'IMAGE'}
            variants.append(var)
        mfs = []
        for m in p['metafields']['nodes']:
            if (m['namespace'], m['key']) in SKIP_MF: continue
            if m['namespace'] == 'shopify' and m['key'] == 'color-pattern':
                refs = [n['handle'] for n in m['references']['nodes']]
                missing = [r for r in refs if r not in colors_ids]
                if missing: log('  ! colour missing', h, missing); continue
                mfs.append({'namespace': 'shopify', 'key': 'color-pattern', 'type': m['type'], 'value': json.dumps([colors_ids[r] for r in refs])})
            elif m['namespace'] == 'shopify':
                continue
            else:
                mfs.append({'namespace': m['namespace'], 'key': m['key'], 'type': m['type'], 'value': m['value']})
        inp = {'title': p['title'], 'handle': h, 'status': 'ACTIVE', 'vendor': p['vendor'], 'productType': p['productType'],
               'tags': p['tags'], 'descriptionHtml': p['descriptionHtml'],
               'collections': [cols[c['handle']] for c in p['collections']['nodes'] if c['handle'] in cols],
               'productOptions': [{'name': o['name'], 'position': o['position'], 'values': [{'name': v['name']} for v in o['optionValues']]} for o in p['options']],
               'variants': variants, 'files': files, 'metafields': mfs}
        if p.get('seo') and (p['seo'].get('title') or p['seo'].get('description')):
            inp['seo'] = {k: v for k, v in p['seo'].items() if v}
        if p.get('category'): inp['category'] = p['category']['id']
        if existing: inp['id'] = existing['id']
        d = gql('''mutation($input: ProductSetInput!) { productSet(input: $input, synchronous: true) {
                   product { id handle media(first: 20) { nodes { id } } } userErrors { field message code } } }''', {'input': inp}, True)['productSet']
        if errs(d, h) or not d.get('product'):
            continue
        pr = d['product']
        state['products'][h] = {'id': pr['id'], 'done': True, 'media': [m['id'] for m in pr['media']['nodes']], 'updated': bool(existing)}
        save()
        log('  %s %s (%d photos, src %d)' % ('updated' if existing else 'created', h, len(pr['media']['nodes']), len(src_urls)))

# ---------------------------------------------------------------- fabric_image -> same photo position in the target
def fabric():
    sets = []
    for p in SRC['products']:
        h = p['handle']
        st = state['products'].get(h)
        fm = next((m for m in p['metafields']['nodes'] if m['namespace'] == 'custom' and m['key'] == 'fabric_image'), None)
        if not st or not fm or not fm.get('reference'): continue
        src_urls = [clean(m['image']['url']) for m in p['media']['nodes'] if m.get('image')]
        try:
            idx = src_urls.index(clean(fm['reference']['image']['url']))
        except ValueError:
            log('  ! fabric photo not among product photos', h); continue
        media = gql('query($id: ID!) { product(id: $id) { media(first: 20) { nodes { id } } } }', {'id': st['id']})['product']['media']['nodes']
        if len(media) != len(src_urls):
            log('  ! photo count differs', h, len(media), len(src_urls)); continue
        sets.append({'ownerId': st['id'], 'namespace': 'custom', 'key': 'fabric_image', 'type': 'file_reference', 'value': media[idx]['id']})
    for i in range(0, len(sets), 25):
        d = gql('mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { metafields { id } userErrors { field message } } }', {'m': sets[i:i + 25]}, True)['metafieldsSet']
        errs(d, 'fabric batch %d' % i)
    log('  fabric_image set on', len(sets))

# ---------------------------------------------------------------- publish
def publish():
    pubs = {n['name']: n['id'] for n in gql('{ publications(first: 10) { nodes { id name } } }')['publications']['nodes']}
    online = pubs['Online Store']
    ids = [st['id'] for st in state['products'].values() if st.get('id')]
    for i in range(0, len(ids), 20):
        body = ' '.join('p%d: publishablePublish(id: "%s", input: [{publicationId: "%s"}]) { userErrors { field message } }' % (j, gid, online) for j, gid in enumerate(ids[i:i + 20]))
        d = gql('mutation { %s }' % body, None, True)
        for k, v in d.items(): errs(v, k)
    log('  published', len(ids))

FUNCS = {'colors': colors, 'products': products, 'fabric': fabric, 'publish': publish}
for s in STEPS:
    log('==', s)
    FUNCS[s]()
log('done')
