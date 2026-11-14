# V267.2 — Cash ledger with custodian confirmation (15 Oct 2026)

Step 2 of the purchase/accounting plan. Approved mockups: CASH_custodian, CASH_staff, CASH_phone, CASH_login.

## What the user sees
- **Finance → Cash & Bank** (office staff). Accounts with balance and ⏳ waiting / ⚠ queried counts, plus the total. The ledger of the chosen account shows date, voucher, details, in, out, running balance and each line's custodian status. It also has **New handover**, **Statement** (print, with a date range) and filters for All / Waiting / Queried. Click a TRF voucher to correct the amount, date or note, or to **cancel** the handover with a reason.
- **My Cash** (`mycash.html`) is the only screen of a cash custodian login. It shows Balance, Confirmed balance, Waiting for you and Queried, and the ledger with **Confirm**, **Query** (a note is required) and **Confirm all waiting**. **Hand over cash** works from the custodian's own account. Phones get cards. The custodian must change the temporary password at first login.
- **Administration → Users → Cash custodian logins** lists the logins, with **New cash custodian login** (also on Payment Accounts) and Activate / Deactivate. Logins are never deleted.
- **Payment Accounts form** has a new **Custodian login** field (optional). Linking a login moves the account's existing lines to that login.
- When a custodian queries a line, the office sees a red badge on Cash & Bank and gets a notification.

## Rules agreed
- Confirmation never holds an entry. The amount counts in the balance at once; the line just stays ⏳.
- Only the custodian confirms. An administrator confirms *for* a custodian who has no login, and the line is marked "(for custodian)". Administrators confirm their own cash like anyone.
- Handover: only the receiver confirms. The giver's line shows the answer, e.g. "Musthafa KM confirmed receipt 14-10 18:20".
- An edit of the amount or date sends the line back to ⏳ (the query note stays visible). A note-only edit keeps it confirmed.
- Nothing is deleted. A cancelled handover stays in the ledger, struck through, and is not counted.

## Data (accounting-ready)
| Collection | What it holds |
|---|---|
| `cashEntries/{trf-…}` | One balanced entry: `lines [{accountId, debit, credit}]` with Σdebit = Σcredit, voucher `TRF-YYMM-0001` (counter `counters/doc_cashTransfer_YYYYMM`), revision, void. |
| `cashLines/{entryId}__{accountId}` | The posting on one account (`amountIn` = debit, `amountOut` = credit). Confirmation: `status` pending / confirmed / queried / none, `statusBy…`, `statusAt`, `statusNote`, `onBehalf`. The account's `custodianUid` is copied here for the custodian's query. |
| `cashCustodians/{uid}` | Marks a login as cash-only: name, email, accountIds, active, mustChangePassword. Written by administrators. |
| `userDirectory/{uid}` | Every login records its own name and email, used to link an account to a login. |

The opening balance is shown as the first row from the account itself. The chart-of-accounts step will post it as a journal. Receipts (step 3) and payments (steps 4–5) will add their own entries and lines in the same shape.

## Security rules — IMPORTANT
- Every rule that said "any signed-in user" now says **staff()**: signed in **and not** a cash custodian login. The admin flag is unchanged.
- A custodian login can read only: its own `cashCustodians` record, cash-type `paymentAccounts`, the `cashLines` of its own accounts, `system/accessControl`, and its own handover entries. It can write only: confirm or query its own lines, record a handover from its own account (plus the TRF counter), and clear its password flag.
- Each line's custodian rights, the balanced entry, the voucher counter and the "edit → back to ⏳" behaviour are enforced by the rules, not just the screen.
- Known limits:
  - A deactivated custodian can still sign in to Firebase but sees nothing. To block the sign-in completely, disable the user in the Firebase Console → Authentication.
  - Cloud Storage files (product images, attachments) aren't covered by these Firestore rules; their links are only shown inside BizCore.
- **Run the emulator tests on the PC before publishing** (`RUN_EMULATOR_TESTS.bat`, new file `tests/emulator/ledger.test.mjs`). These rules could not be run here.

## Files
- **New:**
  - `mycash.html`
  - `js/ledger-core.mjs`, `js/ledger-service.mjs`
  - `js/cash-ui.js`, `js/cashbank.js`
  - `css/cash.css`
  - `tests/ledger-service.test.mjs`, `tests/browser/cashbank.e2e.mjs`, `tests/emulator/ledger.test.mjs`
- **Changed:**
  - `index.html` (Finance menu, Cash & Bank page, Users card, BizCoreCash, custodian redirect)
  - `login.html` (custodian → My Cash)
  - `js/app.js` (page hook, notification routing)
  - `js/accounts.js` (custodian login field)
  - `firestore.rules`, `emulator/firestore.rules`
  - `sw.js`
  - `package.json`, `tests/emulator/package.json`
  - `tests/browser/fake-sdk/firebase-auth.js`
