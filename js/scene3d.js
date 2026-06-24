let renderer, scene, camera;
let isDragging = false;
let prevMouse  = { x: 0, y: 0 };
let spherical  = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 120 };

function initScene() {
  const viewer = document.getElementById('viewer');

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  viewer.appendChild(renderer.domElement);
  resizeRenderer();

  scene  = new THREE.Scene();
  scene.background = new THREE.Color(0xf0ede7);

  camera = new THREE.PerspectiveCamera(45, viewer.clientWidth / (viewer.clientHeight || 400), 0.1, 2000);
  updateCamera();

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(80, 120, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-60, 40, -60);
  scene.add(fill);

  bindControls();
  window.addEventListener('resize', () => { resizeRenderer(); renderFrame(); });
  renderFrame();
}

function resizeRenderer() {
  const viewer = document.getElementById('viewer');
  const w = viewer.clientWidth;
  const h = viewer.clientHeight || 400;
  renderer.setSize(w, h);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function updateCamera() {
  const { radius, phi, theta } = spherical;
  camera.position.set(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(0, 0, 0);
}

function renderFrame() {
  renderer.render(scene, camera);
}

function bindControls() {
  const el = renderer.domElement;

  el.addEventListener('mousedown', e => {
    isDragging = true;
    prevMouse  = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    rotate(e.clientX - prevMouse.x, e.clientY - prevMouse.y);
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('wheel', e => {
    e.preventDefault();
    zoom(e.deltaY * 0.2);
  }, { passive: false });

  let lastDist = 0;
  el.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      isDragging = true;
      prevMouse  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.touches.length === 2) {
      lastDist = touchDist(e);
    }
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && isDragging) {
      rotate(e.touches[0].clientX - prevMouse.x, e.touches[0].clientY - prevMouse.y);
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.touches.length === 2) {
      const d = touchDist(e);
      zoom(-(d - lastDist) * 0.5);
      lastDist = d;
    }
  }, { passive: true });

  el.addEventListener('touchend', () => { isDragging = false; }, { passive: true });
}

function rotate(dx, dy) {
  spherical.theta -= dx * 0.008;
  spherical.phi    = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi + dy * 0.008));
  updateCamera();
  renderFrame();
}

function zoom(delta) {
  spherical.radius = Math.max(30, Math.min(400, spherical.radius + delta));
  updateCamera();
  renderFrame();
}

function touchDist(e) {
  return Math.hypot(
    e.touches[0].clientX - e.touches[1].clientX,
    e.touches[0].clientY - e.touches[1].clientY
  );
}

function makeEdges(w, h, d, color, opacity = 1) {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const mat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.LineSegments(geo, mat);
}

function buildScene(order, box) {
  // remove old meshes
  const toRemove = [];
  scene.traverse(o => { if (o.isMesh || o.isLineSegments) toRemove.push(o); });
  toRemove.forEach(o => scene.remove(o));

  if (!box && !order.length) { renderFrame(); return; }

  const bL = box ? box.l : 60;
  const bW = box ? box.w : 50;
  const bH = box ? box.h : 40;

  scene.position.set(-bL / 2, -bH / 2, -bW / 2);

  // carton shell
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xd4c9b0, transparent: true, opacity: 0.12, side: THREE.BackSide,
  });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(bL, bH, bW), wallMat);
  shell.position.set(bL / 2, bH / 2, bW / 2);
  scene.add(shell);

  const edgesBox = makeEdges(bL, bH, bW, 0x8a7560);
  edgesBox.position.copy(shell.position);
  scene.add(edgesBox);

  // floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xc8bc9e, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(bL, bW), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(bL / 2, 0, bW / 2);
  scene.add(floor);

  // products
  const PAD = 0.5;
  let curY = PAD;

  order.forEach((item, idx) => {
    const color = PROD_COLORS_HEX[idx % PROD_COLORS_HEX.length];
    const pl    = Math.min(item.l || 10, bL - PAD * 2);
    const pw    = Math.min(item.w || 10, bW - PAD * 2);
    const ph    = item.h || 3;

    for (let i = 0; i < item.qty; i++) {
      if (curY + ph > bH) break;

      const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pl, ph, pw), mat);
      mesh.position.set(PAD + pl / 2, curY + ph / 2, PAD + pw / 2);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const pe = makeEdges(pl, ph, pw, 0x000000, 0.12);
      pe.position.copy(mesh.position);
      scene.add(pe);

      curY += ph;
    }
  });

  // fit camera
  const diag = Math.sqrt(bL * bL + bH * bH + bW * bW);
  spherical.radius = diag * 1.1;
  updateCamera();
  renderFrame();
}
