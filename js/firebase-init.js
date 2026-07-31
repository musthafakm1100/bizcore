/* ═══════════════════════════════════════════════════════════════
   BIZCORE — FIREBASE INIT & AUTH GUARD
   Runs before app.js — checks login, redirects to login.html
   if not authenticated, then exposes Firebase APIs to app.js
═══════════════════════════════════════════════════════════════ */
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCsgVVIU_AZpWgTrZo_jrlCQVgZusCI_zY",
  authDomain:        "bizcore-downtown.firebaseapp.com",
  projectId:         "bizcore-downtown",
  storageBucket:     "bizcore-downtown.firebasestorage.app",
  messagingSenderId: "864406054158",
  appId:             "1:864406054158:web:190929f0cc60e12e77e35f"
};

const fbApp  = initializeApp(firebaseConfig);
const auth   = getAuth(fbApp);
const db     = getFirestore(fbApp);

/* ── Save entire array to Firestore ── */
async function fbSave(collectionName, dataArray) {
  try {
    await setDoc(doc(db, collectionName, 'data'), {
      records:   JSON.stringify(dataArray),
      updatedAt: Date.now()
    });
    return true;
  } catch(e) {
    console.warn('FB save failed:', collectionName, e.message);
    return false;
  }
}

/* ── Load array from Firestore ── */
async function fbLoad(collectionName) {
  try {
    const snap = await getDoc(doc(db, collectionName, 'data'));
    if (!snap.exists()) return null;
    return JSON.parse(snap.data().records || '[]');
  } catch(e) {
    console.warn('FB load failed:', collectionName, e.message);
    return null;
  }
}

/* ── Save settings object ── */
async function fbSaveSettings(obj) {
  try {
    await setDoc(doc(db, 'settings', 'main'), {
      data:      JSON.stringify(obj),
      updatedAt: Date.now()
    });
    return true;
  } catch(e) {
    console.warn('FB settings save failed:', e.message);
    return false;
  }
}

/* ── Load settings object ── */
async function fbLoadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'main'));
    if (!snap.exists()) return null;
    return JSON.parse(snap.data().data || 'null');
  } catch(e) {
    console.warn('FB settings load failed:', e.message);
    return null;
  }
}

/* ── Expose to global scope for app.js ── */
window.FB = { fbSave, fbLoad, fbSaveSettings, fbLoadSettings };
window.fbAuth = auth;

/* ── Auth guard ── */
let authResolved = false;

onAuthStateChanged(auth, user => {
  if (authResolved) return;
  authResolved = true;

  if (!user) {
    // Not logged in — redirect to login page
    window.location.href = 'login.html';
    return;
  }

  // Logged in — store current user info globally
  window.currentUser = {
    uid:   user.uid,
    email: user.email,
    name:  user.displayName || user.email.split('@')[0]
  };

  // Hide the loading overlay, reveal the app
  const overlay = document.getElementById('auth-loading');
  if (overlay) {
    overlay.style.transition = 'opacity .3s';
    overlay.style.opacity    = '0';
    setTimeout(() => overlay.remove(), 350);
  }

  // Add sign-out button to topbar
  addSignOutButton(user);

  console.log('BizCore authenticated ✅ —', user.email);
});

function addSignOutButton(user) {
  // Wait for DOM to be ready
  const tryAdd = () => {
    const topbarActions = document.querySelector('.topbar-actions');
    if (!topbarActions) { setTimeout(tryAdd, 300); return; }

    // Avoid duplicate
    if (document.getElementById('fb-signout-btn')) return;

    const userBtn = document.createElement('div');
    userBtn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:0 10px;border-left:1px solid var(--border)';
    userBtn.innerHTML = `
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:600;color:var(--blue);line-height:1.2">${user.displayName || 'User'}</div>
        <div style="font-size:10px;color:var(--gray);line-height:1.2">${user.email}</div>
      </div>
      <button id="fb-signout-btn"
        style="height:32px;padding:0 10px;border:1.5px solid var(--border);border-radius:6px;background:#fff;cursor:pointer;font-size:12px;color:var(--gray);display:flex;align-items:center;gap:5px;white-space:nowrap"
        onclick="window.FB_SIGNOUT()">
        <i class="ti ti-logout" style="font-size:14px"></i> Sign out
      </button>`;
    topbarActions.insertBefore(userBtn, topbarActions.firstChild);
  };
  setTimeout(tryAdd, 500);
}

/* ── Global sign-out function ── */
window.FB_SIGNOUT = async function() {
  if (!confirm('Sign out of BizCore?')) return;
  await signOut(auth);
  window.location.href = 'login.html';
};

console.log('Firebase init module loaded ✅');
