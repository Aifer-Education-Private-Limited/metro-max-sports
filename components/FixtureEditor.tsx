'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fmt, si } from '@/lib/tournament';
import {
  addMatch, addNextRound, categoriesOf, clearDownstream, createCategory, deleteMatches, duplicatePlayers, matchNo,
  moveMatch, nextPlayerId, renameCategory, renameRound, resolveSlot, roundsOf, settle, swapSlots, teamCode,
  type Match, type Player, type Side, type SlotRef, type Tournament,
} from '@/lib/fixtures';
import s from './FixtureEditor.module.css';

const TEAMS = [{ code: 'GL', label: 'HK · Metro Hawks' }, { code: 'BI', label: 'WZ · MMX Wizardz' }];

function TeamTag({ team }: { team?: string }) {
  const code = teamCode(team);
  return code ? <span className={`${s.team} ${code === 'WZ' ? s.wz : s.hk}`}>{code}</span> : null;
}

type PickerProps = {
  value: string; match: Match; matches: Match[]; players: Player[];
  onChange: (v: string) => void; onCreatePlayer: (name: string, team: string) => string;
};

function SlotPicker({ value, match, matches, players, onChange, onCreatePlayer }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('GL');
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const used = useMemo(() => new Set(matches.filter(m => m.sport === match.sport && m.category === match.category && m.id !== match.id).flatMap(m => [m.p1, m.p2])), [matches, match]);
  const earlier = matches
    .filter(m => m.sport === match.sport && m.category === match.category && (m.roundOrder ?? 1) < (match.roundOrder ?? 1))
    .sort((a, b) => (a.roundOrder ?? 1) - (b.roundOrder ?? 1) || matchNo(a.id) - matchNo(b.id));
  const label = (v: string) => {
    if (!v) return 'TBD';
    if (v === 'BYE') return 'BYE';
    if (v.startsWith('winner:')) { const m = matches.find(x => x.id === v.slice(7)); return m ? `Winner of ${m.round} · M${matchNo(m.id)}` : 'TBD'; }
    return byId.get(v)?.name ?? 'Unknown player';
  };
  const needle = q.trim().toLowerCase();
  const found = players
    .filter(p => !needle || p.name.toLowerCase().includes(needle) || (p.flat ?? '').toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 60);
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div className={s.picker}>
      <button type="button" className={s.pickerBtn} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>{label(value)}</span>
        {byId.get(value) && <TeamTag team={byId.get(value)?.team} />}
        <span className={s.caret}>▾</span>
      </button>
      {open && (
        <div className={s.pickerPanel}>
          <input autoFocus className={s.input} placeholder="Search participant or flat…" value={q} onChange={e => setQ(e.target.value)} />
          <div className={s.optList}>
            {!needle && <>
              <button type="button" className={s.opt} onClick={() => pick('')}>TBD <small>empty slot</small></button>
              <button type="button" className={s.opt} onClick={() => pick('BYE')}>BYE <small>other side advances</small></button>
              {earlier.length > 0 && <div className={s.optGroup}>Winner of an earlier match</div>}
              {earlier.map(m => (
                <button type="button" key={m.id} className={s.opt} onClick={() => pick(`winner:${m.id}`)}>
                  {m.round} · M{matchNo(m.id)} <small>{label(m.p1)} vs {label(m.p2)}</small>
                </button>
              ))}
              <div className={s.optGroup}>Participants</div>
            </>}
            {found.map(p => (
              <button type="button" key={p.id} className={`${s.opt} ${p.id === value ? s.optActive : ''}`} onClick={() => pick(p.id)}>
                {p.name} <TeamTag team={p.team} />{used.has(p.id) && <small className={s.warnText}>already in this category</small>}
              </button>
            ))}
            {found.length === 0 && <p className={s.muted}>No participant matches “{q}”.</p>}
          </div>
          {needle && !players.some(p => p.name.toLowerCase() === needle) && (
            <div className={s.newPlayer}>
              <select className={s.input} value={team} onChange={e => setTeam(e.target.value)}>
                {TEAMS.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
              <button type="button" className={s.primary} onClick={() => pick(onCreatePlayer(q.trim(), team))}>+ Add “{q.trim()}” as new participant</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FixtureEditor({ sports }: { sports: string[] }) {
  const [data, setData] = useState<Tournament | null>(null);
  const [revision, setRevision] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [key, setKey] = useState('');
  const [sport, setSport] = useState(sports.includes('Badminton') ? 'Badminton' : sports[0]);
  const [category, setCategory] = useState('');
  const [swapFrom, setSwapFrom] = useState<SlotRef | null>(null);
  const [editing, setEditing] = useState<Match | null>(null);
  const [newCat, setNewCat] = useState<{ name: string; size: number; date: string } | null>(null);
  const [catName, setCatName] = useState('');
  const sportOptions = useMemo(() => [...new Set([...sports, ...(data?.sports?.map(s => s.name) || [])])], [data?.sports, sports]);
  useEffect(() => { if (sportOptions.length && !sportOptions.includes(sport)) setSport(sportOptions[0]); }, [sport, sportOptions]);

  const flash = (text: string, bad = false) => { setToast({ text, bad }); setTimeout(() => setToast(null), bad ? 6000 : 2500); };

  const load = useCallback(async () => {
    const r = await fetch('/api/tournament', { cache: 'no-store' });
    if (!r.ok) return flash('Could not load fixtures.', true);
    const body = await r.json();
    setData(body.data); setRevision(body.revision); setDirty(false); setSwapFrom(null); setEditing(null);
  }, []);

  useEffect(() => {
    load();
    fetch('/api/auth', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(b => {
      const ok = b && (b.admin ?? b.authenticated ?? b.signedIn ?? b.loggedIn ?? b.ok);
      if (!ok) setNeedLogin(true);
    }).catch(() => setNeedLogin(true));
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const matches = useMemo(() => data?.matches ?? [], [data]);
  const players = useMemo(() => data?.players ?? [], [data]);
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const categories = useMemo(() => categoriesOf(matches, sport), [matches, sport]);
  const activeCat = categories.includes(category) ? category : categories[0] ?? '';
  const rounds = useMemo(() => roundsOf(matches, sport, activeCat), [matches, sport, activeCat]);
  const dupes = useMemo(() => duplicatePlayers(matches, sport, activeCat), [matches, sport, activeCat]);
  useEffect(() => setCatName(activeCat), [activeCat]);

  const apply = (next: Match[] | string, players?: Player[]) => {
    if (typeof next === 'string') return flash(next, true);
    setData(d => (d ? { ...d, matches: next, ...(players ? { players } : {}) } : d));
    setDirty(true);
  };

  const slotLabel = (v: string) => {
    const r = resolveSlot(matches, v);
    if (r === 'BYE') return 'BYE';
    const p = byId.get(r);
    if (p) return p.name;
    if (r.startsWith('winner:')) { const m = matches.find(x => x.id === r.slice(7)); return m ? `Winner of ${m.round} · M${matchNo(m.id)}` : 'TBD'; }
    return 'TBD';
  };

  const clickSlot = (ref: SlotRef) => {
    if (!swapFrom) return setSwapFrom(ref);
    if (swapFrom.id === ref.id && swapFrom.side === ref.side) return setSwapFrom(null);
    apply(swapSlots(matches, swapFrom, ref));
    setSwapFrom(null);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const r = await fetch('/api/tournament', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, data }) });
      const body = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) { setNeedLogin(true); return flash('Sign in with the admin key, then press Save again.', true); }
      if (r.status === 409) return flash('Someone else changed the fixtures meanwhile. Press “Discard” to load their version, then redo your edit.', true);
      if (!r.ok) return flash(body.error || 'Save failed.', true);
      setRevision(body.revision ?? revision); setDirty(false); flash('Saved to Google Sheet ✓');
    } catch { flash('Network error, nothing was saved.', true); } finally { setSaving(false); }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
    if (!r.ok) return flash('Wrong admin key.', true);
    setNeedLogin(false); setKey(''); flash('Signed in ✓');
  };

  const createPlayer = (name: string, team: string) => {
    const id = nextPlayerId(players);
    setData(d => (d ? { ...d, players: [...d.players, { id, name, flat: '', team }] } : d));
    setDirty(true);
    return id;
  };

  const saveEdit = () => {
    if (!editing) return;
    const before = matches.find(m => m.id === editing.id);
    if (!before) return;
    const next = settle(editing);
    const replaced = matches.map(m => (m.id === next.id ? next : m));
    const changedResult = ['p1', 'p2', 'winner'].some(k => before[k] !== next[k]);
    apply(changedResult ? clearDownstream(replaced, [next.id]) : replaced);
    setEditing(null);
  };

  const removeMatch = (m: Match) => {
    if (!confirm(`Delete ${m.round} · M${matchNo(m.id)}? Later matches fed by it become TBD.`)) return;
    apply(deleteMatches(matches, [m.id]));
    setEditing(null);
  };

  if (!data) return <div className="card">Loading fixtures…</div>;

  const editWinnerOptions = editing ? (['p1', 'p2'] as Side[]).map(side => ({ side, id: resolveSlot(matches.map(m => (m.id === editing.id ? editing : m)), editing[side]) })) : [];

  return (
    <div className={s.wrap}>
      {needLogin && (
        <form className={`card ${s.login}`} onSubmit={login}>
          <b>Sign in to save changes</b>
          <input className={s.input} type="password" placeholder="Admin key" value={key} onChange={e => setKey(e.target.value)} />
          <button className={s.primary} disabled={!key}>Sign in</button>
        </form>
      )}

      <div className={s.sports}>
        {sportOptions.map(x => (
          <button key={x} className={`${s.pill} ${x === sport ? s.active : ''}`} onClick={() => { setSport(x); setCategory(''); setSwapFrom(null); }}>{si(x, data || undefined)}{x}</button>
        ))}
      </div>

      <div className={`card ${s.board}`}>
        <div className={s.cats}>
          {categories.map(c => (
            <button key={c} className={`${s.cat} ${c === activeCat ? s.active : ''}`} onClick={() => { setCategory(c); setSwapFrom(null); }}>{c}</button>
          ))}
          <button className={s.addCat} onClick={() => setNewCat({ name: '', size: 8, date: '' })}>+ New category</button>
        </div>

        {activeCat ? <>
          <div className={s.toolbar}>
            <label className={s.catName}>
              <span>Category name</span>
              <input className={s.input} value={catName} onChange={e => setCatName(e.target.value)}
                onBlur={() => { const v = catName.trim(); if (v && v !== activeCat) { if (categories.includes(v)) { flash('That category already exists.', true); setCatName(activeCat); } else { apply(renameCategory(matches, sport, activeCat, v)); setCategory(v); } } }} />
            </label>
            <div className={s.tools}>
              <button className={s.ghost} onClick={() => apply(addNextRound(matches, sport, activeCat))}>+ Next round</button>
              <button className={s.danger} onClick={() => { if (confirm(`Delete the whole “${activeCat}” category and all its matches?`)) { apply(deleteMatches(matches, rounds.flatMap(r => r.matches.map(m => m.id)))); setCategory(''); } }}>Delete category</button>
            </div>
          </div>

          <p className={s.help}>{swapFrom
            ? <><b>Swap mode:</b> tap another player slot to swap it with <b>{slotLabel(matches.find(m => m.id === swapFrom.id)?.[swapFrom.side] ?? '')}</b>. <button className={s.link} onClick={() => setSwapFrom(null)}>Cancel</button></>
            : <>Tap (or drag) a player to swap them with another slot · ↑ ↓ reorders a fixture inside its round · ✎ edits players, date and result.</>}</p>
          {dupes.length > 0 && <div className={s.warn}>⚠ Listed twice in this category: {dupes.map(id => byId.get(id)?.name ?? id).join(', ')}</div>}

          <div className={s.bracket}>
            {rounds.map(r => (
              <div className={s.col} key={r.order}>
                <div className={s.colhead}>
                  <input className={s.roundName} defaultValue={r.name} key={r.name} aria-label="Round name"
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== r.name) apply(renameRound(matches, sport, activeCat, r.order, v)); }} />
                  <button className={s.iconBtn} title="Delete round" onClick={() => { if (confirm(`Delete ${r.name} (${r.matches.length} matches)?`)) apply(deleteMatches(matches, r.matches.map(m => m.id))); }}>✕</button>
                </div>
                {r.matches.map((m, i) => (
                  <div className={`${s.match} ${m.status === 'completed' ? s.done : ''}`} key={m.id}>
                    <div className={s.mhead}>
                      <span>M{matchNo(m.id)} · {m.status === 'completed' ? 'Done' : m.status === 'bye' ? 'Bye' : m.date ? fmt(m.date).replace(/ \d{4}$/, '') : 'No date'}</span>
                      <span className={s.mtools}>
                        <button className={s.iconBtn} title="Move up" disabled={i === 0} onClick={() => apply(moveMatch(matches, m.id, -1))}>↑</button>
                        <button className={s.iconBtn} title="Move down" disabled={i === r.matches.length - 1} onClick={() => apply(moveMatch(matches, m.id, 1))}>↓</button>
                        <button className={s.iconBtn} title="Edit" onClick={() => setEditing({ ...m })}>✎</button>
                        <button className={s.iconBtn} title="Delete" onClick={() => removeMatch(m)}>🗑</button>
                      </span>
                    </div>
                    {(['p1', 'p2'] as Side[]).map(side => {
                      const resolved = resolveSlot(matches, m[side]);
                      const p = byId.get(resolved);
                      const won = !!p && !!m.winner && resolveSlot(matches, m.winner) === resolved && m.status !== 'scheduled';
                      const selected = swapFrom?.id === m.id && swapFrom.side === side;
                      return (
                        <button key={side} draggable
                          className={`${s.slot} ${selected ? s.selected : ''} ${won ? s.won : ''} ${p ? '' : s.pending} ${dupes.includes(m[side]) ? s.dupe : ''}`}
                          onClick={() => clickSlot({ id: m.id, side })}
                          onDragStart={() => setSwapFrom({ id: m.id, side })}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => { e.preventDefault(); clickSlot({ id: m.id, side }); }}>
                          <span className={s.slotName}>{slotLabel(m[side])}</span>
                          {p && <TeamTag team={p.team} />}
                          {won && <span className={s.tick}>✓</span>}
                        </button>
                      );
                    })}
                    {m.score && <div className={s.score}>{m.score}</div>}
                  </div>
                ))}
                <button className={s.addMatch} onClick={() => apply(addMatch(matches, sport, activeCat, r))}>+ Add match</button>
              </div>
            ))}
          </div>
        </> : <div className={s.empty}>No categories for {sport} yet. <button className={s.primary} onClick={() => setNewCat({ name: '', size: 8, date: '' })}>+ Create the first one</button></div>}
      </div>

      {(dirty || toast) && (
        <div className={s.savebar}>
          <span className={toast?.bad ? s.bad : ''}>{toast?.text ?? 'You have unsaved changes'}</span>
          {dirty && <span className={s.saveBtns}>
            <button className={s.ghost} disabled={saving} onClick={() => { if (confirm('Discard all unsaved changes?')) load(); }}>Discard</button>
            <button className={s.primary} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save to Google Sheet'}</button>
          </span>}
        </div>
      )}

      {editing && (
        <div className={s.backdrop} onClick={() => setEditing(null)}>
          <div className={s.modal} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className={s.modalHead}>
              <h3>{editing.round} · M{matchNo(editing.id)}</h3>
              <button className={s.iconBtn} onClick={() => setEditing(null)} aria-label="Close">✕</button>
            </div>
            <p className={s.muted}>{si(editing.sport, data || undefined)}{editing.sport} · {editing.category}</p>
            {(['p1', 'p2'] as Side[]).map((side, i) => (
              <div key={side}>
                <label className={s.label}>{i === 0 ? 'Player / pair 1' : 'Player / pair 2'}</label>
                <SlotPicker value={editing[side]} match={editing} matches={matches} players={players} onCreatePlayer={createPlayer}
                  onChange={v => setEditing({ ...editing, [side]: v, winner: '', score: '' })} />
                {i === 0 && <button type="button" className={s.swapBtn} onClick={() => setEditing({ ...editing, p1: editing.p2, p2: editing.p1 })}>⇅ Swap sides</button>}
              </div>
            ))}
            <div className={s.grid3}>
              <label><span className={s.label}>Date</span><input className={s.input} type="date" value={editing.date ?? ''} onChange={e => setEditing({ ...editing, date: e.target.value })} /></label>
              <label><span className={s.label}>Time</span><input className={s.input} type="time" value={editing.time ?? ''} onChange={e => setEditing({ ...editing, time: e.target.value })} /></label>
              <label><span className={s.label}>Venue</span><input className={s.input} value={editing.venue ?? ''} onChange={e => setEditing({ ...editing, venue: e.target.value })} /></label>
            </div>
            {editing.p1 !== 'BYE' && editing.p2 !== 'BYE' && <>
              <span className={s.label}>Result</span>
              <div className={s.result}>
                <button type="button" className={`${s.choice} ${!editing.winner ? s.active : ''}`} onClick={() => setEditing({ ...editing, winner: '', score: '' })}>Not played</button>
                {editWinnerOptions.map(({ side, id }) => {
                  const p = byId.get(id);
                  return <button type="button" key={side} disabled={!p} title={p ? '' : 'Pick a participant first'}
                    className={`${s.choice} ${p && editing.winner && resolveSlot(matches, editing.winner) === id ? s.active : ''}`}
                    onClick={() => p && setEditing({ ...editing, winner: id })}>🏆 {p?.name ?? (side === 'p1' ? 'Side 1 TBD' : 'Side 2 TBD')}</button>;
                })}
              </div>
              {editing.winner && <label><span className={s.label}>Score (optional)</span><input className={s.input} placeholder="e.g. 21-15, 21-18" value={editing.score ?? ''} onChange={e => setEditing({ ...editing, score: e.target.value })} /></label>}
            </>}
            {(editing.p1 === 'BYE' || editing.p2 === 'BYE') && <p className={s.muted}>One side is a BYE, so the other side advances automatically.</p>}
            <div className={s.modalFoot}>
              <button className={s.danger} onClick={() => removeMatch(editing)}>Delete match</button>
              <span className={s.saveBtns}>
                <button className={s.ghost} onClick={() => setEditing(null)}>Cancel</button>
                <button className={s.primary} onClick={saveEdit}>Apply</button>
              </span>
            </div>
          </div>
        </div>
      )}

      {newCat && (
        <div className={s.backdrop} onClick={() => setNewCat(null)}>
          <form className={s.modal} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
            onSubmit={e => {
              e.preventDefault();
              const name = newCat.name.trim();
              if (categories.includes(name)) return flash('That category already exists.', true);
              apply(createCategory(matches, sport, name, newCat.size, newCat.date));
              setCategory(name); setNewCat(null);
            }}>
            <div className={s.modalHead}><h3>New {sport} category</h3><button type="button" className={s.iconBtn} onClick={() => setNewCat(null)}>✕</button></div>
            <label><span className={s.label}>Name</span><input autoFocus required className={s.input} placeholder="e.g. SINGLES · <12 GIRLS" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} /></label>
            <label><span className={s.label}>First-round matches</span>
              <select className={s.input} value={newCat.size} onChange={e => setNewCat({ ...newCat, size: Number(e.target.value) })}>
                {[1, 2, 4, 8, 16, 32].map(n => <option key={n} value={n}>{n} {n === 1 ? 'match (final only)' : `matches · up to ${n * 2} players`}</option>)}
              </select>
            </label>
            <label><span className={s.label}>First-round date (optional)</span><input className={s.input} type="date" value={newCat.date} onChange={e => setNewCat({ ...newCat, date: e.target.value })} /></label>
            <p className={s.muted}>All later rounds up to the Final are created and linked automatically. Then tap ✎ on each first-round match to choose the players.</p>
            <div className={s.modalFoot}><span /><span className={s.saveBtns}><button type="button" className={s.ghost} onClick={() => setNewCat(null)}>Cancel</button><button className={s.primary}>Create bracket</button></span></div>
          </form>
        </div>
      )}

      <p className={s.muted}>Changes stay as a draft until you press <b>Save to Google Sheet</b>. <Link href="/official">View the public bracket →</Link></p>
    </div>
  );
}
