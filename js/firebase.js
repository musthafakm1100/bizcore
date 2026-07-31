/* ═══════════════════════════════════════════════════════════════
   BIZCORE — FIREBASE INTEGRATION
   Downtown Trading Est.
   Connects to Firebase Firestore for shared cloud data storage
   and Firebase Auth for secure employee login.
═══════════════════════════════════════════════════════════════ */

/* ── Firebase SDKs (loaded via CDN in index.html) ── */
import { initializeApp }                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc,
         collection, getDocs, deleteDoc }             from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }                from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ── Your Firebase project configuration ── */
const firebaseConfig = {
  apiKey:            "AIzaSyCsgVVIU_AZpWgTrZo_jrlCQVgZusCI_zY",
  authDomain:        "bizcore-downtown.firebaseapp.com",
  projectId:         "bizcore-downtown",
  storageBucket:     "bizcore-downtown.firebasestorage.app",
  messagingSenderId: "864406054158",
  appId:             "1:864406054158:web:190929f0cc60e12e77e35f"
};

/* ── Initialize Firebase ── */
const fbApp  = initializeApp(firebaseConfig);
const db     = getFirestore(fbApp);
const fbAuth = getAuth(fbApp);

/* ═══════════════════════════════════════════════════════════════
   AUTHENTICATION
═══════════════════════════════════════════════════════════════ */

/* Sign in with email and password */
async function fbSignIn(email, password) {
  const cred = await signInWithEmailAndPassword(fbAuth, email, password);
  return cred.user;
}

/* Sign out */
async function fbSignOut() {
  await signOut(fbAuth);
}

/* Watch auth state — calls callback(user) or callback(null) */
function fbOnAuthChange(callback) {
  onAuthStateChanged(fbAuth, callback);
}

/* ═══════════════════════════════════════════════════════════════
   FIRESTORE — COLLECTIONS
   Each collection = one data type (like a database table)
═══════════════════════════════════════════════════════════════ */

const COLLECTIONS = {
  quotations:    'quotations',
  customers:     'customers',
  suppliers:     'suppliers',
  products:      'products',
  rfqs:          'rfqs',
  salesOrders:   'salesOrders',
  employees:     'employees',
  settings:      'settings',
  deliveryTerms: 'deliveryTerms',
  paymentTerms:  'paymentTerms',
  taxMaster:     'taxMaster',
  uomMaster:     'uomMaster',
  costComponents:'costComponents',
  marginStatuses:'marginStatuses',
  pricingSettings:'pricingSettings',
};

/* ═══════════════════════════════════════════════════════════════
   GENERIC READ / WRITE HELPERS
═══════════════════════════════════════════════════════════════ */

/* Save an ARRAY of records to a Firestore collection.
   Strategy: store the whole array as a single document called 'data'.
   Simple, fast, and maps cleanly to BizCore's in-memory arrays. */
async function fbSaveCollection(collectionName, dataArray) {
  try {
    const ref = doc(db, collectionName, 'data');
    await setDoc(ref, { records: JSON.stringify(dataArray), updatedAt: Date.now() });
    return true;
  } catch(e) {
    console.warn('Firebase save failed for', collectionName, e.message);
    return false;
  }
}

/* Load an array from a Firestore collection */
async function fbLoadCollection(collectionName) {
  try {
    const ref  = doc(db, collectionName, 'data');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return JSON.parse(data.records || '[]');
  } catch(e) {
    console.warn('Firebase load failed for', collectionName, e.message);
    return null;
  }
}

/* Save a single settings object (not an array) */
async function fbSaveSettings(settingsObj) {
  try {
    const ref = doc(db, 'settings', 'main');
    await setDoc(ref, { data: JSON.stringify(settingsObj), updatedAt: Date.now() });
    return true;
  } catch(e) {
    console.warn('Firebase settings save failed:', e.message);
    return false;
  }
}

/* Load settings object */
async function fbLoadSettings() {
  try {
    const ref  = doc(db, 'settings', 'main');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return JSON.parse(snap.data().data || 'null');
  } catch(e) {
    console.warn('Firebase settings load failed:', e.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT — make available to app.js
═══════════════════════════════════════════════════════════════ */
window.FB = {
  signIn:          fbSignIn,
  signOut:         fbSignOut,
  onAuthChange:    fbOnAuthChange,
  saveCollection:  fbSaveCollection,
  loadCollection:  fbLoadCollection,
  saveSettings:    fbSaveSettings,
  loadSettings:    fbLoadSettings,
  COLLECTIONS,
};

console.log('Firebase module loaded ✅');
