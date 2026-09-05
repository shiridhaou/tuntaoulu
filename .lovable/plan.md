# Judge C Timeline Refactor

## Scope
Refactor only the lower scoring area in the Judge C screen. Preserve all session, realtime, submission, score calculation, import, and other role behavior.

## Changes
- Keep the current movement title and large YES / NO controls centered at the top.
- Replace the separate Quick Codes, Connections, and movement cards with one horizontally scrollable scoring-paper timeline.
- Render scheduled movements and scheduled connections in their athlete-sheet order, each with code/label, point value, and a clear Pending / Accepted / Rejected state.
- Make every timeline item directly tappable: pending → accepted → rejected → pending, while respecting the existing scoring lock and connection ceiling.
- Keep manual movement entry available as a compact control beside the timeline without changing how codes are created or scored.
- Preserve the existing dark theme and orange, green, red, and cyan status colors; size the strip for tablet use with stable item widths and no overlap.

## Verification
- Check the Judge C page at tablet and desktop widths.
- Confirm YES / NO advances the active movement and timeline taps override both movements and connections.
- Confirm locked scoring blocks all changes and submission behavior remains unchanged.
- Confirm the project builds without errors.
