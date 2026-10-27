'use client';
import { useState } from 'react';
import { Dialog } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { resolveSlot, slotName, teamName } from '@/lib/tournament';
import type { Award, Match, Player, Rule, Sport } from '@/lib/types';

const enc = encodeURIComponent;
const sportIcons = [
  ['Racket & court', [['🏸', 'Badminton'], ['🏓', 'Table tennis'], ['🎾', 'Tennis'], ['🏐', 'Volleyball'], ['🏀', 'Basketball'], ['🏉', 'Rugby'], ['🏏', 'Cricket']]],
  ['Field & goal', [['⚽', 'Football'], ['⚾', 'Baseball'], ['🥎', 'Softball'], ['🏑', 'Hockey'], ['🥍', 'Lacrosse'], ['🏈', 'American football']]],
  ['Indoor & board', [['♟️', 'Chess'], ['🎯', 'Target / carroms'], ['🎱', 'Billiards'], ['🎳', 'Bowling'], ['🃏', 'Card game'], ['🎮', 'Esports']]],
  ['Athletics & fitness', [['🏃', 'Running'], ['🚶', 'Walking'], ['🏋️', 'Weightlifting'], ['🤸', 'Gymnastics'], ['🤾', 'Handball'], ['⛹️', 'Ball sport'], ['🧘', 'Yoga']]],
  ['Combat & precision', [['🥊', 'Boxing'], ['🥋', 'Martial arts'], ['🤼', 'Wrestling'], ['🤺', 'Fencing'], ['🏹', 'Archery'], ['🔫', 'Shooting']]],
  ['Water, wheels & outdoors', [['🏊', 'Swimming'], ['🤽', 'Water polo'], ['🚣', 'Rowing'], ['🏄', 'Surfing'], ['🚴', 'Cycling'], ['🛼', 'Skating'], ['⛳', 'Golf'], ['🏇', 'Horse racing']]],
  ['Awards & general', [['🏅', 'General sport'], ['🏆', 'Tournament'], ['🥇', 'Gold medal'], ['🎖️', 'Award']]],
] as const;
const hasListedSportIcon = (value: string) => sportIcons.some(([, options]) => options.some(([icon]) => icon === value));

function Actions({ onDelete, saving }: { onDelete?: () => void; saving: boolean }) {
  return (
    <div className="editor-actions full">
      <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      {onDelete && <button className="btn secondary danger" type="button" disabled={saving} onClick={onDelete}>Delete</button>}
    </div>
  );
}

const TeamSelect = ({ value, onChange, allowTbd = true }: { value: string; onChange: (v: string) => void; allowTbd?: boolean }) => (
  <select className="select" name="team" value={value} onChange={e => onChange(e.target.value)}>
    <option value="BI">MMX Wizardz</option><option value="GL">Metro Hawks</option>{allowTbd && <option value="">TBD</option>}
  </select>
);

