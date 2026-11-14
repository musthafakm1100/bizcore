# BizCore V271.5.14.1 — Sales Order badge cache fix

Based on the replacement V271.5.14 Global Badges build.

The updated app.js already renders the separate `To Invoice` badge, but index.html was loading app.js with an older cache URL. This release updates the app.js cache-busting URL and service-worker version/cache entries. No status calculations, Firebase logic, pagination or workflows are changed.

Upload all four included files to GitHub, maintaining paths. Refresh the deployed BizCore page with Ctrl+Shift+R. If the issue remains, check Network tab for `js/app.js?v=271.5.14.1-badges` and confirm GitHub deployment has finished; don't purge browser data without checking.

Authenticated UI verification remains pending.
