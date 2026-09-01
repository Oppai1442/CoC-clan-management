# v3 — War / CWL correctness fixes

1. **War History** — removed `attacksPerMember` from the API/UI output.
2. **War Attacks** — added attacker map position, defender name and defender map position. Existing legacy rows fall back to defender tag when the old sheet never stored the defender profile.
3. **War Stats Current** — completion is calculated from attack counts. No-sample modes render blank rather than a misleading `0%`; compact `done/required` columns are visible for CW, CWL and total.
4. **War Recommend** — score is now Bayesian posterior completion `(done + alpha) / (required + alpha + beta)`. Confidence is retained as a diagnostic/tie-break rather than multiplying the score again.
5. **CWL Season History** — season is normalized to `YYYY-MM`; technical `first seen` is replaced by start/end context; legacy 28 group-war totals are interpreted as seven league days.
6. **CWL Rounds** — exactly one own-clan war per day, percentage normalization, no repeated clan name, compact day-oriented output.
7. **CWL Round Members** — own clan only, season selector and Day 1-7 selector.
8. **CWL Round Attacks** — own clan only, season/day selectors, target context and much smaller result sets.
9. **Raid Members** — joins RaidSeasons to expose start/end time and attack limit.
10. **Analytics** — compact Clash timestamps now parse correctly; CWL aggregation excludes other league-group wars; cache key bumped to invalidate the old empty result.

## Important legacy-data note
The workbook proves the old CWL collector stored 4 group wars per day and stopped after 15 warTags, which only covers round indexes 0-3. It also sometimes stored the opponent-side roster when the clan appeared as `war.opponent`. The v3 API hides those known-wrong legacy member/attack rows; the corrected collector fixes current/future seasons. Missing historical days cannot be faithfully invented from the workbook.

## Validation
- `gas/doGet.gs`: `node --check` passed.
- `gas/syncWarToSheet.gs`: `node --check` passed.
- Modified TS/TSX files parse successfully with TypeScript 5.9 syntax transpilation.
- Full Vite build requires project dependencies; this execution tree does not contain the installed dependency set.
