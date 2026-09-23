# Realtime standings overlay

## Goal
Make the existing standings controls open and close a synchronized full-screen standings view on the public display, without changing scoring or standings queries.

## Changes
1. Standardize the live signal on `TOGGLE_STANDINGS`, carrying the explicit open/closed boolean, while continuing to accept the existing overlay event names for compatibility.
2. Update the Chief standings action and add the same isolated standings action to the Technical Assistant screen, leaving all scoring and reset listeners untouched.
3. Extend the Public Display listener to react immediately to the new signal and cleanly unsubscribe with the existing lifecycle pattern.
4. Adapt the shared read-only standings modal for the public display: full-screen IWUF-style presentation, event/category heading, rank, affiliation flag/code, athlete name, three-decimal final score, and a restrained fade/slide transition. Keep Chief use and its print/refresh/close controls intact.
5. Verify live open/close behavior, responsive rendering at the current viewport, and preview health.

## Technical notes
- No database schema or query changes.
- No score calculation changes.
- Existing `TOGGLE_STANDINGS_OVERLAY` and lowercase listeners remain supported during migration.
