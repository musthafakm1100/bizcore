# Firestore indexes — Price History (V270.1.3)

**Status: all 4 created by Musthafa in the Firebase console on 23 Oct 2026 and Enabled (no duplicates).**

Price History asks Firebase for "the newest 5 purchase invoices / quotations that contain this item" and then the
next 5. Firebase needs a ready-made lookup list for that, called an **index**.
- Indexes are free, and Firebase keeps them up to date by itself.
- They change no data and no rules.
- Without them the History window says "Price History needs the Firebase indexes…"; everything else works.

The four indexes are in **`firestore.indexes.json`** (in the project folder):

| Collection | Fields (in this order) | Used for |
|---|---|---|
| purchaseInvoices | itemKeys **Array contains** · date **Descending** | Buying history |
| purchaseInvoices | itemKeys **Array contains** · supplierId **Ascending** · date **Descending** | Buying history, one supplier |
| quotations | itemKeys **Array contains** · status **Ascending** · date **Descending** | Selling history (Sent / Won / Lost / Expired, or one status) |
| quotations | itemKeys **Array contains** · custId **Ascending** · status **Ascending** · date **Descending** | Selling history, this customer |

## Option 1 — Firebase console (no tools needed)
1. Open console.firebase.google.com → project **bizcore-downtown** → **Firestore Database** → **Indexes** →
   **Composite** → **Create index**.
2. For each row of the table:
   - Collection ID: as shown. Add the fields in the same order, choosing "Array contains", "Ascending" or "Descending".
   - Query scope: **Collection**. Then press **Create**.
3. Wait until each index shows **Enabled**. That usually takes a few minutes.

## Option 2 — Firebase CLI (on the PC, in the project folder)
```
firebase deploy --only firestore:indexes --project bizcore-downtown
```
This deploys only `firestore.indexes.json` — not the rules, not the website. If it asks to delete indexes that are
"not in the file", answer **No**.

## Shortcut
Open History once in the live app before the indexes exist. The browser console (F12) then shows Firebase's error
with a direct "create index" link for the missing index. Clicking it fills the form for you.

## Notes
- **Quotations:** they store `itemKeys` (the item keys of their lines) from V270.1.3 on, as part of their normal save,
  so there is no extra write. Quotations saved before that don't appear in Selling history; that is test data, agreed.
- **Purchase invoices:** these already store `itemKeys`.
- **Firebase usage:**
  - One page costs at most 5 document reads.
  - Pages are kept for the session, so reopening History, or switching back to an earlier filter, reads nothing.
  - Opening a document from the list reads nothing more.
  - Browsing History writes nothing.
