'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AwardEditor, MatchEditor, PlayerEditor, RuleEditor, SportEditor } from '@/components/admin/Editors';
import { Header, MatchFilters, SlotLink, tagClass } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { defaultFilter, filterMatches, fmt, playsIn, si, statusLabel, teamName } from '@/lib/tournament';
import type { Award, Match, Player, Rule, Sport, Tournament } from '@/lib/types';

type Tab = 'matches' | 'players' | 'sports' | 'awards' | 'rules' | 'backup';
type Editing =
  | { kind: 'match'; item?: Match } | { kind: 'player'; item?: Player } | { kind: 'sport'; item?: Sport } | { kind: 'award'; item?: Award } | { kind: 'rule'; item?: Rule } | null;

const tabs: [Tab, string][] = [['matches', 'Matches & Results'], ['players', 'Participants'], ['sports', 'Sports'], ['awards', 'Team Points'], ['rules', 'Points Rules'], ['backup', 'Backup & Restore']];

export default function Admin() {
  const { admin, adminConfigured, empty, ready, call, logout, refresh } = useTournament();
  const [tab, setTab] = useState<Tab>('matches');
  const [editing, setEditing] = useState<Editing>(null);
  const [storage, setStorage] = useState('');
  useEffect(() => { fetch('/api/auth').then(r => r.json()).then(b => setStorage(b.storage || '')).catch(() => {}); }, [admin]);
  useEffect(() => { if (admin) refresh(true); }, [admin, refresh]);

  if (!admin) return <Login configured={adminConfigured} />;
  const close = () => setEditing(null);
  return (
    <>
      <Header title="Tournament Admin" sub="Manage participants, fixtures, results and team points." action={<button className="btn secondary" onClick={logout}>Sign out</button>} />
      <div className="notice">
        Signed in as admin · changes are saved to <b>{storage === 'google-sheets' ? 'Google Sheets' : storage === 'file' ? 'the local JSON file (development)' : 'the server'}</b> and are visible to everyone.
      </div>
      {ready && empty && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="sectionhead"><h3>The database is empty</h3></div>
          <p className="muted">The site is showing the built-in Season XVI schedule. Copy it into the database to start editing.</p>
          <button className="btn" onClick={() => call('POST', '/api/admin/seed')}>Load the built-in schedule</button>
        </div>
      )}
      <div className="toolbar">
        {tabs.map(([k, v]) => <button key={k} className={'btn ' + (tab === k ? '' : 'secondary')} onClick={() => setTab(k)}>{v}</button>)}
        <Link href="/admin/fixtures" className="btn secondary">Fixtures</Link>
      </div>
      {tab === 'matches' && <MatchesTab edit={item => setEditing({ kind: 'match', item })} />}
      {tab === 'players' && <PlayersTab edit={item => setEditing({ kind: 'player', item })} />}
      {tab === 'sports' && <SportsTab edit={item => setEditing({ kind: 'sport', item })} />}
      {tab === 'awards' && <AwardsTab edit={item => setEditing({ kind: 'award', item })} />}
      {tab === 'rules' && <RulesTab edit={item => setEditing({ kind: 'rule', item })} />}
      {tab === 'backup' && <BackupTab />}
      {editing?.kind === 'match' && <MatchEditor match={editing.item} onClose={close} />}
      {editing?.kind === 'player' && <PlayerEditor player={editing.item} onClose={close} />}
      {editing?.kind === 'sport' && <SportEditor sport={editing.item} onClose={close} />}
      {editing?.kind === 'award' && <AwardEditor award={editing.item} onClose={close} />}
      {editing?.kind === 'rule' && <RuleEditor rule={editing.item} onClose={close} />}
    </>
  );
}

function Login({ configured }: { configured: boolean }) {
  const { login } = useTournament();
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Header title="Tournament Admin" sub="Sign in to manage participants, fixtures, results and team points." />
      {!configured && <div className="notice">Editing is disabled: set <code>ADMIN_KEY</code> in the server environment.</div>}
      <div className="card" style={{ maxWidth: 480 }}>
        <form className="formgrid" onSubmit={async e => { e.preventDefault(); setBusy(true); setErr((await login(key)) || ''); setBusy(false); }}>
          <label className="field full">Admin key<input className="input" type="password" name="key" value={key} onChange={e => setKey(e.target.value)} required autoComplete="current-password" /></label>
          {err && <p className="mini full" role="alert" style={{ color: '#f36c70' }}>{err}</p>}
          <button className="btn full" type="submit" disabled={busy || !configured}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </>
  );
}

