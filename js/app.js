const LS_KEY = 'aledeska_pack_v3';

const S = {
  products: [],
  boxes:    [],
  order:    [],
  selBox:   null,
  confBox:  null,
};

// ── persistence ────────────────────────────────────────────────

function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ products: S.products, boxes: S.boxes }));
  } catch (e) { /* storage full */ }
}

function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (d.products) S.products = d.products;
    if (d.boxes)    S.boxes    = d.boxes;
  } catch (e) { /* corrupt */ }
}

async function persist() {
  if (isConnected()) {
    const ok = await saveToFirebase(S.products, S.boxes);
    if (!ok) saveLocal();
  } else {
    saveLocal();
  }
}

// ── modal ──────────────────────────────────────────────────────

function showModal(title, message, details) {
  // Remove any existing modal
  const existing = document.getElementById('pack-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'pack-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon">⚠️</div>
      <div class="modal-title">${title}</div>
      <div class="modal-msg">${message}</div>
      ${details ? `<div class="modal-details">${details}</div>` : ''}
      <button class="btn btn--primary modal-close" onclick="closeModal()">OK, rozumiem</button>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.body.appendChild(modal);
  // Animate in
  requestAnimationFrame(() => modal.classList.add('modal-visible'));
}

function closeModal() {
  const modal = document.getElementById('pack-modal');
  if (!modal) return;
  modal.classList.remove('modal-visible');
  setTimeout(() => modal.remove(), 200);
}

// ── tabs ───────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tc').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('tab-btn-' + name).classList.add('active');
}

// ── product list ───────────────────────────────────────────────

function filterProds(q) {
  renderPlist(q.toLowerCase());
}

function renderPlist(q) {
  const el = document.getElementById('plist');
  const filtered = S.products.filter(p =>
    p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
  );

  if (!filtered.length) {
    el.innerHTML = '<div class="empty">Brak wynikow</div>';
    return;
  }

  el.innerHTML = filtered.slice(0, 60).map(p => {
    const hasDims = p.l && p.w && p.h;
    const badge   = hasDims ? '' : '<span class="nodims">brak wymiarow</span>';
    return `<div class="pitem" onclick="addToOrder('${p.id}')">
      <div class="pitem-info">
        <div class="pitem-name">${p.name}${badge}</div>
        <div class="pdims">${p.sku} &middot; ${p.l || '?'}&times;${p.w || '?'}&times;${p.h || '?'} cm &middot; ${p.waga} kg</div>
      </div>
      <span class="pitem-add">+</span>
    </div>`;
  }).join('');
}

// ── product admin list (Import tab) ───────────────────────────

function renderProdListAdmin() {
  const el = document.getElementById('prod-list-admin');
  if (!el) return;

  const count = document.getElementById('prod-count');
  if (count) count.textContent = S.products.length + ' szt.';

  if (!S.products.length) {
    el.innerHTML = '<div class="empty">Brak produktow</div>';
    return;
  }

  el.innerHTML = S.products.map(p => {
    const hasDims = p.l && p.w && p.h;
    const dimColor = hasDims ? '#999' : '#c0392b';
    const dims = hasDims
      ? `${p.l}&times;${p.w}&times;${p.h} cm`
      : 'brak wymiarow';
    return `<label class="prod-admin-row">
      <input type="checkbox" class="prod-chk" data-id="${p.id}">
      <div class="prod-admin-info">
        <div class="prod-admin-name">${p.name}</div>
        <div class="prod-admin-meta">${p.sku} &middot; <span style="color:${dimColor}">${dims}</span> &middot; ${p.waga} kg</div>
      </div>
    </label>`;
  }).join('');
}

function prodSelectAll() {
  document.querySelectorAll('.prod-chk').forEach(c => c.checked = true);
}

function prodSelectNone() {
  document.querySelectorAll('.prod-chk').forEach(c => c.checked = false);
}

async function prodDeleteSelected() {
  const ids = [...document.querySelectorAll('.prod-chk:checked')].map(c => c.dataset.id);
  if (!ids.length) { alert('Nic nie zaznaczono.'); return; }
  if (!await checkAdminPassword()) return;
  if (!confirm(`Usunac ${ids.length} produkt${ids.length === 1 ? '' : ids.length < 5 ? 'y' : 'ow'}?`)) return;

  S.products = S.products.filter(p => !ids.includes(p.id));
  S.order    = S.order.filter(p => !ids.includes(p.id));
  await persist();
  renderPlist(document.querySelector('.srch')?.value?.toLowerCase() || '');
  renderProdListAdmin();
  renderOrder();
  refreshScene();
}

