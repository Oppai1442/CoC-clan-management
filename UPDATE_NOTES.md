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
