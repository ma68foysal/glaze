"""Run a GraphQL file against a store with the Shopify CLI and return the result.
usage (CLI): gql.py <store-subdomain> <query.graphql> [variables.json] [--mutate] > out.json
As a module: run(store, query_text, variables=None, mutate=False) -> dict"""
import json, os, subprocess, sys, tempfile

def run(store, query, variables=None, mutate=False):
    with tempfile.TemporaryDirectory() as tmp:
        qf = os.path.join(tmp, 'q.graphql')
        open(qf, 'w', encoding='utf-8').write(query)
        cmd = ['shopify.cmd', 'store', 'execute', '--store', store + '.myshopify.com', '--query-file', qf, '--json', '--no-input']
        if variables is not None:
            vf = os.path.join(tmp, 'v.json')
            json.dump(variables, open(vf, 'w', encoding='utf-8'))
            cmd += ['--variable-file', vf]
        if mutate:
            cmd.append('--allow-mutations')
        out = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600).stdout
    # Progress events are one-line JSON objects; the result is the rest (often pretty-printed).
    body = chr(10).join(l for l in out.splitlines() if not l.lstrip().startswith('{"type":"progress"'))
    start, end = body.find('{'), body.rfind('}')
    if start == -1:
        raise RuntimeError('No result from CLI: ' + out[-2000:])
    result = json.loads(body[start:end + 1])
    return result

if __name__ == '__main__':
    store, qpath = sys.argv[1], sys.argv[2]
    variables = json.load(open(sys.argv[3], encoding='utf-8')) if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else None
    res = run(store, open(qpath, encoding='utf-8').read(), variables, '--mutate' in sys.argv)
    print(json.dumps(res, ensure_ascii=False, indent=1))