export function MatchEditor({ match, defaults, onClose }: { match?: Match; defaults?: Partial<Match>; onClose: () => void }) {
  const { db, call, saving } = useTournament();
  const [m, setM] = useState<Match>(match ? { ...match } : {
    id: '', sport: db.sports[0]?.name || '', category: '', round: 'Round 1', roundOrder: 1, date: '', time: '', venue: '', p1: '', p2: '', status: 'scheduled', winner: '', second: '', third: '', kind: 'match', score: '', ...defaults,
  });
  const isEvent = (m.kind || 'match') === 'event';
  const setKind = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const kind = e.target.value as Match['kind'];
    setM(kind === 'event' ? { ...m, kind, p1: '', p2: '', status: m.status === 'bye' ? 'scheduled' : m.status } : { ...m, kind, second: '', third: '' });
  };
  const set = (k: keyof Match) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setM({ ...m, [k]: k === 'roundOrder' ? Number(e.target.value) : e.target.value });
  const rounds = ['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final', 'Third-place', 'League', 'Playoff'];
  const setRound = (round: string) => setM({ ...m, round, roundOrder: rounds.indexOf(round) + 1 || m.roundOrder || 1 });
  const earlier = db.matches.filter(x => x.id !== m.id && x.sport === m.sport && x.category === m.category && (x.roundOrder || 1) < (m.roundOrder || 1));
  const players = db.players.slice().sort((a, b) => a.name.localeCompare(b.name));
  const slot = (k: 'p1' | 'p2') => (
    <select className="select" name={k} value={m[k]} onChange={set(k)}>
      <option value="">TBD</option><option value="BYE">BYE</option>
      <optgroup label="Participants / pairs">{players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team ? teamName(p.team) : 'TBD'})</option>)}</optgroup>
      <optgroup label="Winner of an earlier match">{earlier.map(x => <option key={x.id} value={'winner:' + x.id}>Winner · {x.round} · {slotName(db, x.p1)} vs {slotName(db, x.p2)}</option>)}</optgroup>
    </select>
  );
  const winners = [...new Set([m.p1, m.p2].map(v => resolveSlot(db, v)).filter(v => v && v !== 'BYE' && !v.startsWith('winner:')))];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call(match ? 'PUT' : 'POST', match ? `/api/matches/${enc(match.id)}` : '/api/matches', m)) onClose();
  };
  const del = async () => {
    if (!match || !confirm('Delete this match from the shared schedule?')) return;
    if (await call('DELETE', `/api/matches/${enc(match.id)}`)) onClose();
  };
  return (
    <Dialog title={match ? 'Edit match' : 'Add match'} onClose={onClose}>
      <form className="formgrid" onSubmit={submit}>
        <label className="field">Sport<select className="select" name="sport" value={m.sport} onChange={set('sport')}>{db.sports.map(s => <option key={s.id} value={s.name}>{s.icon} {s.name}</option>)}</select></label>
        <label className="field">Category<input className="input" name="category" value={m.category} onChange={set('category')} required placeholder="Under 12 Girls" list="category-list" /></label>
        <datalist id="category-list">{[...new Set(db.matches.filter(x => x.sport === m.sport).map(x => x.category))].map(c => <option key={c} value={c} />)}</datalist>
        <label className="field">Round<select className="select" name="round" value={m.round} onChange={e => setRound(e.target.value)} required>
          <option value="">Choose round</option>{rounds.map(r => <option key={r} value={r}>{r}</option>)}
        </select></label>
        <label className="field">Round order<input className="input" type="number" name="roundOrder" min={1} max={20} value={m.roundOrder || 1} onChange={set('roundOrder')} required /></label>
        <label className="field">Date<input className="input" type="date" name="date" value={m.date} onChange={set('date')} /></label>
        <label className="field">Time<input className="input" type="time" name="time" value={m.time} onChange={set('time')} /></label>
        <label className="field full">Venue<input className="input" name="venue" value={m.venue} onChange={set('venue')} placeholder="Court / hall" /></label>
        <label className="field">Type
          <select className="select" name="kind" value={m.kind || 'match'} onChange={setKind}>
            <option value="match">Match (1 vs 1)</option>
            <option value="event">Event · placings only (no participants)</option>
          </select>
        </label>
        {!isEvent && <label className="field">Participant 1{slot('p1')}</label>}
        {!isEvent && <label className="field">Participant 2{slot('p2')}</label>}
        <label className="field">Status<select className="select" name="status" value={m.status} onChange={set('status')}><option value="scheduled">Scheduled</option><option value="completed">Completed</option>{!isEvent && <option value="bye">Bye / advance</option>}</select></label>
        {isEvent ? (
          ([['winner', '1st place'], ['second', '2nd place'], ['third', '3rd place']] as const).map(([k, label]) => (
            <label className="field" key={k}>{label}
              <select className="select" name={k} value={m[k] || ''} onChange={set(k)} disabled={m.status !== 'completed'} required={k === 'winner' && m.status === 'completed'}>
                <option value="">{k === 'winner' ? 'Choose 1st place' : '—'}</option>
                {players.filter(p => ![m.winner, m.second, m.third].includes(p.id) || m[k] === p.id).map(p => <option key={p.id} value={p.id}>{p.name} ({p.team ? teamName(p.team) : 'TBD'})</option>)}
              </select>
            </label>
          ))
        ) : (
          <label className="field">Winner
            <select className="select" name="winner" value={m.winner} onChange={set('winner')} disabled={m.status !== 'completed'}>
              <option value="">No result yet</option>{winners.map(v => <option key={v} value={v}>{slotName(db, v)}</option>)}
            </select>
          </label>
        )}
        <label className="field full">Score / notes<input className="input" name="score" value={m.score} onChange={set('score')} placeholder="e.g. 21–15, 21–18" /></label>
        <p className="mini full">Changing participants or the winner clears results of later rounds that depend on this match.</p>
        <Actions saving={saving} onDelete={match ? del : undefined} />
      </form>
    </Dialog>
  );
}

