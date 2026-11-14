BizCore V271.4.1 — Jobs Monitor style correction

- Sales Orders register top monitor is the visual reference.
- Jobs monitor now uses the same horizontal flex layout, 200px leading tile, label/count font sizes, padding, 5px progress bars, soft separators and card styling.
- Jobs statuses and counter logic remain unchanged; no Firebase records or numbering touched.
- Responsive layout wraps at 1100px and uses two-column status tiles on narrow screens.
- 150 unit tests passed. Browser visual QA remains necessary.
- This is a review build only; do not replace live GitHub files before visual testing.
