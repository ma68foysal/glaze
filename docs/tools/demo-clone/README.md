# Demo store clone

Copies the Oblique demo store's catalogue and content to another development
store, so each preset's demo store matches the original. Not shipped with the
theme.

1. Authorise the CLI on both stores (the scopes cover products, files, themes,
   pages, blog content, menus and inventory):

   ```
   shopify store auth --store <store>.myshopify.com --scopes read_products,write_products,read_publications,write_publications,read_files,write_files,read_themes,write_themes,read_content,write_content,read_online_store_navigation,write_online_store_navigation,read_inventory,write_inventory,read_locations
   ```

2. Export from the Oblique store (set `PYTHONIOENCODING=utf-8` on Windows):

   ```
   python gql.py skinova-hveyg6a1 export-products.graphql > products.json
   python gql.py skinova-hveyg6a1 export-collections.graphql > collections.json
   python gql.py skinova-hveyg6a1 export-content.graphql > content.json
   ```

3. Recreate on the target store: `python clone.py <target-subdomain>`.
   Steps run in order (collections, products, files, publish, pages, blog,
   menus) and skip anything that already exists. Products come before the
   theme photos so their images keep the original filenames the theme's
   `shopify://shop_images/...` settings point to. `clone.py` reads those
   references from the demo theme copy in `../demo-theme`; point it elsewhere
   if the copy lives somewhere else.

Only published blog articles are copied. The store name, payments (Bogus
Gateway) and the storefront password are admin settings the API can't change.