export function PlayerEditor({ player, onClose }: { player?: Player; onClose: () => void }) {
  const { db, call, saving } = useTournament();
  const [p, setP] = useState({ name: player?.name || '', flat: player?.flat || '', team: player?.team ?? 'BI' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call(player ? 'PUT' : 'POST', player ? `/api/players/${enc(player.id)}` : '/api/players', p)) onClose();
  };
  const del = async () => {
    if (!player) return;
    const used = db.matches.filter(m => [m.p1, m.p2, m.winner].includes(player.id)).length;
    if (!confirm(used ? `${player.name} is in ${used} match(es). Their slots will become TBD and dependent results will be cleared. Delete?` : `Delete ${player.name}?`)) return;
    if (await call('DELETE', `/api/players/${enc(player.id)}`)) onClose();
  };
  return (
    <Dialog title={player ? 'Edit participant' : 'Add participant'} onClose={onClose}>
      <form className="formgrid" onSubmit={submit}>
        <label className="field full">Name / pair<input className="input" name="name" value={p.name} onChange={e => setP({ ...p, name: e.target.value })} required placeholder="Resident name" /></label>
        <label className="field">Flat / Unit<input className="input" name="flat" value={p.flat} onChange={e => setP({ ...p, flat: e.target.value })} placeholder="e.g. 212C" /></label>
        <label className="field">Team<TeamSelect value={p.team} onChange={team => setP({ ...p, team: team as Player['team'] })} /></label>
        <Actions saving={saving} onDelete={player ? del : undefined} />
      </form>
    </Dialog>
  );
}

export function AwardEditor({ award, onClose }: { award?: Award; onClose: () => void }) {
  const { db, call, saving } = useTournament();
  const rulesFor = (sport: string) => db.rules.filter(r => !r.sport || r.sport === sport);
  const ruleFor = (sport: string, place: string) => db.rules.find(r => r.sport === sport && r.place === place) || db.rules.find(r => !r.sport && r.place === place);
  const initialSport = award?.sport || db.sports[0]?.name || '';
  const initialPlace = award?.place || rulesFor(initialSport)[0]?.place || 'Champion';
  const [a, setA] = useState({ sport: initialSport, category: award?.category || '', team: (award?.team || 'BI') as Award['team'], place: initialPlace, points: award?.points ?? ruleFor(initialSport, initialPlace)?.points ?? 10 });
  const setSport = (sport: string) => setA({ ...a, sport, points: ruleFor(sport, a.place)?.points ?? a.points });
  const setPlace = (place: string) => setA({ ...a, place, points: ruleFor(a.sport, place)?.points ?? a.points });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call(award ? 'PUT' : 'POST', award ? `/api/awards/${enc(award.id)}` : '/api/awards', a)) onClose();
  };
  const del = async () => {
    if (!award || !confirm('Remove these team points?')) return;
    if (await call('DELETE', `/api/awards/${enc(award.id)}`)) onClose();
  };
  return (
    <Dialog title={award ? 'Edit team points' : 'Award team points'} onClose={onClose}>
      <form className="formgrid" onSubmit={submit}>
        <label className="field">Sport<select className="select" name="sport" value={a.sport} onChange={e => setSport(e.target.value)}>{db.sports.map(s => <option key={s.id} value={s.name}>{s.icon} {s.name}</option>)}</select></label>
        <label className="field">Category<input className="input" name="category" value={a.category} onChange={e => setA({ ...a, category: e.target.value })} required placeholder="Ladies Singles" /></label>
        <label className="field">Team<TeamSelect value={a.team} onChange={team => setA({ ...a, team: team as Award['team'] })} allowTbd={false} /></label>
        <label className="field">Placement<input className="input" name="place" list="place-list" value={a.place} onChange={e => setPlace(e.target.value)} required /></label>
        <datalist id="place-list">{rulesFor(a.sport).map(r => <option key={r.id} value={r.place} />)}</datalist>
        <label className="field full">Points<input className="input" name="points" type="number" min={0} value={a.points} onChange={e => setA({ ...a, points: Number(e.target.value) })} required /></label>
        <Actions saving={saving} onDelete={award ? del : undefined} />
      </form>
    </Dialog>
  );
}

