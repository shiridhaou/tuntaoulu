# Fix optional difficulty imports

## Implementation
- Extend shared row normalization so routine mode is inferred from explicit mode, style/category text, Seniors, and the presence of parsed difficulty movements, while explicit compulsory values remain authoritative.
- Parse P/C sequential columns as ordered code/value/label triples before generic fallbacks, preserving `+` and numeric connection nodes and exact spreadsheet values.
- Keep `difficulty_codes` and the structured `difficulty_sheet` synchronized so confirmed imports persist the complete movement list immediately.
- Update both active import summaries to report optional movement counts accurately.
- On TA athlete selection, switch the routine selector to OPT when that athlete was imported as optional, without changing Judge C or Chief layouts.

## Verification
- Add focused parser tests for P-series values, `sequence_text`, connections, explicit compulsory mode, and inferred optional mode.
- Run targeted tests, type checks, and confirm the latest preview build is clean.
