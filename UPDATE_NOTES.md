# Oppai CoC Clan Management UI - Update Notes

## Updated
- Added per-page summary cards for members, war, CWL, raid, recommendations, and generic sheets.
- Added CSV export using the currently visible columns and current filtered rows.
- Added column picker with per-page localStorage persistence.
- Added clear filters/sort action and manual refresh action.
- Added row detail drawer with copy-to-clipboard for raw field values.
- Moved most user-facing UI text into i18n resources for Vietnamese and English.
- Improved War Recommendation display by tagging picked vs bench rows.
- Fixed the member tour highlight target from the localized display name to the stable `Clan Members` page id.
- Improved reset/refresh behavior in `useSheetExplorer` so it reloads immediately instead of waiting for the next poll.

## Verified
- `npm run build` passes.
- Production `dist/` was regenerated.

## Note
- `npm run lint` still reports strict project-wide rules such as `no-explicit-any` and React Compiler `set-state-in-effect`; several are from existing code. They do not block the production build.

## Analytics + navigation pass
- Added a cached `/api/v1/analytics` endpoint aggregating Clan War, CWL, and Raid data into weekly and monthly buckets.
- Added an Analytics page with weekly/monthly switch, KPI cards, trend charts, and a compact period table.
- Grouped the sidebar by user task (Overview, Clan, Clan War, CWL, Clan Capital) instead of exposing one flat list of technical datasets.
- Reduced polling frequency for historical datasets while keeping current/live datasets fresher.
- Added append-row deduplication and a 5,000-row in-memory cap for long-running sessions.
- Generic replace-page row totals now use the server `totalAfterFilter` value instead of only the current 50-row page.
- The generic search/column/export toolbar is hidden on Analytics because those controls do not apply to aggregated charts.

## Deployment note
- The UI and `gas/doGet.gs` must be deployed together because the Analytics page depends on the new `/api/v1/analytics` route.

## War / CWL correctness pass (v3)
- War History no longer exposes redundant `attacksPerMember`.
- War Attacks now exposes attacker/target names and map positions; collector stores defender identity for new/current wars.
- War Stats overall completion is now attack-weighted `(CW done + CWL done) / (CW required + CWL required)` and shows compact CW/CWL/overall attack samples.
- War Recommend now uses the Bayesian posterior completion rate as the score; sample confidence is diagnostic/tie-break only, removing the old double penalty for sample size and missed attacks.
- CWL collector now selects exactly the clan's own war for each league day, correctly handles the clan appearing on the API `opponent` side, and no longer mixes all league-group clans into member/attack sheets.
- CWL pages use season selection; member/attack pages also support Day 1-7 filtering.
- CWL percentages and season values are normalized before sheet writes to prevent locale-driven giant percentages and Excel serial/date rendering.
- Raid Members now includes raid start/end context.
- Analytics date parsing supports Clash compact timestamps and CWL analytics use only the clan's own rounds.

### Historical CWL limitation
The old collector saved only the first 15 group warTags and, when the clan appeared on the `opponent` side, saved the other clan's members/attacks. Those missing own-side rows cannot be reconstructed from the local workbook alone. The API layer suppresses known-wrong legacy rows instead of presenting them as clan data. Current/future collection is corrected.

### Deploy
Deploy both `gas/doGet.gs` and `gas/syncWarToSheet.gs` with the frontend. Run `runCollector()` once after deployment so the new headers are added and WarStats/current CWL data are refreshed immediately.