export function SportEditor({ sport, onClose }: { sport?: Sport; onClose: () => void }) {
  const { db, call, saving } = useTournament();
  const initialIcon = sport?.icon || '🏅';
  const [value, setValue] = useState({ name: sport?.name || '', icon: initialIcon });
  const [customIcon, setCustomIcon] = useState(!hasListedSportIcon(initialIcon));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call(sport ? 'PUT' : 'POST', sport ? `/api/sports/${enc(sport.id)}` : '/api/sports', value)) onClose();
  };
  const del = async () => {
    if (!sport) return;
    const uses = db.matches.filter(m => m.sport === sport.name).length + db.awards.filter(a => a.sport === sport.name).length;
    if (!confirm(uses ? `${sport.name} is used by ${uses} record(s) and cannot be deleted until those records are removed. Continue?` : `Delete ${sport.name}?`)) return;
    if (await call('DELETE', `/api/sports/${enc(sport.id)}`)) onClose();
  };
  return (
    <Dialog title={sport ? 'Edit sport' : 'Add sport'} onClose={onClose}>
      <form className="formgrid" onSubmit={submit}>
        <label className="field">Sport icon<select className="select sport-icon-select" name="iconChoice" value={customIcon ? 'custom' : value.icon} onChange={e => {
          if (e.target.value === 'custom') { setCustomIcon(true); setValue({ ...value, icon: '' }); }
          else { setCustomIcon(false); setValue({ ...value, icon: e.target.value }); }
        }} required>
          {sportIcons.map(([group, options]) => <optgroup key={group} label={group}>{options.map(([icon, label]) => <option key={icon + label} value={icon}>{icon}  {label}</option>)}</optgroup>)}
          <option value="custom">＋ Other / custom icon</option>
        </select></label>
        {customIcon && <label className="field">Custom icon<input className="input" name="icon" value={value.icon} onChange={e => setValue({ ...value, icon: e.target.value })} required maxLength={12} placeholder="Enter an emoji or symbol" autoFocus /></label>}
        <label className="field">Sport name<input className="input" name="name" value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} required maxLength={50} placeholder="e.g. Volleyball" /></label>
        <Actions saving={saving} onDelete={sport ? del : undefined} />
      </form>
    </Dialog>
  );
}

export function RuleEditor({ rule, onClose }: { rule?: Rule; onClose: () => void }) {
  const { db, call, saving } = useTournament();
  const [r, setR] = useState({ sport: rule?.sport || '', place: rule?.place || '', points: rule?.points ?? 0 });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call(rule ? 'PUT' : 'POST', rule ? `/api/rules/${enc(rule.id)}` : '/api/rules', r)) onClose();
  };
  const del = async () => {
    if (!rule || !confirm(`Delete the "${rule.place}" rule? Existing awards keep their points.`)) return;
    if (await call('DELETE', `/api/rules/${enc(rule.id)}`)) onClose();
  };
  return (
    <Dialog title={rule ? 'Edit points rule' : 'Add points rule'} onClose={onClose}>
      <form className="formgrid" onSubmit={submit}>
        <label className="field full">Sport<select className="select" name="sport" value={r.sport} onChange={e => setR({ ...r, sport: e.target.value })}>
          <option value="">All sports</option>
          {db.sports.map(s => <option key={s.id} value={s.name}>{s.icon} {s.name}</option>)}
        </select></label>
        <label className="field">Placement<input className="input" name="place" value={r.place} onChange={e => setR({ ...r, place: e.target.value })} required placeholder="e.g. Semi-finalist" /></label>
        <label className="field">Points<input className="input" name="points" type="number" min={0} value={r.points} onChange={e => setR({ ...r, points: Number(e.target.value) })} required /></label>
        <Actions saving={saving} onDelete={rule ? del : undefined} />
      </form>
    </Dialog>
  );
}
