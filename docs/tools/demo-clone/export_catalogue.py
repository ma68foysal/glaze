"""Export the Oblique demo catalogue (active products with metafields, colour entries) to catalogue.json.
usage: export_catalogue.py [source-subdomain]   (default skinova-hveyg6a1)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gql import run
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else 'skinova-hveyg6a1'
Q = '''query($after: String) { products(first: 8, after: $after, query: "status:active", sortKey: CREATED_AT) {
  pageInfo { hasNextPage endCursor }
  nodes {
    handle title descriptionHtml vendor productType tags templateSuffix
    seo { title description }
    category { id fullName }
    options { name position linkedMetafield { namespace key } optionValues { name linkedMetafieldValue } }
    variants(first: 40) { nodes { price compareAtPrice sku barcode taxable inventoryPolicy
      selectedOptions { name value } inventoryQuantity inventoryItem { tracked requiresShipping }
      image { url } } }
    media(first: 12) { nodes { alt ... on MediaImage { image { url } } } }
    collections(first: 15) { nodes { handle } }
    metafields(first: 20) { nodes { namespace key type value
      reference { ... on MediaImage { image { url } } ... on Metaobject { handle type } }
      references(first: 15) { nodes { ... on Metaobject { handle type } } } } }
  } } }'''
def q(query, v=None):
    r = run(SRC, query, v)
    if r.get('errors') or 'error' in r: raise RuntimeError(json.dumps(r)[:1500])
    return r.get('data', r)
products, after = [], None
while True:
    d = q(Q, {'after': after})['products']
    products += d['nodes']
    if not d['pageInfo']['hasNextPage']: break
    after = d['pageInfo']['endCursor']
mo = q('{ metaobjects(type: "shopify--color-pattern", first: 50) { nodes { handle displayName fields { key type value } } } }')['metaobjects']['nodes']
cols = q('{ collections(first: 30) { nodes { handle title } } }')['collections']['nodes']
json.dump({'products': products, 'colors': mo, 'collections': cols}, open(os.path.join(HERE, 'catalogue.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(products), 'products,', len(mo), 'colours,', len(cols), 'collections')
