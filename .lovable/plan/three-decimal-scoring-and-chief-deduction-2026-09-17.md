# Three-decimal scoring and Chief deduction

## What will change
- Show final scores, group totals, deductions, standings, podium scores, score sheets, and public displays with exactly three decimals.
- Add a Chief Judge deduction control in the lower Chief summary with presets `0.100`, `0.200`, `0.500`, `1.000`, plus a custom non-negative value and clear action.
- Calculate the authoritative result as `(A + B + C) − Chief Judge Deduction`, floored at zero and rounded to three decimals.
- Show `HD: −x.xxx` in the Chief breakdown and published public breakdown.
- Save the Chief deduction in the existing result payload, include it in realtime publication and event payloads, and keep the existing database `deductions` field as the total external deduction for ranking/report compatibility.
- Reset the Chief deduction when the active athlete changes or the Chief advances to the next athlete.

## Safety
- Preserve Group A consensus, Group B trimming, Group C logic, timer behavior, and existing realtime channel setup.
- Do not change database schemas.
- Verify type safety, preview build health, and the Chief/public screens at desktop viewport.

## Technical details
- Use a shared three-decimal score formatter and numeric three-decimal rounding helper.
- Distinguish `ta_deduction`, `chief_deduction`, and `total_external_deduction` in published payloads while storing the already-adjusted final score.
- Public screens will read the Chief deduction from the published payload and render it separately from TA deductions.
