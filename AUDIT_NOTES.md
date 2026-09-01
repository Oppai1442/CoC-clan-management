# UI / Performance Audit

## 1. Performance logic
- Historical pages no longer all poll every 15 seconds. Poll intervals are now endpoint-specific (30s live/current, 60-120s mixed, up to 5m for slow-changing history).
- Append datasets deduplicate stable row IDs before merging and retain at most 5,000 rows in memory for long-running tabs.
- Replace-page generic row totals use the server's `totalAfterFilter`, not the current paginated slice.
- Analytics aggregation is computed server-side and cached for 120 seconds, so charts do not require downloading every raw history table to the browser.

## 2. Information architecture
The API endpoints remain intact for compatibility, but sidebar navigation is grouped by user task:
- Overview: Announcements, Analytics
- Clan: Clan Members, Member Events
- Clan War: History, Members, Attacks, Stats, Recommendation
- CWL: Season History, Rounds, Round Members, Round Attacks
- Clan Capital: Raid Seasons, Raid Members

This removes the flat "one sheet = one page" feel without deleting detailed datasets.

## 3. Statistics / charts
New Analytics page:
- Weekly and monthly aggregation switch.
- War count, win/loss/draw, win rate, average destruction.
- Raid loot, raid attacks, raid rewards.
- Win-rate trend chart.
- Raid-loot trend chart.
- Recent-period detail table.

## Deployment
Deploy `gas/doGet.gs` and the UI together. The new page calls `/api/v1/analytics`.

## Validation performed here
- TypeScript/TSX syntax parsed successfully for all modified frontend files.
- `gas/doGet.gs` passed JavaScript syntax checking.
- Full `npm run build` could not be completed in this execution environment because npm dependency installation timed out; the supplied project lockfile/source were left unchanged except for the intended source edits.