// ── order ──────────────────────────────────────────────────────

function addToOrder(id) {
  const p  = S.products.find(x => x.id === id);
  if (!p) return;
  const ex = S.order.find(x => x.id === id);
  if (ex) ex.qty++;
  else    S.order.push({ ...p, qty: 1 });

  // Reset confirmed box — order changed
  S.confBox = null;
  document.getElementById('bconfirmed').style.display = 'none';
  document.getElementById('bproposal').style.display  = 'none';

  renderOrder();

  // Check if anything fits — show modal immediately if not
  const items = flattenOrder();
  if (items.length) {
    const result = packResult();
    if (!result) {
      const totalWgt  = items.reduce((a, i) => a + i.waga, 0);
      const heaviestBox = S.boxes.length ? [...S.boxes].sort((a, b) => b.maxW - a.maxW)[0] : null;
      const biggestBox  = S.boxes.length ? [...S.boxes].sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h))[0] : null;
      let reason = '';
      if (!S.boxes.length) {
        reason = 'Brak zdefiniowanych kartonów. Dodaj kartony w zakładce <strong>Kartony</strong>.';
      } else if (heaviestBox && totalWgt + heaviestBox.ow > heaviestBox.maxW) {
        reason = `Łączna waga produktów (<strong>${totalWgt.toFixed(2)} kg</strong>) przekracza nośność największego kartonu (max ${heaviestBox.maxW} kg).`;
      } else if (biggestBox) {
        const itemVol = items.reduce((a, i) => a + i.l * i.w * i.h, 0);
        const boxVol  = biggestBox.l * biggestBox.w * biggestBox.h;
        if (itemVol > boxVol) {
          reason = `Objętość produktów (<strong>${(itemVol / 1000).toFixed(1)} l</strong>) przekracza pojemność największego kartonu (${(boxVol / 1000).toFixed(1)} l).`;
        } else {
          reason = `Wymiary poszczególnych produktów uniemożliwiają ułożenie ich w żadnym dostępnym kartonie.<br>Największy dostępny: <strong>${biggestBox.name}</strong> ${biggestBox.l}×${biggestBox.w}×${biggestBox.h} cm.`;
        }
      }
      showModal(
        'Brak pasującego kartonu',
        `Dodanie <strong>${p.name}</strong> powoduje, że zamówienie nie mieści się w żadnym kartonie.`,
        reason + '<br><br>Możliwe rozwiązania:<br>• Zmniejsz ilość produktów<br>• Dodaj większy karton w zakładce <strong>Kartony</strong>'
      );
    }
  }

  refreshScene();
}

function chgQty(id, delta) {
  const item = S.order.find(x => x.id === id);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (!item.qty) S.order = S.order.filter(x => x.id !== id);
  S.confBox = null;
  document.getElementById('bconfirmed').style.display = 'none';
  document.getElementById('bproposal').style.display  = 'none';
  renderOrder();
  refreshScene();
}

function rmOrder(id) {
  S.order = S.order.filter(x => x.id !== id);
  S.confBox = null;
  document.getElementById('bconfirmed').style.display = 'none';
  document.getElementById('bproposal').style.display  = 'none';
  renderOrder();
  refreshScene();
}

function renderOrder() {
  const el = document.getElementById('oitems');

  if (!S.order.length) {
    el.innerHTML = '<div class="empty">Dodaj produkty z listy powyzej</div>';
    document.getElementById('twgt').textContent  = '0 kg';
    document.getElementById('titms').textContent = '0 szt.';
    return;
  }

  el.innerHTML = S.order.map(p => `
    <div class="oitem">
      <div class="oitem-name">${p.name}</div>
      <div class="qty-ctrl">
        <button class="qbtn" onclick="chgQty('${p.id}', -1)">-</button>
        <span class="qty-val">${p.qty}</span>
        <button class="qbtn" onclick="chgQty('${p.id}', 1)">+</button>
      </div>
      <button class="rmv" onclick="rmOrder('${p.id}')">&times;</button>
    </div>`).join('');

  const totalW = S.order.reduce((a, p) => a + p.waga * p.qty, 0);
  const totalI = S.order.reduce((a, p) => a + p.qty, 0);
  document.getElementById('twgt').textContent  = totalW.toFixed(2) + ' kg';
  document.getElementById('titms').textContent = totalI + ' szt.';
}

