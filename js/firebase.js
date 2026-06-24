const FB_LS_KEY = 'aledeska_fb_cfg';

const FB_DEFAULT_CONFIG = {
  apiKey:        'AIzaSyC_R52ydCLoRK98qh6rFCswG_qCoPBr-T0',
  projectId:     'asystent-pakowania',
  appId:         '1:501177505134:web:cad2810d5378cdfa979d7f',
  authDomain:    'asystent-pakowania.firebaseapp.com',
  storageBucket: 'asystent-pakowania.appspot.com',
};

let db = null;
let unsubscribers = [];

function setSyncStatus(msg, type) {
  const el = document.getElementById('sync-status');
  el.textContent = msg;
  el.className = type || '';
}

function isConnected() {
  return db !== null;
}

async function saveToFirebase(products, boxes) {
  if (!db) return false;
  setSyncStatus('Zapisywanie...', 'syncing');
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    await setDoc(doc(db, 'packing', 'products'), { list: products });
    await setDoc(doc(db, 'packing', 'boxes'),    { list: boxes });
    setSyncStatus('Zsynchronizowano');
    return true;
  } catch (e) {
    setSyncStatus('Blad zapisu', 'error');
    return false;
  }
}

async function connectFirebase(apiKey, projectId, appId, onProducts, onBoxes) {
  if (!apiKey || !projectId) {
    alert('Uzupelnij API Key i Project ID!');
    return false;
  }
  const cfg = {
    apiKey,
    authDomain:     `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket:  `${projectId}.appspot.com`,
    appId:          appId || undefined,
  };
  try {
    await initFB(cfg, onProducts, onBoxes);
    localStorage.setItem(FB_LS_KEY, JSON.stringify(cfg));
    return true;
  } catch (e) {
    throw e;
  }
}

async function initFB(cfg, onProducts, onBoxes) {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const { getFirestore, doc, setDoc, getDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  let app;
  try   { app = initializeApp(cfg); }
  catch { app = initializeApp(cfg, 'app_' + Date.now()); }

  db = getFirestore(app);
  setSyncStatus('Laczenie...', 'syncing');

  const [pSnap, bSnap] = await Promise.all([
    getDoc(doc(db, 'packing', 'products')),
    getDoc(doc(db, 'packing', 'boxes')),
  ]);

  const products = pSnap.exists() ? pSnap.data().list || [] : null;
  const boxes    = bSnap.exists() ? bSnap.data().list || [] : null;

  if (onProducts) onProducts(products);
  if (onBoxes)    onBoxes(boxes);

  unsubscribers.forEach(u => u());
  unsubscribers = [];

  unsubscribers.push(onSnapshot(doc(db, 'packing', 'products'), s => {
    if (s.exists() && onProducts) onProducts(s.data().list || []);
  }));
  unsubscribers.push(onSnapshot(doc(db, 'packing', 'boxes'), s => {
    if (s.exists() && onBoxes) onBoxes(s.data().list || []);
  }));

  setSyncStatus('Zsynchronizowano');
}

function disconnectFirebase() {
  unsubscribers.forEach(u => u());
  unsubscribers = [];
  db = null;
  localStorage.removeItem(FB_LS_KEY);
  setSyncStatus('Lokalnie');
}

function getSavedConfig() {
  try { return JSON.parse(localStorage.getItem(FB_LS_KEY) || 'null'); }
  catch { return null; }
}
