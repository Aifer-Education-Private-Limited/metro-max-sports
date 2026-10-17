# Metromax SportsFest — Next.js

Fixtures, results, brackets, player profiles and team points for Metromax Sports Season XVI, with a password-protected admin panel. Data is stored in **Google Sheets** (production) or a **local JSON file** (development).

## Quick start (local, no Google needed)

```bash
npm install
cp .env.example .env.local      # set ADMIN_KEY
npm run dev                     # http://localhost:3000
```

Open **Admin**, sign in with `ADMIN_KEY`, and click **Load the built-in schedule** once. This copies the 336 participants, 614 matches and points rules into the store (`.data/db.json` locally).

## Pages

| Route | What it shows |
|---|---|
| `/` | Home: hero, stats, upcoming matches, latest results, team points |
| `/matches` | All matches with search + sport/category/status filters |
| `/official` | Official fixture sheets (images + PDFs) and season calendar |
| `/sports` | Brackets by sport and category |
| `/players`, `/players/[id]` | Participant list and profile (matches, wins) |
| `/results` | Completed matches |
| `/points` | Team standings, awards and points rules |
| `/admin` | Sign in, then add/edit/delete matches & results, participants, team points, points rules, backup & restore |

## Connecting Google Sheets

1. **Create a service account.** In [Google Cloud Console](https://console.cloud.google.com/), create a project (or reuse one), enable the **Google Sheets API**, then go to *IAM & Admin → Service accounts → Create*. Open the account, go to *Keys → Add key → JSON*, and download the file.
2. **Create a spreadsheet** and share it (Editor) with the service account's email, e.g. `sportsfest@project.iam.gserviceaccount.com`.
3. **Set the environment variables** (`.env.local`, or your host's settings):
   ```
   ADMIN_KEY=a-long-password
   GOOGLE_SHEET_ID=<the id between /d/ and /edit in the sheet URL>
   GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email from the JSON>
   GOOGLE_PRIVATE_KEY="<private_key from the JSON, keeping the \n escapes>"
   ```
4. Start the app, sign in to **Admin**, and click **Load the built-in schedule**.

The app creates the `Players`, `Matches`, `Awards`, `Rules` and `Meta` tabs automatically. Cells are formatted as plain text so dates and times aren't auto-converted.

**Editing the sheet by hand** is supported. Every save checks the revision number in `Meta!B1`, so a concurrent edit isn't silently overwritten. If you edit cells directly, the change shows on the site within a few seconds. Extra columns you add are kept.

## Deploying

Any Node host works (Vercel, Render, a VPS with `npm run build && npm start`). On serverless hosts such as Vercel, you **must** use Google Sheets because the local file store is not persistent there. Set the env vars in the host's dashboard.

## API

Anyone can read. Every write needs the admin cookie set by `POST /api/auth`.

| Method & path | Purpose |
|---|---|
| `GET /api/tournament` | `{ data, revision, empty }` |
| `GET/POST/DELETE /api/auth` | session status / login `{ key }` / logout |
| `POST /api/players`, `PUT/DELETE /api/players/:id` | participants |
| `POST /api/matches`, `PUT/DELETE /api/matches/:id` | fixtures & results |
| `POST /api/awards`, `PUT/DELETE /api/awards/:id` | team-point awards |
| `POST /api/rules`, `PUT/DELETE /api/rules/:place` | points rules |
| `POST /api/admin/seed` | load built-in schedule into an empty store |
| `POST /api/admin/restore` | replace everything with a JSON backup |

Bracket rules are enforced on the server:
- A `winner:<matchId>` slot is filled by that match's winner.
- A BYE advances the other participant.
- Changing a result or participant clears the results of later rounds that depend on it.
- Deleting a participant sets their slots to TBD.
- A match that feeds a later round can't be deleted.

## Project layout

```
app/            pages + app/api route handlers
components/     Shell (sidebar/topbar), TournamentProvider (client data/auth), ui, admin editors
lib/            types, bracket helpers, auth, service (validation + mutations), store/{file,sheets}
data/           seed.json (initial tournament), official.ts (fixture sheet metadata)
public/         logos, fixture sheet images and PDFs
test/           api_test.py, ui_test.py (Playwright), fake_sheets.py (Sheets API stand-in)
```

## Tests

```bash
npm run lint && npm run build
ADMIN_KEY=test npm start &
python3 test/api_test.py http://localhost:3000 test
python3 test/ui_test.py http://localhost:3000 test     # needs: pip install playwright && playwright install chromium
```
To test the Google Sheets code path without a Google account, run `python3 test/fake_sheets.py 3999`. Then start the app with:
```
GOOGLE_SHEET_ID=x GOOGLE_SHEETS_API_BASE=http://127.0.0.1:3999/v4 GOOGLE_SHEETS_TEST_TOKEN=test-token
```
