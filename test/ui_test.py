"""Browser smoke test: python3 test/ui_test.py http://localhost:3000 ADMIN_KEY [screenshot_dir]"""
import sys, time
from playwright.sync_api import sync_playwright, expect

B, KEY = sys.argv[1], sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else '/tmp'
errors = []
TAG = str(int(time.time()))
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={'width': 1366, 'height': 900})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('dialog', lambda d: d.accept())
    for path, text in [('/', 'Welcome to SportsFest'), ('/matches', 'All Matches'), ('/official', 'Official Fixtures'), ('/sports', 'Sports'),
                       ('/players', 'Players'), ('/results', 'Results'), ('/points', 'Team Points'), ('/admin', 'Tournament Admin')]:
        pg.goto(B + path)
        expect(pg.locator('h1')).to_contain_text(text)
        print('PASS page', path)
    pg.goto(B + '/')
    pg.wait_for_selector('#brand-loader', state='detached')
    pg.screenshot(path=f'{OUT}/home.png', full_page=False)
    pg.goto(B + '/sports'); pg.wait_for_selector('.bracketmatch'); pg.screenshot(path=f'{OUT}/sports.png')
    pg.goto(B + '/players'); pg.locator('a.playerlink').first.click()
    expect(pg.locator('h1')).to_contain_text('Player Profile'); print('PASS player profile link')

    pg.goto(B + '/admin')
    pg.fill('input[name=key]', 'wrong'); pg.click('button[type=submit]')
    expect(pg.locator('p[role=alert]')).to_contain_text('Invalid'); print('PASS wrong key rejected')
    pg.fill('input[name=key]', KEY); pg.click('button[type=submit]')
    expect(pg.locator('h1')).to_contain_text('Tournament Admin')
    expect(pg.get_by_role('button', name='Sign out')).to_be_visible(); print('PASS admin login')
    if pg.get_by_role('button', name='Load the built-in schedule').count():
        pg.get_by_role('button', name='Load the built-in schedule').click()
        expect(pg.get_by_role('button', name='Load the built-in schedule')).to_have_count(0); print('PASS seed via UI')

    pg.get_by_role('button', name='Participants').click()
    pg.get_by_role('button', name='+ Add participant').click()
    pg.fill('#fixture-editor input[name=name]', f'UI Test Player {TAG}'); pg.fill('#fixture-editor input[name=flat]', '777Q')
    pg.select_option('#fixture-editor select[name=team]', 'GL')
    pg.screenshot(path=f'{OUT}/admin-dialog.png')
    pg.click('#fixture-editor button[type=submit]')
    expect(pg.locator('#fixture-editor')).to_have_count(0)
    pg.fill('input[aria-label="Search participants"]', f'UI Test Player {TAG}')
    expect(pg.locator('tbody tr')).to_have_count(1); print('PASS add participant')
    pg.get_by_role('button', name='Edit / delete').click()
    pg.fill('#fixture-editor input[name=name]', f'UI Renamed Player {TAG}'); pg.click('#fixture-editor button[type=submit]')
    expect(pg.locator('#fixture-editor')).to_have_count(0)
    pg.fill('input[aria-label="Search participants"]', f'UI Renamed Player {TAG}')
    expect(pg.locator('tbody tr')).to_have_count(1); print('PASS edit participant')
    pg.get_by_role('button', name='Edit / delete').click(); pg.get_by_role('button', name='Delete', exact=True).click()
    expect(pg.locator('tbody tr td.empty')).to_have_count(1); print('PASS delete participant')

    pg.get_by_role('button', name='Matches & Results').click()
    pg.fill('input[aria-label="Search matches"]', 'Round 1')
    row = pg.locator('tbody tr').first
    row.get_by_role('button', name='Edit / result').click()
    pg.select_option('#fixture-editor select[name=status]', 'completed')
    opts = pg.locator('#fixture-editor select[name=winner] option').all()
    pg.select_option('#fixture-editor select[name=winner]', opts[1].get_attribute('value'))
    pg.fill('#fixture-editor input[name=score]', '21-3, 21-4')
    pg.click('#fixture-editor button[type=submit]')
    expect(pg.locator('#fixture-editor')).to_have_count(0)
    pg.goto(B + '/results'); expect(pg.locator('.resultrow').filter(has_text='21-3, 21-4')).to_have_count(1); print('PASS record result shows on Results')

    pg.goto(B + '/admin'); pg.get_by_role('button', name='Team Points').click()
    pg.get_by_role('button', name='+ Award points').click()
    pg.fill('#fixture-editor input[name=category]', f'UI Cat {TAG}'); pg.click('#fixture-editor button[type=submit]')
    expect(pg.locator('.resultrow').filter(has_text=f'UI Cat {TAG}')).to_have_count(1); print('PASS award points')
    pg.goto(B + '/points'); expect(pg.locator('td').filter(has_text=f'UI Cat {TAG}')).to_have_count(1)
    pg.screenshot(path=f'{OUT}/points.png'); print('PASS points page reflects award')
    pg.goto(B + '/admin'); pg.get_by_role('button', name='Team Points').click()
    pg.locator('.resultrow').filter(has_text=f'UI Cat {TAG}').get_by_role('button', name='Edit / remove').click()
    pg.get_by_role('button', name='Delete', exact=True).click()
    expect(pg.locator('.resultrow').filter(has_text=f'UI Cat {TAG}')).to_have_count(0); print('PASS remove award')

    m = br.new_page(viewport={'width': 390, 'height': 844}); m.goto(B + '/'); m.wait_for_selector('#brand-loader', state='detached')
    m.screenshot(path=f'{OUT}/mobile.png')
    br.close()
errors = [e for e in errors if '401' not in e]
print('console errors:', errors)
if errors: sys.exit(1)
print('ALL UI CHECKS PASSED')
