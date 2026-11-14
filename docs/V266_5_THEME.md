# V266.5 — Application theme covers the whole screen (14 Oct 2026)

Asked by Musthafa: "Theme color should include whole." Then items 1–4 of the appearance suggestions.

## What changed
- **Whole screen follows the theme.** ~640 hard-coded navy / blue colours in the stylesheets and on-screen dialogs now come from tokens (`css/theme.css`, `--c-<hex>`). A theme sets three numbers on `<html>` (`--th-h` hue shift, `--th-c` colour strength, `--th-l` lightness lift); the browser derives every shade (CSS relative colours, OKLCH), so contrast stays as designed.
- **Corporate Navy unchanged** — pixel-compared with V266.4 (only a fading notification and 1-unit rounding in one gradient differ).
- **Not themed:** printed / A4 documents, document identity colours, neutral greys, status colours.
- **Theme saved with the user** (`settings/uiPrefs_<uid>`, uses the existing `settings` rule — no rules change) and in the browser (so the colours are right before sign-in finishes). Applied at sign-in.
- **Six themes:** Corporate Navy, Professional Slate, Modern Teal (lighter), Forest Green, Royal Purple, Burgundy (lighter). Removed: Executive Blue → Navy, Charcoal → Slate (saved choices are mapped).
- **System Preferences → Appearance** tidied: the duplicate "System Preferences / Planned" block and empty placeholder removed; live preview (sidebar, monitor, link, buttons, status labels); note "Saved with your user".
- **One status colour list:** 42 status labels mapped to 7 fixed tones (`--st-*`), each keeping its colour family; "Sent" no longer follows the theme (it looked like "Won" in Forest Green). See UI_STANDARDS §7.
- Older browsers without CSS relative colours show Corporate Navy whatever the theme (no breakage).

## Files
New: `css/theme.css` (generated), `tools/theme/` (convert.py, build_theme_css.py, oklch.py, tokens.json), `tests/browser/theme.e2e.mjs`, this note.
Changed: `index.html`, `js/app.js`, `sw.js`, `package.json`, `css/main.css`, `css/bizcore-design.css`, `css/masters.css`, `css/numbering-controls.css`, `css/invoicing.css`, `css/register-standard.css`, `css/doc-view.css`, `css/delivery-compact.css`, `css/receipts.css`, `docs/UI_STANDARDS.md`, `docs/HANDOVER.md`.
No database rules or Firebase changes. Console: "Theme V266.5 ✅ …".

## Tests (here)
`npm test` 88/88 · `npm run test:browser` 33/33 (new theme test: saved theme at sign-in, whole screen changes, statuses fixed, Navy = #173A5E, old names mapped, save from Preferences) · parity pass.
