import 'server-only';
import { JWT } from 'google-auth-library';
import { COLLECTIONS, type Collection, type Tournament } from '../types';
import { ConflictError, FIELDS, type Store } from './types';

const META = 'Meta';

/** Google Sheets store using a service account and the Sheets REST API (v4). */
export function sheetsStore(): Store {
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  const base = (process.env.GOOGLE_SHEETS_API_BASE || 'https://sheets.googleapis.com/v4') + '/spreadsheets/' + encodeURIComponent(sheetId);
  const jwt = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const headers: Partial<Record<Collection, string[]>> = {};
  let tabsReady = false;

  async function api<T>(pathAndQuery: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    // GOOGLE_SHEETS_TEST_TOKEN is only for local testing against a fake Sheets server.
    const token = process.env.GOOGLE_SHEETS_TEST_TOKEN || (await jwt.getAccessToken()).token;
    const res = await fetch(base + pathAndQuery, {
      method: init.method || 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Google Sheets API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<T>;
  }

  async function ensureTabs() {
    if (tabsReady) return;
    const meta = await api<{ sheets: { properties: { title: string } }[] }>('?fields=sheets.properties(sheetId,title)');
    const titles = new Set(meta.sheets.map(s => s.properties.title));
    const missing = [...COLLECTIONS.map(c => FIELDS[c].sheet), META].filter(t => !titles.has(t));
    if (missing.length) {
      const added = await api<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>(':batchUpdate', {
        method: 'POST',
        body: { requests: missing.map(title => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) },
      });
      // Plain-text cells so dates such as 2026-10-19 and times such as 10:30 are not auto-converted.
      await api(':batchUpdate', {
        method: 'POST',
        body: {
          requests: added.replies.map(r => ({
            repeatCell: {
              range: { sheetId: r.addSheet.properties.sheetId },
              cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
              fields: 'userEnteredFormat.numberFormat',
            },
          })),
        },
      });
      const data = missing.map(title => {
        if (title === META) return { range: `${META}!A1:B2`, values: [['revision', 0], ['updatedAt', '']] };
        const c = COLLECTIONS.find(x => FIELDS[x].sheet === title)!;
        return { range: `${title}!A1`, values: [FIELDS[c].fields] };
      });
      await api('/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data } });
    }
    tabsReady = true;
  }

  async function readRevision() {
    const r = await api<{ values?: string[][] }>(`/values/${META}!B1?valueRenderOption=UNFORMATTED_VALUE`);
    return Number(r.values?.[0]?.[0]) || 0;
  }

  return {
    name: 'google-sheets',
    async load() {
      await ensureTabs();
      const ranges = [...COLLECTIONS.map(c => FIELDS[c].sheet), `${META}!B1`].map(r => 'ranges=' + encodeURIComponent(r)).join('&');
      const res = await api<{ valueRanges: { values?: unknown[][] }[] }>(`/values:batchGet?${ranges}&valueRenderOption=FORMATTED_VALUE`);
      const data = {} as Tournament;
      COLLECTIONS.forEach((c, i) => {
        const def = FIELDS[c];
        const [head = [], ...rows] = res.valueRanges[i].values || [];
        const header = head.map(h => String(h).trim());
        headers[c] = [...header, ...def.fields.filter(f => !header.includes(f))];
        const keyIdx = header.indexOf(def.key);
        (data as unknown as Record<string, unknown[]>)[c] = rows
          .filter(r => keyIdx >= 0 && String(r[keyIdx] ?? '').trim() !== '')
          .map(r => {
            const item: Record<string, unknown> = {};
            headers[c]!.forEach((h, j) => {
              if (!h) return;
              const v = r[j] === undefined || r[j] === null ? '' : String(r[j]);
              item[h] = def.numeric.includes(h) ? (v === '' ? (h === 'sourceSheet' ? '' : 0) : Number(v)) : v;
            });
            return item;
          });
      });
      return { data, revision: Number(res.valueRanges[COLLECTIONS.length].values?.[0]?.[0]) || 0 };
    },
    async write(data, changed, expectedRevision) {
      await ensureTabs();
      const current = await readRevision();
      if (current !== expectedRevision) throw new ConflictError('Revision changed');
      const revision = current + 1;
      const tabs = changed.map(c => {
        const header = headers[c] || FIELDS[c].fields;
        const rows = (data[c] as unknown as Record<string, unknown>[]).map(item =>
          header.map(h => (item[h] === undefined || item[h] === null ? '' : (item[h] as string | number))));
        return { c, header, rows };
      });
      await api('/values:batchClear', { method: 'POST', body: { ranges: tabs.map(t => `${FIELDS[t.c].sheet}!A2:ZZ`) } });
      await api('/values:batchUpdate', {
        method: 'POST',
        body: {
          valueInputOption: 'RAW',
          data: [
            ...tabs.map(t => ({ range: `${FIELDS[t.c].sheet}!A1`, values: [t.header, ...t.rows] })),
            { range: `${META}!A1:B2`, values: [['revision', revision], ['updatedAt', new Date().toISOString()]] },
          ],
        },
      });
      return revision;
    },
  };
}
