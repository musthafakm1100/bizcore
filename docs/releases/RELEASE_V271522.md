# BizCore V271.5.22 — Jobs register visual standardization

Baseline: V271.5.21 (Pricing V271.5.19 remains the approved visual reference).

UI only: Jobs monitor uses the shared five-card soft style, compact dimensions, pale icons and existing statuses; toolbar controls and clear-filter icon match shared visual tokens; Jobs table has a 5px toolbar gap, rounded opaque container, fixed column headings and independently scrolling rows.

No changes to JS/jobs.js, status calculations, filters, Firebase, sorting or pagination. Stock remains separately scoped.

New shared-token-based stylesheet `css/jobs-ui-standard.css` loaded after the global stylesheet on desktop. Existing tablet/mobile media styles continue unchanged.

Validation: 150 automated tests passed; JavaScript syntax and CSS parsing passed. Authenticated full-app browser testing pending.
