# V271.5.6 — Supplier Payments monitor count correction

- The Payments tile now reads `spreg-k-payment` (actual invoice payment count) rather than `spreg-k-live` (all non-voided payment, advance and cash-back records).
- Its amount still reflects only newly-paid cash from ordinary invoice payments, excluding advance usage that was paid earlier.
- Total Paid continues to show net cash-out from displayed non-voided records including issued supplier advances, without re-counting advances when used.
- Advances shows the *remaining available* supplier advance balance, so a fully-used advance correctly shows zero available.
- Fully/Partially/Unapplied tiles remain unavailable until their status definitions are implemented consistently with invoice-payment and advance workflows.
- No Firebase writes, payment posting changes or schema changes.
