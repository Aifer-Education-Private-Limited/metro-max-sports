'use client';
/* eslint-disable @next/next/no-img-element */
import { Header } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { points, si, teamLogo, teamName } from '@/lib/tournament';

export default function Points() {
  const { db } = useTournament();
  const totals = (['BI', 'GL'] as const).map(t => ({ t, points: points(db, t) })).sort((a, b) => b.points - a.points);
  const rules = [...db.rules].sort((a, b) => (a.sport || 'All sports').localeCompare(b.sport || 'All sports') || a.place.localeCompare(b.place));
  return (
    <>
      <Header title="Team Points ⭐" sub="MMX Wizardz and Metro Hawks collect points as they win." />
      <div className="stats" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        {totals.map((x, i) => (
          <div className="card stat standings-team" key={x.t}>
            <img className="standing-logo" src={teamLogo[x.t]} alt={`${teamName(x.t)} logo`} width={76} height={76} />
            <div className="label">{totals[0].points === totals[1].points ? 'Tied' : i === 0 ? '★ Leading team' : 'Team standing'}</div>
            <div className="number">{x.points} <span style={{ fontSize: 14 }}>pts</span></div>
            <div className="foot">{teamName(x.t)}</div>
          </div>
        ))}
      </div>
      <div className="columns">
        <div className="card">
          <div className="sectionhead"><h3>Points by Event &amp; Category</h3></div>
          <div className="tablewrap">
            <table className="stack-m">
              <thead><tr><th>Sport</th><th>Group</th><th>Team</th><th>Placement</th><th>Points</th></tr></thead>
              <tbody>
                {db.awards.length ? db.awards.map(a => (
                  <tr key={a.id}><td data-label="Sport">{a.sport}</td><td data-label="Group">{a.category}</td><td data-label="Team">{teamName(a.team)}</td><td data-label="Placement">{a.place}</td><td data-label="Points"><b>{a.points}</b></td></tr>
                )) : <tr><td colSpan={5} className="empty">No points yet. They will show up here soon! 🌟</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="sectionhead"><h3>🏅 How Points Work</h3></div>
          <p className="muted" style={{ fontSize: 13 }}>Teams earn points for how far their players go. Official rules come from the organizing committee.</p>
          {rules.map(r => <div className="fixture" key={r.id}><span>{r.sport ? si(r.sport, db) : '🏅'}</span><b>{r.place}</b><span><span className="mini">{r.sport || 'All sports'}</span><b>{r.points} pts</b></span></div>)}
        </div>
      </div>
    </>
  );
}
