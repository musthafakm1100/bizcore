# V270.4.4 — Faster sign-in (27 Oct 2026)

Musthafa noticed sign-in had become a little slower since Users & Roles. Cause: at every administrator sign-in BizCore
ran the "create built-in roles" transaction, then read three settings and all roles for the Special Rights step, and
only then started loading data — about 5–6 extra Firebase round trips, every time, although nothing was missing.

## What changed (index.html only; no rules, no data change)
- **Administrator:** role upkeep runs in the background after sign-in. One plain read of the roles decides:
  - a built-in role is missing → the built-in roles transaction runs (as before);
  - a role has no Special Rights → the V270.4.3 rights step runs (as before);
  - otherwise nothing is written and no transaction or settings read happens.
  The upkeep only creates / completes role records; it grants nothing. An administrator has every permission by
  `system/accessControl` / the Administrator role, checked before anything opens — unchanged.
- **User permission copies** (`users/{uid}.perm`, what the rules read) are still written in the same commit as every
  role and user save. The repair pass that compares all users with their roles now runs after an upkeep change, or
  at most once a day per browser (was: every administrator sign-in).
- **Normal users: unchanged.** Before anything opens, BizCore checks the user record (active, role) and reads the role
  from the database — no cached permissions. The security rules check every read and write, as before.
- The browser console shows "[BizCore] Sign-in checks done … ms after the page started loading (administrator / user)"
  so the time can be checked on the real connection (F12 → Console).

## Measured (test harness with a simulated delay per Firebase round trip; time until data starts loading, average of 3 sign-ins)
| Round trip | Administrator before → after | Normal user before → after |
|---|---|---|
| 150 ms | 1.59 s → 0.85 s | 0.98 s → 0.95 s |
| 250 ms | 2.15 s → 0.80 s | 1.04 s → 1.13 s (noise) |
| 400 ms | 3.21 s → 1.07 s | 1.45 s → 1.41 s |
Firebase calls before data starts: administrator 34–35 → 22; normal user 23–24 (unchanged — the checks that stay).
The harness is not live Firebase; real times depend on the connection. The order of the calls is the real one.

## Files
Upload: `index.html`, `sw.js` (bizcore-shell-v27044). Tests: tests/browser/harness.mjs (optional `latencyMs` and a
call log per page), tests/browser/rights.e2e.mjs (+ V270.4.4 sign-in test). No emulator run needed (rules unchanged).
