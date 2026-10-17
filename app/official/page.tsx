/* eslint-disable @next/next/no-img-element */
import { Header } from '@/components/ui';
import FixtureBrackets from '@/components/FixtureBrackets';
import { officialSheets, seasonCalendar, seasonSchedule } from '@/data/official';
import { fmt, si } from '@/lib/tournament';
import { sheetAnchor } from '@/lib/sheet-anchor';

export default function Official() {
  return (
    <>
      <Header title="Official Fixtures 📅" sub="Metromax Sports Season XVI · 18 October – 8 November 2026" />
      <div className="notice">WZ = MMX Wizardz · HK = Metro Hawks. Pick a sport and category to follow every knockout round. Results update live as the admin records them.</div>
      <FixtureBrackets sports={officialSheets.map(sheet => sheet.sport)} />
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="sectionhead"><h3>Season calendar</h3></div>
        <details><summary>View the original season calendar</summary><img className="calendar-image" src={seasonCalendar} alt="Metromax Sports Season XVI full event calendar" /></details>
        <div className="season-grid">
          {seasonSchedule.map(([date, event]) => <div className="season-day" key={date + event}><b>{fmt(date)}</b><p>{event}</p></div>)}
        </div>
      </div>
      <details className="card official-sheet">
        <summary>Original fixture sheets · PDF &amp; scans</summary>
        {officialSheets.map(sheet => (
          <details className="official-sheet" key={sheet.sport}>
            <summary>{si(sheet.sport)}{sheet.sport} <span className="mini">{sheet.pages.length} fixture sheets</span></summary>
            <p><a className="btn secondary" href={sheet.pdf} download={`Fixtures-${sheet.sport.replaceAll(' ', '-')}.pdf`}>Download original PDF ↓</a></p>
            {sheet.pages.map((src, i) => (
              <figure key={src} id={sheetAnchor(sheet.sport, i + 1)}>
                <figcaption>{sheet.sport} · Sheet {i + 1} of {sheet.pages.length}</figcaption>
                <a href={src} target="_blank" rel="noopener" aria-label={`Open ${sheet.sport} sheet ${i + 1} at full size`}>
                  <img loading="lazy" src={src} alt={`Official ${sheet.sport} fixture bracket, sheet ${i + 1}; open for full-size names and dates`} />
                </a>
              </figure>
            ))}
          </details>
        ))}
      </details>
    </>
  );
}
