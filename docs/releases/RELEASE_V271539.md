# BizCore V271.5.39 — RFQ Type column typography fix

Base: V271.5.38.

## Fixed
- The RFQ register's new Type column used the shared `.badge` pill style (12px/weight 500, coloured
  background) borrowed from status badges. Next to the plain Reference and other columns (12.5px/weight
  400, no pill), it read as a different, smaller typeface on screen.
- `rfqTypeBadgeHtml()` in `js/app.js` now renders plain coloured text instead of a pill, so it inherits
  the register's own cell typography (`.rfq-register td`: 12.5px/weight 400) like every other column —
  only the colour still tells the types apart. Rule moved from `css/status-badges.css` (pill colours,
  now removed) to `css/main.css`, next to the other RFQ cell typography rules (`rfq-cell-no`, etc.).
- No data, filtering, or sorting change — this is purely how the Type column is drawn.

## Testing
- 150/150 unit tests pass.
- `registers.e2e.mjs`, `rfq-view.e2e.mjs`, `rfq-entry.e2e.mjs` pass.
- Checked visually in a signed-in browser (screenshot) against the Reference column.

## GitHub upload
`index.html`, `js/app.js`, `css/main.css`, `css/status-badges.css`, `sw.js`.