// ── bin packing — Extreme Points 3D ───────────────────────────

// All unique orientations of item (l=X, w=Y/depth, h=Z/height)
function getOrientations(item) {
  const d = [item.l || 1, item.w || 1, item.h || 1];
  const perms = [
    [d[0],d[1],d[2]], [d[0],d[2],d[1]],
    [d[1],d[0],d[2]], [d[1],d[2],d[0]],
    [d[2],d[0],d[1]], [d[2],d[1],d[0]],
  ];
  const seen = new Set();
  return perms.map(([l,w,h]) => ({l,w,h})).filter(o => {
    const k = `${o.l},${o.w},${o.h}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

// Check if box [px,py,pz,pl,pw,ph] overlaps any placed item (with tiny epsilon)
function overlaps(px, py, pz, pl, pw, ph, placed) {
  for (const q of placed) {
    if (px + pl <= q.x + 1e-6 || q.x + q.l <= px + 1e-6) continue;
    if (py + pw <= q.y + 1e-6 || q.y + q.w <= py + 1e-6) continue;
    if (pz + ph <= q.z + 1e-6 || q.z + q.h <= pz + 1e-6) continue;
    return true;
  }
  return false;
}

// Extreme Points 3D bin packing
// Items sorted by volume desc. For each item, try every extreme point × every orientation.
// Extreme points = corners generated by placed items + origin.
// Choose placement that minimises max height used (z + h).
function packIntoBox(items, boxL, boxW, boxH) {
  // Sort: largest volume first so big anchors go in first
  const sorted = [...items].sort((a, b) =>
    (b.l * b.w * b.h) - (a.l * a.w * a.h)
  );

  const placed = []; // { x, y, z, l, w, h }

  // Compute extreme points from current placements
  function extremePoints() {
    const pts = [{ x: 0, y: 0, z: 0 }];
    for (const p of placed) {
      pts.push({ x: p.x + p.l, y: p.y,       z: p.z       });
      pts.push({ x: p.x,       y: p.y + p.w,  z: p.z       });
      pts.push({ x: p.x,       y: p.y,        z: p.z + p.h });
    }
    // Deduplicate and keep only those inside the box
    const seen = new Set();
    return pts.filter(pt => {
      const k = `${pt.x},${pt.y},${pt.z}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return pt.x < boxL && pt.y < boxW && pt.z < boxH;
    });
  }

  // Project a point to the lowest valid resting position:
  // drop Z down as far as possible without overlap, then drop Y, then X.
  function project(px, py, pz, pl, pw, ph) {
    // Drop Z first
    let z = pz;
    while (z > 0) {
      if (overlaps(px, py, z - 1e-6, pl, pw, ph, placed)) break;
      z = Math.max(0, z - 0.5);
      if (z === 0) break;
    }
    // Snap to exact resting surface
    let lo = 0, hi = pz;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (overlaps(px, py, mid, pl, pw, ph, placed)) lo = mid;
      else hi = mid;
    }
    return Math.max(0, hi < 0.01 ? 0 : hi);
  }

  for (const item of sorted) {
    const orients = getOrientations(item);
    const eps = extremePoints();

    let best = null; // { x, y, z, l, w, h, score }

    for (const pt of eps) {
      for (const o of orients) {
        const { l, w, h } = o;
        // Must fit within box
        if (pt.x + l > boxL + 1e-6) continue;
        if (pt.y + w > boxW + 1e-6) continue;
        if (pt.z + h > boxH + 1e-6) continue;

        // Drop to lowest resting position at this (x, y)
        const z = project(pt.x, pt.y, pt.z, l, w, h);

        if (z + h > boxH + 1e-6) continue;
        if (overlaps(pt.x, pt.y, z, l, w, h, placed)) continue;

        // Score: minimise max height used, then X spread, then Y spread
        const maxH = z + h;
        const score = maxH * 1e8 + (pt.x + l) * 1e4 + (pt.y + w);

        if (!best || score < best.score) {
          best = { x: pt.x, y: pt.y, z, l, w, h, score };
        }
      }
    }

    if (!best) return null; // Item didn't fit
    placed.push(best);
  }

  const totalH = placed.length === 0 ? 0
    : Math.max(...placed.map(p => p.z + p.h));

  return { placements: placed, totalH };
}

