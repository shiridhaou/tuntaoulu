# HD deduction control and informational TA timing

## Changes
- Keep the assistant’s time-rule check and warning visible, but publish it as informational only so its value is never included in the final score or stored total deduction.
- Keep out-of-bounds information intact and preserve all existing scoring, realtime, reset, and choreography behavior.
- Replace the Head Referee deduction spinner with a Western-numeral text field that accepts direct decimal entry, normalizes to three decimals on commit, and clamps values to `0.000–2.000`.
- Preserve the existing `0.100`, `0.200`, `0.500`, `1.000` presets and `CLEAR` action; every action recalculates the displayed total immediately.
- Publish and export totals as `A + B(avg) + C − HD − CD`, with TA time shown only as an advisory value and recorded as zero in scoring fields.

## Verification
- Confirm `0.1` becomes `0.100`, values above `2.000` clamp to `2.000`, and CLEAR restores `0.000`.
- Confirm TA timing warnings remain visible but do not lower the Head Referee or public final score.
- Check type safety, preview build health, and the Head Referee screen interaction.
