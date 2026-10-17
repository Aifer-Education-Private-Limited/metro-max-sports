'use client';
import { useState } from 'react';
import { Header, SlotLink } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { fmt, si, slotName, sports } from '@/lib/tournament';

export default function Sports() {
  const { db } = useTournament();
  const [sport, setSport] = useState('Table Tennis');
  const cats = [...new Set(db.matches.filter(m => m.sport === sport).map(m => m.category))];
  return (
    <>
      <Header title="Sports 🏸" sub="Pick a sport to see every round, step by step." />
      <div className="toolbar">
        {sports.map(s => <button key={s} className={'btn ' + (sport === s ? '' : 'secondary')} onClick={() => setSport(s)}>{si(s)}{s}</button>)}
      </div>
      {cats.length ? cats.map(cat => {
        const ms = db.matches.filter(m => m.sport === sport && m.category === cat).sort((a, b) => a.roundOrder - b.roundOrder);
        const rounds = [...new Set(ms.map(m => m.round))];
        return (
          <div className="card" style={{ marginBottom: 18 }} key={cat}>
            <div className="sectionhead"><h3>{si(sport)}{sport} · {cat}</h3><span className="tag">{ms.length} matches</span></div>
            <div className="bracket">
              {rounds.map(round => (
                <div className="round" key={round}>
                  <h4>{round}</h4>
                  {ms.filter(m => m.round === round).map(m => (
                    <div className="bracketmatch" key={m.id}>
                      <div><SlotLink id={m.p1} /></div><div><SlotLink id={m.p2} /></div>
                      <p className="mini">{fmt(m.date)} · {m.status === 'completed' ? 'Winner: ' + slotName(db, m.winner) : m.status === 'bye' ? 'Bye' : 'Pending'}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      }) : <div className="card empty">No matches in this sport yet</div>}
    </>
  );
}