function flattenOrder() {
  const items = [];
  S.order.forEach(p => {
    for (let i = 0; i < p.qty; i++) {
      items.push({ l: p.l || 10, w: p.w || 10, h: p.h || 3,
                   waga: p.waga, name: p.name, sku: p.sku });
    }
  });
  return items;
}

function packResult() {
  const items = flattenOrder();
  if (!items.length) return null;
  const totalWgt = items.reduce((a, i) => a + i.waga, 0);

  const candidates = S.boxes
    .filter(b => b.maxW >= totalWgt + b.ow)
    .sort((a, b) => a.l * a.w * a.h - b.l * b.w * b.h);

  for (const box of candidates) {
    // Try both L/W orientations of the box
    for (const [bL, bW] of [[box.l, box.w], [box.w, box.l]]) {
      const result = packIntoBox(items, bL, bW, box.h);
      if (result) {
        return { box, placements: result.placements, totalH: result.totalH, totalWgt };
      }
    }
  }
  return null;
}

function getBB() {
  const items = flattenOrder();
  if (!items.length) return null;
  const maxL  = Math.max(...items.map(i => i.l));
  const maxW  = Math.max(...items.map(i => i.w));
  const totH  = items.reduce((a, i) => a + i.h, 0);
  const totWgt = items.reduce((a, i) => a + i.waga, 0);
  return { l: maxL, w: maxW, h: totH, wgt: totWgt };
}

function guessBestBox() {
  const result = packResult();
  return result ? result.box : null;
}

// ── no-fit banner (shown in 3D panel when nothing fits) ────────
function showNoFitBanner(items) {
  const el = document.getElementById('nofit-banner');
  if (!el) return;
  if (!items || !items.length) { el.style.display = 'none'; return; }

  const totalWgt = items.reduce((a, i) => a + i.waga, 0);
  const heaviest = S.boxes.reduce((mx, b) => b.maxW > mx ? b.maxW : mx, 0);
  let reason = '';
  if (!S.boxes.length) {
    reason = 'Brak zdefiniowanych kartonów.';
  } else if (totalWgt > heaviest) {
    reason = `Za ciężkie (${totalWgt.toFixed(2)} kg > max ${heaviest} kg).`;
  } else {
    reason = 'Wymiary produktów nie pasują do żadnego kartonu.';
  }
  el.innerHTML = `⚠️ Brak pasującego kartonu &mdash; ${reason}`;
  el.style.display = 'block';
}

function hideNoFitBanner() {
  const el = document.getElementById('nofit-banner');
  if (el) el.style.display = 'none';
}

// ── box proposal ───────────────────────────────────────────────

