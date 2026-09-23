# Arena display realtime sync and judge badge alignment

## Goal
Keep the arena display synchronized with the active match state and center the A/B/C judge badges on the Chief screen, without changing scoring formulas or other layouts.

## Changes

1. **Define one compatible live-display state contract**
   - Extend the existing session-state broadcast payload to carry `current_athlete_id`, `match_status`, and `show_standings_overlay` while preserving the current `athlete_id`, timer, style, and nested payload fields.
   - Keep accepting the existing lowercase database event names so currently connected screens remain compatible.

2. **Reset and athlete transition behavior**
   - Update the Chief’s Next Athlete action to immediately broadcast a cleared athlete with `match_status: "READY"`, clear the standings flag, and emit the existing reset event after the authoritative match row is reset.
   - Ensure athlete selection/call broadcasts the new athlete identity and status through the same shared state so the display cannot remain on a previously published result.

3. **Arena/Public Display subscription**
   - Add a single lifecycle-managed listener on the existing shared session channel in `PublicDisplay`.
   - On athlete identity changes, reload that athlete and its current scores/result; on `READY`, reset, or a null athlete, immediately clear the previous published card and return to the waiting state.
   - On `TOGGLE_STANDINGS_OVERLAY` or `show_standings_overlay`, open/close the existing standings modal full-screen in sync with the Chief screen.
   - Preserve the existing database listeners as recovery for reconnects and late joiners, with cleanup on unmount.

4. **Standings broadcast compatibility**
   - Broadcast the requested `TOGGLE_STANDINGS_OVERLAY` event from the Chief while retaining support for the existing lowercase event on receiving screens.
   - Mirror the boolean in shared session state so late updates do not depend on one database event arriving first.

5. **Judge badge alignment**
   - Add `items-center justify-center` to the A/B/C badge row and `self-center` to each judge badge wrapper/circle.
   - Do not alter badge sizes, colors, scores, or surrounding card layout.

## Verification
- Confirm a published athlete disappears immediately when Chief presses Next Athlete and the display shows the waiting/READY state.
- Confirm selecting/calling another athlete replaces the old athlete without refreshing.
- Confirm the Chief standings button opens and closes the existing full-screen standings board on the arena display.
- Confirm A1–A3, B1–B3, and C1 badges are centered in their cards at the current 1039×674 viewport.
- Check the generated build result and browser console for errors.
