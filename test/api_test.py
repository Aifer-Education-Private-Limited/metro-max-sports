"""API smoke test: python3 test/api_test.py http://localhost:3000 ADMIN_KEY"""
import json, sys, urllib.request, urllib.error, http.cookiejar

B, KEY = sys.argv[1], sys.argv[2]
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def req(method, path, body=None):
    r = urllib.request.Request(B + path, method=method, data=None if body is None else json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    try:
        with op.open(r) as res: last[0] = (res.status, json.loads(res.read()))
    except urllib.error.HTTPError as e: last[0] = (e.code, json.loads(e.read()))
    return last[0]

last = [None]
def ok(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg + ('' if cond else f'  (last response: {str(last[0])[:300]})'))
    if not cond: sys.exit(1)

def state(): return req('GET', '/api/tournament?fresh=1')[1]['data']
def find(d, mid): return next(m for m in d['matches'] if m['id'] == mid)

ok(req('POST', '/api/players', {'name': 'x'})[0] == 401, 'write without login is rejected')
ok(req('POST', '/api/auth', {'key': KEY})[0] == 200, 'login')
snap = req('GET', '/api/tournament?fresh=1')[1]
if snap['empty']: ok(req('POST', '/api/admin/seed')[0] == 200, 'seed')
ok(req('POST', '/api/admin/seed')[0] == 409, 'seed refused when data exists')
d = state()
pids = {p['id'] for p in d['players']}
m2 = next(m for m in d['matches'] if m['p1'].startswith('winner:') and (lambda x: x['p1'] in pids and x['p2'] in pids)(find(d, m['p1'][7:])))
x = find(d, m2['p1'][7:])
s, r = req('PUT', '/api/matches/' + x['id'], {**x, 'status': 'completed', 'winner': x['p1'], 'score': '21-10'})
ok(s == 200 and find(r['data'], x['id'])['winner'] == x['p1'], 'record result')
m2 = find(r['data'], m2['id'])
other = m2['p2'] if m2['p2'] in pids else ''
if other:
    s, r = req('PUT', '/api/matches/' + m2['id'], {**m2, 'status': 'completed', 'winner': x['p1']})
    ok(s == 200 and find(r['data'], m2['id'])['status'] == 'completed', 'record next-round result via winner slot')
    s, r = req('PUT', '/api/matches/' + x['id'], {**find(r['data'], x['id']), 'winner': x['p2']})
    ok(s == 200 and find(r['data'], m2['id'])['winner'] == '' and find(r['data'], m2['id'])['status'] == 'scheduled', 'changing a winner clears dependent results')
ok(req('DELETE', '/api/matches/' + x['id'])[0] == 409, 'cannot delete a match that feeds another round')
ok(req('PUT', '/api/matches/' + x['id'], {**x, 'status': 'nope'})[0] == 400, 'invalid status rejected')
ok(req('PUT', '/api/matches/' + x['id'], {**x, 'status': 'completed', 'winner': ''})[0] == 400, 'completed without winner rejected')

s, r = req('POST', '/api/matches', {'sport': 'Chess', 'category': 'Test Cat', 'round': 'Final', 'roundOrder': 1, 'date': '2026-10-20', 'time': '10:30', 'venue': 'Hall', 'p1': x['p1'], 'p2': x['p2'], 'status': 'scheduled'})
ok(s == 200, 'create match')
nm = r['data']['matches'][-1]
ok(nm['id'].startswith('custom-') and nm['date'] == '2026-10-20' and nm['time'] == '10:30', 'created match keeps date/time text')
s, r = req('PUT', '/api/matches/' + nm['id'], {**nm, 'venue': 'Court 2'})
ok(s == 200 and find(r['data'], nm['id'])['venue'] == 'Court 2', 'update match')
ok(req('DELETE', '/api/matches/' + nm['id'])[0] == 200 and all(m['id'] != nm['id'] for m in state()['matches']), 'delete match')

s, r = req('POST', '/api/players', {'name': 'Zed Tester', 'flat': '9Z', 'team': 'BI'})
pid = r['data']['players'][-1]['id']
ok(s == 200, 'create player')
s, r = req('PUT', '/api/players/' + pid, {'name': 'Zed Renamed', 'flat': '9Z', 'team': 'GL'})
ok(s == 200 and next(p for p in r['data']['players'] if p['id'] == pid)['name'] == 'Zed Renamed', 'update player')
ok(req('PUT', '/api/players/' + pid, {'name': '', 'team': 'GL'})[0] == 400, 'blank player name rejected')
ok(req('PUT', '/api/players/' + pid, {'name': 'a', 'team': 'XX'})[0] == 400, 'bad team rejected')
ok(req('DELETE', '/api/players/' + pid)[0] == 200, 'delete player')
victim = x['p1']
s, r = req('DELETE', '/api/players/' + victim)
xm = find(r['data'], x['id'])
ok(s == 200 and victim not in (xm['p1'], xm['p2'], xm['winner']), 'deleting a player clears their match slots')

s, r = req('POST', '/api/awards', {'sport': 'Chess', 'category': 'U12', 'team': 'BI', 'place': 'Champion', 'points': 10})
aid = r['data']['awards'][-1]['id']
ok(s == 200, 'create award')
s, r = req('PUT', '/api/awards/' + aid, {'sport': 'Chess', 'category': 'U12', 'team': 'GL', 'place': 'Runner-up', 'points': 5})
ok(s == 200 and r['data']['awards'][-1]['points'] == 5, 'update award')
ok(req('DELETE', '/api/awards/' + aid)[0] == 200, 'delete award')

ok(req('POST', '/api/rules', {'place': 'Semi-finalist', 'points': 2})[0] == 200, 'create rule')
ok(req('POST', '/api/rules', {'place': 'Semi-finalist', 'points': 3})[0] == 409, 'duplicate rule rejected')
s, r = req('PUT', '/api/rules/Semi-finalist', {'place': 'Semi final', 'points': 3})
ok(s == 200 and any(x['place'] == 'Semi final' and x['points'] == 3 for x in r['data']['rules']), 'rename/update rule')
ok(req('DELETE', '/api/rules/' + urllib.request.quote('Semi final'))[0] == 200, 'delete rule')

backup = state()
ok(req('POST', '/api/admin/restore', {'players': 1})[0] == 400, 'invalid restore rejected')
s, r = req('POST', '/api/admin/restore', backup)
ok(s == 200 and len(r['data']['matches']) == len(backup['matches']), 'restore backup')
req('DELETE', '/api/auth')
ok(req('POST', '/api/rules', {'place': 'x', 'points': 1})[0] == 401, 'logout revokes write access')
print('ALL API CHECKS PASSED')
