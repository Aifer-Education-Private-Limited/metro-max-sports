"""Minimal in-memory stand-in for the Google Sheets v4 REST endpoints used by lib/store/sheets.ts (testing only)."""
import json, re, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

sheets = {}  # title -> list of rows
ids = {}
calls = []

def parse_range(r):
    r = unquote(r)
    title, _, a1 = r.partition('!')
    if not a1: return title, 0, 0, None, None
    m = re.match(r'([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$', a1)
    col = lambda s: sum((ord(c) - 64) * 26 ** i for i, c in enumerate(reversed(s))) - 1
    return title, int(m.group(2) or 1) - 1, col(m.group(1)), (int(m.group(4)) if m.group(4) else None), (col(m.group(3)) if m.group(3) else None)

def get(r):
    t, r0, c0, r1, c1 = parse_range(r)
    rows = sheets.get(t, [])[r0:r1]
    out = [[str(v) for v in row[c0:(c1 + 1 if c1 is not None else None)]] for row in rows]
    while out and not any(out[-1]): out.pop()
    return out

def put(r, values):
    t, r0, c0, _, _ = parse_range(r)
    rows = sheets.setdefault(t, [])
    for i, row in enumerate(values):
        while len(rows) <= r0 + i: rows.append([])
        target = rows[r0 + i]
        while len(target) < c0 + len(row): target.append('')
        for j, v in enumerate(row): target[c0 + j] = v

def clear(r):
    t, r0, _, _, _ = parse_range(r)
    sheets[t] = sheets.get(t, [])[:r0]

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query); calls.append('GET ' + u.path)
        if self.headers.get('Authorization') != 'Bearer test-token': return self.send({'error': 'auth'}, 401)
        if u.path.endswith('/values:batchGet'): return self.send({'valueRanges': [{'range': r, 'values': get(r)} for r in q['ranges']]})
        m = re.search(r'/values/(.+)$', u.path)
        if m: return self.send({'values': get(m.group(1))})
        if u.path == '/__dump': return self.send(sheets)
        return self.send({'sheets': [{'properties': {'title': t, 'sheetId': ids[t]}} for t in sheets]})
    def do_POST(self):
        u = urlparse(self.path); body = json.loads(self.rfile.read(int(self.headers['Content-Length'] or 0)) or b'{}'); calls.append('POST ' + u.path)
        if self.headers.get('Authorization') != 'Bearer test-token': return self.send({'error': 'auth'}, 401)
        if u.path.endswith('/values:batchUpdate'):
            assert body['valueInputOption'] == 'RAW'
            for d in body['data']: put(d['range'], d['values'])
            return self.send({})
        if u.path.endswith('/values:batchClear'):
            for r in body['ranges']: clear(r)
            return self.send({})
        if u.path.endswith(':batchUpdate'):
            replies = []
            for rq in body['requests']:
                if 'addSheet' in rq:
                    t = rq['addSheet']['properties']['title']; sheets[t] = []; ids[t] = len(ids) + 1
                    replies.append({'addSheet': {'properties': {'title': t, 'sheetId': ids[t]}}})
                else: replies.append({})
            return self.send({'replies': replies})
        self.send({'error': 'unknown'}, 404)

ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
