# BizCore V271.5.41 — RFQ screen: Request type required, type badge in the view, Item Master filtered by type

Base: V271.5.40. Contracting module — the three RFQ screen points discussed and approved before coding.

## 1. Request type is a required field (no silent default)

Previously a new RFQ opened with **Product** already selected, so an RFQ for a service or a contracting job
could be saved as a Product RFQ just by not noticing the selector.

- A **new** RFQ now opens with *no* request type selected, and the label carries the same `*` as Customer.
- Saving without one is blocked by `BCRfq.validate()` — the first check it makes, ahead of dates and lines —
  with the standard validation dialog ("Request type required").
- The field itself shows the approved **Option A** treatment: the label turns amber and an inline
  "Select a request type before saving" message appears under the selector. **No border box** around the
  control (the bordered version misaligned the header strip). The selected state is unchanged — the
  existing dark-blue filled pill.
- The hint clears the moment a type is picked.
- **Existing records are unaffected:** an RFQ saved before this release with no stored `requestType` still
  opens as Product, exactly as before, so old data reads the same.
- Until a type is chosen the line tabs are hidden — only Requirements and Attachments show, because which
  line tabs exist (Items / Services / Scope Items) depends on the type.

(`js/rfq-entry.js`, `index.html`, `css/rfq-entry.css`)

## 2. Request type badge in the RFQ view header — all four types

The RFQ view header showed the request type only as plain text down in the detail strip. It now carries a
coloured badge in the header itself, **on the right side, next to the Close button** (as requested), for
**all four** request types rather than Contracting alone:

| Type | Colour |
|---|---|
| Product | blue `#0369a1` |
| Service | green `#15803d` |
| Mixed | orange `#c2410c` |
| Contracting | purple `#7c3aed` |

Same palette as the RFQ register's Type column, so a type reads the same in the list and in the record.
The existing status pill and age pill stay on the left; the Contracting 4-step tracker is unchanged.

(`js/app.js` — new `rfqTypeHeaderBadgeHtml()`, `index.html`, `css/main.css`)

## 3. Item Description searches only the matching half of the Item Master

The Item Description picker searched the whole Item Master regardless of request type, so a Product RFQ
could pull in a service item and the reverse. It now uses the Item Master's **existing** Goods/Service
flag — no new master, no new field, the same `type` flag the Product Master, categories and numbering
already use:

- **Product** request → goods items only.
- **Service** request → service items only.
- **Mixed** request → both, each on its own tab (a Product line searches goods, a Service line searches
  services), which is how Mixed already keeps its two lists.
- **Contracting** → unchanged. Scope items stay free text and are not matched against the master; they are
  priced in the Estimation.

Typing text that is not in the master still works everywhere ("Keep … as typed"), unchanged.

(`js/rfq-entry.js`)

## Testing
- `tests/browser/rfq-entry.e2e.mjs` updated for the new behaviour (it asserted the old Product default) and
  extended to cover all three changes: the required-type block and its amber hint, the hint clearing, the
  header badge class/label, and the master filtering in both directions.
- Full browser suite and full unit suite re-run — see the summary in the delivery message.

## GitHub upload
`index.html`, `sw.js`, `js/app.js`, `js/rfq-entry.js`, `css/main.css`, `css/rfq-entry.css`,
`tests/browser/rfq-entry.e2e.mjs`.