function proposeBox() {
  if (!S.order.length) return;
  const optsEl = document.getElementById('bopts');
  const wrap   = document.getElementById('bproposal');
  const items  = flattenOrder();
  const totalWgt = items.reduce((a, i) => a + i.waga, 0);

  const fitting = [];
  S.boxes
    .filter(b => b.maxW >= totalWgt + b.ow)
    .sort((a, b) => a.l * a.w * a.h - b.l * b.w * b.h)
    .forEach(b => {
      const r = packIntoBox(items, b.l, b.w, b.h);
      if (r) {
        fitting.push({ box: b, placements: r.placements, totalH: r.totalH });
      }
    });

  if (!fitting.length) {
    // Diagnose why
    const heaviestBox = S.boxes.sort((a, b) => b.maxW - a.maxW)[0];
    const biggestBox  = S.boxes.sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h))[0];

    let reason = '';
    if (heaviestBox && totalWgt + heaviestBox.ow > heaviestBox.maxW) {
      reason = `Łączna waga produktów (<strong>${totalWgt.toFixed(2)} kg</strong>) przekracza nośność największego kartonu (max ${heaviestBox.maxW} kg).`;
    } else if (biggestBox) {
      const itemVol = items.reduce((a, i) => a + i.l * i.w * i.h, 0);
      const boxVol  = biggestBox.l * biggestBox.w * biggestBox.h;
      if (itemVol > boxVol * 0.95) {
        reason = `Objętość produktów (<strong>${(itemVol / 1000).toFixed(1)} l</strong>) jest większa niż pojemność największego kartonu (${(boxVol / 1000).toFixed(1)} l).`;
      } else {
        reason = `Wymiary poszczególnych produktów uniemożliwiają ułożenie ich w żadnym dostępnym kartonie.`;
      }
    } else {
      reason = `Brak zdefiniowanych kartonów. Dodaj kartony w zakładce <strong>Kartony</strong>.`;
    }

    showModal(
      'Brak pasującego kartonu',
      'Produkty nie mieszczą się w żadnym dostępnym kartonie.',
      reason + '<br><br>Możliwe rozwiązania:<br>• Zmniejsz ilość produktów<br>• Dodaj większy karton w zakładce Kartony<br>• Sprawdź wymiary produktów'
    );

    wrap.style.display = 'none';
    return;
  }

  optsEl.innerHTML = fitting.slice(0, 5).map(({ box: b, totalH }, i) => {
    const vol     = b.l * b.w * b.h;
    const itemVol = items.reduce((a, it) => a + it.l * it.w * it.h, 0);
    const fill    = Math.round(itemVol / vol * 100);
    const best    = i === 0 ? ' best' : '';
    const tag     = i === 0 ? '<span class="best-tag">najlepszy</span>' : '';
    return `<label class="bopt${best}">
      <input type="radio" name="bop" value="${b.id}" ${i === 0 ? 'checked' : ''} onchange="setSelBox('${b.id}')">
      <div class="bopt-info">
        <div class="bopt-name">${b.name} ${tag}</div>
        <div class="bopt-dims">${b.l}&times;${b.w}&times;${b.h} cm &middot; max ${b.maxW} kg &middot; ~${fill}% wypelnienia &middot; uzyto ${totalH.toFixed(1)} cm wys.</div>
      </div>
    </label>`;
  }).join('');

  S.selBox = fitting[0].box.id;
  wrap.style.display = 'block';
  document.getElementById('bconfirmed').style.display = 'none';
}

function setSelBox(id) { S.selBox = id; }

function confirmBox() {
  const b = S.boxes.find(x => x.id === S.selBox);
  if (!b) return;
  S.confBox = b;

  const bb = getBB();
  const tw = (bb.wgt + b.ow).toFixed(2);

  document.getElementById('bconfirmed').innerHTML =
    `<div class="alert aok">${b.name} zatwierdzony &mdash; ${b.l}&times;${b.w}&times;${b.h} cm &mdash; <strong>${tw} kg</strong></div>`;
  document.getElementById('bconfirmed').style.display = 'block';
  document.getElementById('bproposal').style.display  = 'none';

  renderSummary(b, bb, tw);
  refreshScene();
}

function renderSummary(b, bb, tw) {
  const items = S.order.map(p => `${p.qty}&times; ${p.name}`).join('<br>');
  document.getElementById('summary').innerHTML = `
    <div class="sgrid">
      <div class="scard"><div class="slbl">Karton</div><div class="sval sval--sm">${b.name}</div></div>
      <div class="scard"><div class="slbl">Waga wysylki</div><div class="sval">${tw} kg</div></div>
      <div class="scard"><div class="slbl">Wymiary (cm)</div><div class="sval sval--sm">${b.l}&times;${b.w}&times;${b.h}</div></div>
      <div class="scard"><div class="slbl">Sztuk</div><div class="sval">${S.order.reduce((a, p) => a + p.qty, 0)}</div></div>
    </div>
    <div class="summary-items">${items}</div>`;
}

// ── admin auth ─────────────────────────────────────────────────
// Change ADMIN_HASH to sha256(your_password) — current: "aledeska2024"
// To generate a new hash: https://emn178.github.io/online-tools/sha256.html

const ADMIN_HASH = '97c369604a389a753fc03127905b2ad4523d04215ad4bcfee0d55b3f76654260'; // sha256("Wakacje88.")

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function isAdmin() {
  return sessionStorage.getItem('aledeska_admin') === '1';
}

