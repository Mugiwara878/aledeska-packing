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

// ── order ──────────────────────────────────────────────────────

function addToOrder(id) {
  const p  = S.products.find(x => x.id === id);
  if (!p) return;
  const ex = S.order.find(x => x.id === id);
  if (ex) ex.qty++;
  else    S.order.push({ ...p, qty: 1 });

  renderOrder();
  refreshScene();
  document.getElementById('bproposal').style.display  = 'none';
  document.getElementById('bconfirmed').style.display = 'none';
}

function chgQty(id, delta) {
  const item = S.order.find(x => x.id === id);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (!item.qty) S.order = S.order.filter(x => x.id !== id);
  renderOrder();
  refreshScene();
}

function rmOrder(id) {
  S.order = S.order.filter(x => x.id !== id);
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

// ── bounding box ───────────────────────────────────────────────

function getBB() {
  if (!S.order.length) return null;
  let maxL = 0, maxW = 0, totH = 0, totWgt = 0;
  S.order.forEach(p => {
    for (let i = 0; i < p.qty; i++) {
      if ((p.l || 0) > maxL) maxL = p.l || 0;
      if ((p.w || 0) > maxW) maxW = p.w || 0;
      totH   += p.h   || 0;
      totWgt += p.waga;
    }
  });
  return { l: maxL, w: maxW, h: totH, wgt: totWgt };
}

function guessBestBox() {
  const bb = getBB();
  if (!bb) return null;
  return S.boxes.find(b =>
    b.l >= bb.l + 4 && b.w >= bb.w + 4 && b.h >= bb.h + 4 && b.maxW >= bb.wgt + b.ow
  ) || S.boxes[S.boxes.length - 1];
}

// ── box proposal ───────────────────────────────────────────────

function proposeBox() {
  if (!S.order.length) return;
  const bb  = getBB();
  const PAD = 4;
  const opts = S.boxes
    .filter(b => b.l >= bb.l + PAD && b.w >= bb.w + PAD && b.h >= bb.h + PAD && b.maxW >= bb.wgt + b.ow)
    .sort((a, b) => a.l * a.w * a.h - b.l * b.w * b.h);

  const optsEl = document.getElementById('bopts');
  const wrap   = document.getElementById('bproposal');

  if (!opts.length) {
    optsEl.innerHTML = '<div class="alert aw">Zaden karton nie pasuje. Sprawdz wymiary lub dodaj wiekszy karton.</div>';
    wrap.style.display = 'block';
    return;
  }

  optsEl.innerHTML = opts.slice(0, 5).map((b, i) => {
    const vol  = b.l * b.w * b.h;
    const fill = bb.l && bb.w && bb.h ? Math.round(bb.l * bb.w * bb.h / vol * 100) : 0;
    const best = i === 0 ? ' best' : '';
    const tag  = i === 0 ? '<span class="best-tag">najlepszy</span>' : '';
    return `<label class="bopt${best}">
      <input type="radio" name="bop" value="${b.id}" ${i === 0 ? 'checked' : ''} onchange="setSelBox('${b.id}')">
      <div class="bopt-info">
        <div class="bopt-name">${b.name} ${tag}</div>
        <div class="bopt-dims">${b.l}&times;${b.w}&times;${b.h} cm &middot; max ${b.maxW} kg &middot; ~${fill}% wypelnienia</div>
      </div>
    </label>`;
  }).join('');

  S.selBox = opts[0].id;
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

// ── boxes tab ──────────────────────────────────────────────────

async function addBox() {
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

function removeBox(id) {
  if (!confirm('Usunac karton?')) return;
  S.boxes = S.boxes.filter(x => x.id !== id);
  persist();
  renderBoxes();
}

function renderBoxes() {
  const el = document.getElementById('blist');
  if (!S.boxes.length) { el.innerHTML = '<div class="empty">Brak kartonow</div>'; return; }

  el.innerHTML = '<div class="blist-wrap">' +
    S.boxes.map(b => `
      <div class="blistitem">
        <span class="bbadge">${b.name}</span>
        <span class="blistitem-dims">${b.l}&times;${b.w}&times;${b.h} cm &middot; max ${b.maxW} kg</span>
        <button class="rmv" onclick="removeBox('${b.id}')">&times;</button>
      </div>`).join('') +
    '</div>';
}

// ── import / export ────────────────────────────────────────────

function importCSV(inp) {
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

      const ex = S.products.find(x => x.sku === sku || x.id === id);
      if (ex) { Object.assign(ex, prod); updated++; }
      else    { S.products.push(prod);   added++; }
    });

    await persist();
    renderPlist('');
    renderNoDims();
    document.getElementById('impstatus').innerHTML =
      `<div class="alert aok">${added} nowych, ${updated} zaktualizowanych${skipped ? ', ' + skipped + ' pominieto' : ''}</div>`;
    inp.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function renderNoDims() {
  const el = document.getElementById('nodims-list');
  const nd = S.products.filter(p => !p.l || !p.w || !p.h);

  if (!nd.length) {
    el.innerHTML = '<div class="empty">Wszystkie produkty maja wymiary</div>';
    return;
  }

  el.innerHTML = `<div class="nodims-count">${nd.length} produktow bez wymiarow:</div>` +
    nd.map(p => `<div class="nodims-row">${p.sku} &mdash; ${p.name.substring(0, 45)}</div>`).join('');
}

function exportData() {
  const json = JSON.stringify({ products: S.products, boxes: S.boxes }, null, 2);
  const a = document.createElement('a');
  a.href     = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  a.download = 'aledeska_packing_backup.json';
  a.click();
}

function importData(inp) {
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
  const box = S.confBox || guessBestBox();
  buildScene(S.order, box);

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
  renderNoDims();
  initScene();
  refreshScene();

  const onProducts = products => { if (products) { S.products = products; renderPlist(''); renderNoDims(); } };
  const onBoxes    = boxes    => { if (boxes)    { S.boxes    = boxes;    renderBoxes(); } };

  const cfg = getSavedConfig() || FB_DEFAULT_CONFIG;
  document.getElementById('fb-apikey').value    = cfg.apiKey    || '';
  document.getElementById('fb-projectid').value = cfg.projectId || '';
  document.getElementById('fb-appid').value     = cfg.appId     || '';
  try {
    await connectFirebase(cfg.apiKey, cfg.projectId, cfg.appId, onProducts, onBoxes);
  } catch { /* offline fallback */ }
}

document.addEventListener('DOMContentLoaded', init);