function MatchesTab({ edit }: { edit: (m?: Match) => void }) {
  const { db } = useTournament();
  const [f, setF] = useState(defaultFilter);
  const ms = filterMatches(db, f);
  return (
    <div className="card">
      <div className="sectionhead"><h3>Matches ({ms.length} of {db.matches.length})</h3><button className="btn" onClick={() => edit()}>+ Add match</button></div>
      <MatchFilters db={db} f={f} set={setF} />
      <div className="tablewrap">
        <table className="stack-m">
          <thead><tr><th>Match</th><th>When</th><th>Round</th><th>Status</th><th>Winner</th><th>Action</th></tr></thead>
          <tbody>
            {ms.length ? ms.map(m => (
              <tr key={m.id}>
                <td data-label="Match"><div className="mini">{si(m.sport, db)}{m.sport} · {m.category}</div><SlotLink id={m.p1} /> <span className="muted">vs</span> <SlotLink id={m.p2} /></td>
                <td data-label="When">{fmt(m.date)}<div className="mini">{m.time || 'Time TBD'}</div></td>
                <td data-label="Round">{m.round}</td>
                <td data-label="Status"><span className={tagClass(m.status)}>{statusLabel(m.status)}</span></td>
                <td data-label="Winner">{m.winner ? <SlotLink id={m.winner} /> : '—'}{m.score && <div className="mini">{m.score}</div>}</td>
                <td data-label="Action"><button className="textlink" onClick={() => edit(m)}>Edit / result</button></td>
              </tr>
            )) : <tr><td colSpan={6} className="empty">No matches found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayersTab({ edit }: { edit: (p?: Player) => void }) {
  const { db } = useTournament();
  const [q, setQ] = useState('');
  const ps = db.players.filter(p => [p.name, p.flat, teamName(p.team)].join(' ').toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="card">
      <div className="sectionhead"><h3>Participants / pairs ({db.players.length})</h3><button className="btn" onClick={() => edit()}>+ Add participant</button></div>
      <div className="toolbar"><input className="input" placeholder="🔍 Search by name, flat or team" value={q} onChange={e => setQ(e.target.value)} aria-label="Search participants" /></div>
      <div className="tablewrap">
        <table className="stack-m">
          <thead><tr><th>Name</th><th>Flat</th><th>Team</th><th>Matches</th><th>Action</th></tr></thead>
          <tbody>
            {ps.length ? ps.map(p => (
              <tr key={p.id}>
                <td data-label="Name"><SlotLink id={p.id} /></td><td data-label="Flat">{p.flat || '—'}</td><td data-label="Team">{teamName(p.team)}</td>
                <td data-label="Matches">{db.matches.filter(m => playsIn(db, m, p.id)).length}</td>
                <td data-label="Action"><button className="textlink" onClick={() => edit(p)}>Edit / delete</button></td>
              </tr>
            )) : <tr><td colSpan={5} className="empty">No participants found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SportsTab({ edit }: { edit: (sport?: Sport) => void }) {
  const { db } = useTournament();
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="sectionhead"><div><h3>Sports ({db.sports.length})</h3><p className="muted" style={{ fontSize: 13 }}>Sports added here become available in matches, fixtures, filters, results and team points.</p></div><button className="btn" onClick={() => edit()}>+ Add sport</button></div>
      {db.sports.map(sport => {
        const matches = db.matches.filter(m => m.sport === sport.name).length;
        return <div className="fixture" key={sport.id}><span style={{ fontSize: 24 }}>{sport.icon}</span><b>{sport.name}</b><span><span className="mini">{matches} matches</span> <button className="textlink" onClick={() => edit(sport)}>Edit</button></span></div>;
      })}
    </div>
  );
}

function AwardsTab({ edit }: { edit: (a?: Award) => void }) {
  const { db } = useTournament();
  return (
    <div className="card">
      <div className="sectionhead"><h3>Recorded team points ({db.awards.length})</h3><button className="btn" onClick={() => edit()}>+ Award points</button></div>
      {db.awards.length ? db.awards.map(a => (
        <div className="resultrow" key={a.id}>
          <strong>{teamName(a.team)} · {a.points} points</strong><span className="mini">{a.sport} · {a.category} · {a.place}</span> <button className="textlink" onClick={() => edit(a)}>Edit / remove</button>
        </div>
      )) : <div className="empty">No points awarded yet.</div>}
    </div>
  );
}

function RulesTab({ edit }: { edit: (r?: Rule) => void }) {
  const { db } = useTournament();
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="sectionhead"><h3>Points rules</h3><button className="btn" onClick={() => edit()}>+ Add rule</button></div>
      <p className="muted" style={{ fontSize: 13 }}>Rules pre-fill the points when you award a placement.</p>
      {db.rules.length ? db.rules.map(r => (
        <div className="fixture" key={r.place}><span>🏅</span><b>{r.place}</b><span><b>{r.points} pts</b> <button className="textlink" onClick={() => edit(r)}>Edit</button></span></div>
      )) : <div className="empty">No rules yet.</div>}
    </div>
  );
}

function BackupTab() {
  const { db, call } = useTournament();
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `sportsfest-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const restore = async (file?: File) => {
    if (!file) return;
    let data: Tournament;
    try { data = JSON.parse(await file.text()); } catch { return alert('That file is not valid JSON.'); }
    if (!confirm(`Replace ALL tournament data with this backup (${data.players?.length ?? 0} participants, ${data.matches?.length ?? 0} matches)?`)) return;
    if (await call('POST', '/api/admin/restore', data)) alert('Backup restored.');
  };
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="sectionhead"><h3>Backup &amp; Restore Tournament Data</h3></div>
      <p className="muted" style={{ fontSize: 13 }}>Download everything as JSON, or restore a previous backup. Restoring replaces all data in the database for everyone, so download a backup first.</p>
      <div className="toolbar"><button className="btn" onClick={download}>↓ Download JSON</button></div>
      <label className="field">Restore JSON backup<input type="file" accept=".json,application/json" className="input" onChange={e => { restore(e.target.files?.[0]); e.target.value = ''; }} /></label>
    </div>
  );
}