async function checkAdminPassword() {
  if (isAdmin()) return true;
  const pwd = prompt('Haslo administratora (kartony):');
  if (!pwd) return false;
  const hash = await sha256(pwd);
  if (hash === ADMIN_HASH) {
    sessionStorage.setItem('aledeska_admin', '1');
    renderBoxes(); // refresh — show delete buttons
    return true;
  }
  alert('Niepoprawne haslo.');
  return false;
}

// ── boxes tab ──────────────────────────────────────────────────

async function addBox() {
  if (!await checkAdminPassword()) return;

  const name = document.getElementById('bn').value.trim();
  const l    = parseFloat(document.getElementById('bl').value);
  const w    = parseFloat(document.getElementById('bw').value);
  const h    = parseFloat(document.getElementById('bh').value);
  const maxW = parseFloat(document.getElementById('bmw').value) || 20;
  const ow   = parseFloat(document.getElementById('bow').value) || 0.5;

  if (!name || !l || !w || !h) { alert('Uzupelnij nazwe i wymiary!'); return; }

  S.boxes.push({ id: 'c' + Date.now(), name, l, w, h, maxW, ow });
  await persist();
  renderBoxes();
  ['bn', 'bl', 'bw', 'bh', 'bmw', 'bow'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

async function removeBox(id) {
  if (!await checkAdminPassword()) return;
  if (!confirm('Usunac karton?')) return;
  S.boxes = S.boxes.filter(x => x.id !== id);
  persist();
  renderBoxes();
}

function renderBoxes() {
  const el = document.getElementById('blist');
  if (!S.boxes.length) { el.innerHTML = '<div class="empty">Brak kartonow</div>'; return; }

  const admin = isAdmin();
  el.innerHTML = '<div class="blist-wrap">' +
    S.boxes.map(b => `
      <div class="blistitem">
        <span class="bbadge">${b.name}</span>
        <span class="blistitem-dims">${b.l}&times;${b.w}&times;${b.h} cm &middot; max ${b.maxW} kg</span>
        ${admin ? `<button class="rmv" onclick="removeBox('${b.id}')">&times;</button>` : ''}
      </div>`).join('') +
    '</div>';

  // Show/hide add-box form based on admin status
  const form = document.getElementById('box-add-form');
  if (form) form.style.display = admin ? 'flex' : 'none';

  // Show lock indicator when not admin
  const lockMsg = document.getElementById('box-lock-msg');
  if (lockMsg) lockMsg.style.display = admin ? 'none' : 'block';
}

// ── import / export ────────────────────────────────────────────

async function importCSV(inp) {
  if (!await checkAdminPassword()) { inp.value = ''; return; }

  const file = inp.files[0];
  if (!file) return;
  document.getElementById('impstatus').innerHTML = '<div class="alert aw">Wczytywanie...</div>';

  const reader = new FileReader();
  reader.onload = async function(e) {
    const lines = e.target.result.split('\n').map(l => l.trim()).filter(l => l);
    let added = 0, updated = 0, skipped = 0;

    lines.forEach(line => {
      const parts = line.split(';').map(x => x.trim().replace(/^"+|"+$/g, ''));
      if (parts.length < 4) { skipped++; return; }
      const [id, sku, name, wS, dS, sS, hS] = parts;
      if (!sku || !name) { skipped++; return; }

      const sf = s => parseFloat((s || '0').replace(',', '.')) || 0;
      const prod = {
        id:   id || 'i' + Date.now(),
        sku,
        name: name.replace(/<[^>]+>/g, '').substring(0, 70),
        waga: sf(wS), l: sf(dS), w: sf(sS), h: sf(hS),
      };

      // nadpisz po SKU (priorytet) lub ID
      const ex = S.products.find(x => x.sku === sku);
      const exId = !ex ? S.products.find(x => x.id === id) : null;
      if (ex)   { Object.assign(ex,   prod); updated++; }
      else if (exId) { Object.assign(exId, prod); updated++; }
      else      { S.products.push(prod);    added++; }
    });

    await persist();
    renderPlist('');
    renderProdListAdmin();
    renderNoDims();
    document.getElementById('impstatus').innerHTML =
      `<div class="alert aok">${added} nowych, ${updated} zaktualizowanych${skipped ? ', ' + skipped + ' pominieto' : ''}</div>`;
    inp.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function renderNoDims() {
  // nodims-list removed — info now shown inline in prod-list-admin (red color)
  renderProdListAdmin();
}

function exportData() {
  const json = JSON.stringify({ products: S.products, boxes: S.boxes }, null, 2);
  const a = document.createElement('a');
  a.href     = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  a.download = 'aledeska_packing_backup.json';
  a.click();
}

async function importData(inp) {
  if (!await checkAdminPassword()) { inp.value = ''; return; }
  const file = inp.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const d = JSON.parse(e.target.result);
      if (d.products) S.products = d.products;
      if (d.boxes)    S.boxes    = d.boxes;
      await persist();
      renderPlist('');
      renderBoxes();
      renderProdListAdmin();
      renderNoDims();
      alert('Dane zaimportowane.');
    } catch {
      alert('Blad pliku JSON.');
    }
    inp.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

// ── Firebase UI ────────────────────────────────────────────────

async function connectFirebaseUI() {
  const apiKey    = document.getElementById('fb-apikey').value.trim();
  const projectId = document.getElementById('fb-projectid').value.trim();
  const appId     = document.getElementById('fb-appid').value.trim();
  const statusEl  = document.getElementById('fb-status');

  try {
    await connectFirebase(apiKey, projectId, appId,
      products => { if (products) { S.products = products; renderPlist(''); renderNoDims(); } else { S.products = [...DEF_PRODS]; persist(); } },
      boxes    => { if (boxes)    { S.boxes    = boxes;    renderBoxes(); }                  else { S.boxes    = [...DEF_BOXES]; persist(); } }
    );
    statusEl.innerHTML = '<div class="alert aok">Polaczono. Dane synchronizuja sie miedzy urzadzeniami.</div>';
  } catch (e) {
    statusEl.innerHTML = `<div class="alert aerr">Blad polaczenia: ${e.message}</div>`;
  }
}

function disconnectFirebaseUI() {
  disconnectFirebase();
  document.getElementById('fb-status').innerHTML = '<div class="alert aw">Rozlaczono. Dane zapisywane lokalnie.</div>';
}

// ── scene glue ─────────────────────────────────────────────────

function refreshScene() {
  const items  = flattenOrder();
  const result = packResult();          // null = nothing fits

  if (!items.length) {
    hideNoFitBanner();
    buildScene(S.order, null, null);
    document.getElementById('leg').innerHTML = '';
    return;
  }

  if (!result) {
    // Nothing fits — show banner in viewer, show modal if user just added something
    showNoFitBanner(items);
    // Still render a ghost of the largest box so the viewer isn't empty
    const biggestBox = S.boxes.length
      ? [...S.boxes].sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h))[0]
      : null;
    buildScene(S.order, biggestBox, null);
  } else {
    hideNoFitBanner();
    const box = S.confBox || result.box;
    buildScene(S.order, box, result.placements);
  }

  document.getElementById('leg').innerHTML = S.order.map((p, i) =>
    `<div class="legit">
      <div class="legdot" style="background:${PROD_COLORS_CSS[i % PROD_COLORS_CSS.length]}"></div>
      ${p.name.substring(0, 28)}
    </div>`
  ).join('');
}

// ── init ───────────────────────────────────────────────────────

async function init() {
  loadLocal();
  if (!S.products.length) S.products = [...DEF_PRODS];
  if (!S.boxes.length)    S.boxes    = [...DEF_BOXES];

  renderPlist('');
  renderBoxes();
  renderProdListAdmin();
  initScene();      // 3D musi byc przed jakimkolwiek refreshScene
  refreshScene();

  const onProducts = products => {
    if (products) { S.products = products; renderPlist(''); renderProdListAdmin(); }
  };
  const onBoxes = boxes => {
    if (boxes) { S.boxes = boxes; renderBoxes(); }
  };

  const cfg = getSavedConfig() || FB_DEFAULT_CONFIG;
  document.getElementById('fb-apikey').value    = cfg.apiKey    || '';
  document.getElementById('fb-projectid').value = cfg.projectId || '';
  document.getElementById('fb-appid').value     = cfg.appId     || '';
  try {
    await connectFirebase(cfg.apiKey, cfg.projectId, cfg.appId, onProducts, onBoxes);
  } catch { /* offline fallback */ }
}

document.addEventListener('DOMContentLoaded', init);
