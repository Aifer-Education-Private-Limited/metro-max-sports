'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { fmt, fmtTime, resolveSlot, si, slotName, statusLabel, type MatchFilter } from '@/lib/tournament';
import type { Match, Tournament } from '@/lib/types';
import { useTournament } from './TournamentProvider';

export function Header({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return <div className="heading"><div><h1>{title}</h1><p>{sub}</p></div>{action}</div>;
}

export function SlotLink({ id }: { id: string }) {
  const { db } = useTournament();
  const r = resolveSlot(db, id);
  const label = slotName(db, id);
  if (r && r !== 'BYE' && !r.startsWith('winner:') && db.players.some(p => p.id === r))
    return <Link className="playerlink" href={`/players/${encodeURIComponent(r)}`}>{label}</Link>;
  return <span className="pending-slot">{label}</span>;
}

export const tagClass = (s: string) => 'tag ' + (s === 'completed' ? 'green' : 'gold');

export function FixtureCard({ m }: { m: Match }) {
  const { db } = useTournament();
  return (
    <div className="fixture">
      <div className="datebox"><b>{(m.date || '--').slice(8) || '--'}</b>{m.date ? new Date(m.date + 'T12:00:00').toLocaleDateString('en', { month: 'short' }) : 'TBD'}</div>
      <div>
        <div className="meta">{si(m.sport, db)}{m.sport} · {m.category} · {m.round}</div>
        <div className="matchtitle">{m.kind === 'event' ? <span>Placings event</span> : <><SlotLink id={m.p1} /> <span className="muted">vs</span> <SlotLink id={m.p2} /></>}</div>
        <div className="meta">{fmtTime(m.time)} {m.venue ? ' · ' + m.venue : ''} {m.status === 'completed' ? ' · ' + (m.kind === 'event' ? '🥇' : 'Winner:') + ' ' + slotName(db, m.winner) + (m.second ? ' · 🥈 ' + slotName(db, m.second) : '') + (m.third ? ' · 🥉 ' + slotName(db, m.third) : '') : ''}</div>
      </div>
      <span className={tagClass(m.status)}>{statusLabel(m.status)}</span>
    </div>
  );
}

export function MatchFilters({ db, f, set }: { db: Tournament; f: MatchFilter; set: (f: MatchFilter) => void }) {
  const cats = [...new Set(db.matches.filter(m => f.sport === 'All sports' || m.sport === f.sport).map(m => m.category))];
  const dates = [...new Set(db.matches.filter(m => m.date).map(m => m.date))].sort();
  return (
    <div className="toolbar">
      <input className="input" placeholder="🔍 Search a player, sport or date" value={f.query} onChange={e => set({ ...f, query: e.target.value })} aria-label="Search matches" />
      <select className="select" value={f.sport} onChange={e => set({ ...f, sport: e.target.value, category: 'All categories' })} aria-label="Sport">
        {['All sports', ...db.sports.map(s => s.name)].map(x => <option key={x}>{x}</option>)}
      </select>
      <select className="select" value={f.category} onChange={e => set({ ...f, category: e.target.value })} aria-label="Category">
        {['All categories', ...cats].map(x => <option key={x}>{x}</option>)}
      </select>
      <select className="select" value={f.status} onChange={e => set({ ...f, status: e.target.value })} aria-label="Status">
        {['All statuses', 'scheduled', 'completed', 'bye'].map(x => <option key={x}>{x}</option>)}
      </select>
      <select className="select" value={f.date} onChange={e => set({ ...f, date: e.target.value })} aria-label="Date">
        <option value="">All dates</option>
        {dates.map(d => <option key={d} value={d}>{fmt(d)}</option>)}
        {db.matches.some(m => !m.date) && <option value="TBD">Date TBD</option>}
      </select>
    </div>
  );
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return (
    <dialog id="fixture-editor" ref={ref} onClose={onClose}>
      <div className="editor-top"><h2>{title}</h2><button type="button" className="textlink" onClick={onClose} aria-label="Close editor">✕</button></div>
      {children}
    </dialog>
  );
}

export function CheerButton({ who, label = '🎉 Cheer' }: { who: string; label?: string }) {
  return <button type="button" className="celebrate-btn" onClick={() => celebrate(who)}>{label}</button>;
}

export function celebrate(who: string) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.confetti-layer,.celebration-toast').forEach(x => x.remove());
  const toast = document.createElement('div');
  toast.className = 'celebration-toast';
  toast.textContent = '🏆 ' + (who === 'SportsFest' ? 'Go SportsFest!' : 'Hooray, ' + who + '!');
  const sub = document.createElement('small');
  sub.textContent = 'A big cheer from the whole community 🎉';
  toast.appendChild(sub);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
  if (reduce) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#ffbd61', '#00a8a8', '#f36c70', '#44cda3', '#a78bfa'];
  for (let i = 0; i < 85; i++) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty('--delay', Math.random() * 0.7 + 's');
    piece.style.setProperty('--duration', 2.2 + Math.random() * 1.6 + 's');
    piece.style.setProperty('--drift', Math.random() * 280 - 140 + 'px');
    piece.style.setProperty('--spin', Math.random() * 1400 - 700 + 'deg');
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4600);
}
