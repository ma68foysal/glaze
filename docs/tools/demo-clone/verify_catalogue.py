"""Compare a demo store's catalogue with catalogue.json (the Oblique export).
usage: verify_catalogue.py <target-subdomain>
Checks per product: active, vendor, category, photo count and READY status, collections,
custom metafields, colour entries (by handle), fabric_image pointing at one of the product's
own photos in the same position, variant count, and Online Store publication."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gql import run
HERE = os.path.dirname(os.path.abspath(__file__))
STORE = sys.argv[1]
SRC = {p['handle']: p for p in json.load(open(os.path.join(HERE, 'catalogue.json'), encoding='utf-8'))['products']}
clean = lambda u: u.split('?')[0]

def q(query, v=None):
    r = run(STORE, query, v)
    if r.get('errors') or 'error' in r: raise RuntimeError(json.dumps(r)[:1500])
    return r.get('data', r)

online = next(n['id'] for n in q('{ publications(first: 10) { nodes { id name } } }')['publications']['nodes'] if n['name'] == 'Online Store')
Q = '''query($a: String, $pub: ID!) { products(first: 10, after: $a) { pageInfo { hasNextPage endCursor } nodes {
  handle status vendor category { id } publishedOnPublication(publicationId: $pub) variantsCount { count }
  media(first: 15) { nodes { id status } } collections(first: 15) { nodes { handle } }
  metafields(first: 20) { nodes { namespace key value reference { ... on MediaImage { id } }
    references(first: 15) { nodes { ... on Metaobject { handle } } } } } } } }'''
tgt, after = {}, None
while True:
    d = q(Q, {'a': after, 'pub': online})['products']
    for n in d['nodes']: tgt[n['handle']] = n
    if not d['pageInfo']['hasNextPage']: break
    after = d['pageInfo']['endCursor']

problems, ok = [], 0
for h, s in SRC.items():
    t = tgt.get(h)
    if not t: problems.append((h, 'missing')); continue
    bad = []
    if t['status'] != 'ACTIVE': bad.append('status ' + t['status'])
    if t['vendor'] != s['vendor']: bad.append('vendor ' + t['vendor'])
    if (t['category'] or {}).get('id') != (s['category'] or {}).get('id'): bad.append('category')
    if not t['publishedOnPublication']: bad.append('not on Online Store')
    if t['variantsCount']['count'] != len(s['variants']['nodes']): bad.append('variants %d/%d' % (t['variantsCount']['count'], len(s['variants']['nodes'])))
    src_media = [clean(m['image']['url']) for m in s['media']['nodes'] if m.get('image')]
    tm = t['media']['nodes']
    if len(tm) != len(src_media): bad.append('photos %d/%d' % (len(tm), len(src_media)))
    if any(m['status'] != 'READY' for m in tm): bad.append('photo status ' + ','.join(m['status'] for m in tm))
    if sorted(c['handle'] for c in t['collections']['nodes']) != sorted(c['handle'] for c in s['collections']['nodes']): bad.append('collections')
    tmf = {(m['namespace'], m['key']): m for m in t['metafields']['nodes']}
    for m in s['metafields']['nodes']:
        k = (m['namespace'], m['key'])
        if k[0] == 'custom' and k[1].startswith('care_'): continue
        if k[0] not in ('custom', 'shopify') or (k[0] == 'shopify' and k[1] != 'color-pattern'): continue
        x = tmf.get(k)
        if not x: bad.append('no ' + '.'.join(k)); continue
        if k == ('custom', 'fabric_image'):
            idx = src_media.index(clean(m['reference']['image']['url']))
            if not x.get('reference') or idx >= len(tm) or x['reference']['id'] != tm[idx]['id']: bad.append('fabric_image')
        elif k == ('shopify', 'color-pattern'):
            if [n['handle'] for n in x['references']['nodes']] != [n['handle'] for n in m['references']['nodes']]: bad.append('colours')
        elif x['value'] != m['value']: bad.append('value ' + '.'.join(k))
    if bad: problems.append((h, bad))
    else: ok += 1
others = sorted((h, t['status']) for h, t in tgt.items() if h not in SRC)
print('%s: %d of %d Oblique products match; %d active products in store' % (STORE, ok, len(SRC), sum(t['status'] == 'ACTIVE' for t in tgt.values())))
for p in problems: print('  !', p)
if others: print('  other products:', others)
