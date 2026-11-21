# Authorise the Shopify CLI on a demo store with the scopes the clone tools need.
# usage: .\auth.ps1 <store-subdomain>
param([Parameter(Mandatory)][string]$Store)
$scopes = 'read_products,write_products,read_publications,write_publications,read_files,write_files,read_themes,write_themes,read_content,write_content,read_online_store_navigation,write_online_store_navigation,read_inventory,write_inventory,read_locations,read_metaobjects,write_metaobjects,read_metaobject_definitions,write_metaobject_definitions'
shopify.cmd store auth --store "$Store.myshopify.com" --scopes $scopes
