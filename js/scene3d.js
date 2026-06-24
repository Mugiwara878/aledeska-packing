let renderer, scene, camera;
let isDragging      = false;
let prevMouse       = { x: 0, y: 0 };
let spherical       = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 120 };
let selectedMesh    = null;
let productMeshes   = [];
let productEdges    = [];
let raycaster, dragPlane, dragOffset;
let isMovingProduct = false;
let boxBounds       = { l: 0, w: 0, h: 0 };

// For real-time collision: store last confirmed valid position & drag state
let lastValidPos    = new THREE.Vector3();
let isColliding     = false;

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

  raycaster  = new THREE.Raycaster();
  dragPlane  = new THREE.Plane();
  dragOffset = new THREE.Vector3();

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
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
  if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
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

function renderFrame() { if (renderer && scene && camera) renderer.render(scene, camera); }

function getNDC(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width)  *  2 - 1,
    ((clientY - rect.top)  / rect.height) * -2 + 1
  );
}

function pickProduct(clientX, clientY) {
  raycaster.setFromCamera(getNDC(clientX, clientY), camera);
  const hits = raycaster.intersectObjects(productMeshes, false);
  return hits.length > 0 ? hits[0] : null;
}

function getMeshDims(mesh) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const s = new THREE.Vector3();
  geo.boundingBox.getSize(s);
  return s;
}

function clampToBounds(mesh) {
  const dims = getMeshDims(mesh);
  const hw = dims.x / 2, hh = dims.y / 2, hd = dims.z / 2;
  mesh.position.x = Math.max(hw, Math.min(boxBounds.l - hw, mesh.position.x));
  mesh.position.y = Math.max(hh, Math.min(boxBounds.h - hh, mesh.position.y));
  mesh.position.z = Math.max(hd, Math.min(boxBounds.w - hd, mesh.position.z));
}

function getAABB(mesh) {
  const dims = getMeshDims(mesh);
  const p    = mesh.position;
  return {
    minX: p.x - dims.x / 2, maxX: p.x + dims.x / 2,
    minY: p.y - dims.y / 2, maxY: p.y + dims.y / 2,
    minZ: p.z - dims.z / 2, maxZ: p.z + dims.z / 2,
  };
}

function aabbOverlap(a, b, margin) {
  const m = margin !== undefined ? margin : 0.15;
  return a.maxX > b.minX + m && a.minX < b.maxX - m &&
         a.maxY > b.minY + m && a.minY < b.maxY - m &&
         a.maxZ > b.minZ + m && a.minZ < b.maxZ - m;
}

function hasCollision(mesh) {
  const a = getAABB(mesh);
  for (const other of productMeshes) {
    if (other === mesh) continue;
    if (aabbOverlap(a, getAABB(other))) return true;
  }
  return false;
}

// Set mesh visual to collision state (red tint) or normal
function setCollisionVisual(mesh, colliding) {
  if (!mesh) return;
  if (colliding) {
    mesh.material.emissive.setHex(0xcc2200);
    mesh.material.emissiveIntensity = 0.45;
  } else {
    // Restore selection highlight or normal
    mesh.material.emissive.setHex(0xffffff);
    mesh.material.emissiveIntensity = 0.22;
  }
}

function selectMesh(mesh) {
  if (selectedMesh) {
    selectedMesh.material.emissive.setHex(0x000000);
    selectedMesh.material.emissiveIntensity = 0;
  }
  selectedMesh = mesh;
  isColliding  = false;
  if (mesh) {
    mesh.material.emissive.setHex(0xffffff);
    mesh.material.emissiveIntensity = 0.22;
  }
  updateRotateBtn();
  renderFrame();
}

function updateRotateBtn() {
  const btn = document.getElementById('rotate-btn');
  if (btn) btn.style.display = selectedMesh ? 'inline-block' : 'none';
}

function rotateMesh90() {
  if (!selectedMesh) return;
  const geo  = selectedMesh.geometry;
  geo.computeBoundingBox();
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  const oldL = size.x, oldW = size.z;
  const saved = selectedMesh.position.clone();

  selectedMesh.geometry = new THREE.BoxGeometry(oldW, size.y, oldL);
  clampToBounds(selectedMesh);

  const idx = productMeshes.indexOf(selectedMesh);
  if (idx >= 0 && productEdges[idx]) {
    scene.remove(productEdges[idx]);
    const pe = makeEdges(oldW, size.y, oldL, 0x000000, 0.1);
    pe.position.copy(selectedMesh.position);
    scene.add(pe);
    productEdges[idx] = pe;
  }

  if (hasCollision(selectedMesh)) {
    selectedMesh.geometry = new THREE.BoxGeometry(oldL, size.y, oldW);
    selectedMesh.position.copy(saved);
    clampToBounds(selectedMesh);
    if (idx >= 0 && productEdges[idx]) {
      scene.remove(productEdges[idx]);
      const pe = makeEdges(oldL, size.y, oldW, 0x000000, 0.1);
      pe.position.copy(selectedMesh.position);
      scene.add(pe);
      productEdges[idx] = pe;
    }
  }

  lastValidPos.copy(selectedMesh.position);
  renderFrame();
}

// Slide the mesh toward a target position, stopping just before collision
// Uses binary search to find the furthest safe position along the movement vector
function slideTowards(mesh, targetPos) {
  const startPos = lastValidPos.clone();
  const clamped  = targetPos.clone();

  // First clamp to box
  const dims = getMeshDims(mesh);
  const hw = dims.x / 2, hh = dims.y / 2, hd = dims.z / 2;
  clamped.x = Math.max(hw, Math.min(boxBounds.l - hw, clamped.x));
  clamped.y = Math.max(hh, Math.min(boxBounds.h - hh, clamped.y));
  clamped.z = Math.max(hd, Math.min(boxBounds.w - hd, clamped.z));

  // Check if target is already collision-free
  mesh.position.copy(clamped);
  if (!hasCollision(mesh)) {
    lastValidPos.copy(clamped);
    isColliding = false;
    return false; // no collision
  }

  // Binary search: find the largest t in [0,1] where start + t*(clamped-start) is safe
  let lo = 0, hi = 1;
  const dir = new THREE.Vector3().subVectors(clamped, startPos);

  // Only search if there's meaningful movement
  if (dir.lengthSq() < 0.001) {
    mesh.position.copy(startPos);
    isColliding = true;
    return true;
  }

  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    mesh.position.copy(startPos).addScaledVector(dir, mid);
    if (hasCollision(mesh)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  mesh.position.copy(startPos).addScaledVector(dir, lo);
  if (lo > 0.001) lastValidPos.copy(mesh.position);
  isColliding = true;
  return true;
}

function bindControls() {
  const el = renderer.domElement;

  el.addEventListener('mousedown', e => {
    const hit = pickProduct(e.clientX, e.clientY);
    if (hit) {
      selectMesh(hit.object);
      isMovingProduct = true;
      lastValidPos.copy(hit.object.position);
      isColliding = false;
      const normal = camera.position.clone().normalize();
      dragPlane.setFromNormalAndCoplanarPoint(normal, hit.point);
      dragOffset.copy(hit.object.position).sub(hit.point);
    } else {
      selectMesh(null);
      isMovingProduct = false;
      isDragging = true;
    }
    prevMouse = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    if (isMovingProduct && selectedMesh) {
      // On release, ensure we're at the valid position
      if (isColliding) {
        selectedMesh.position.copy(lastValidPos);
      }
      isColliding = false;
      setCollisionVisual(selectedMesh, false);

      const idx = productMeshes.indexOf(selectedMesh);
      if (idx >= 0 && productEdges[idx]) productEdges[idx].position.copy(selectedMesh.position);
      renderFrame();
    }
    isDragging = false;
    isMovingProduct = false;
  });

  window.addEventListener('mousemove', e => {
    if (isMovingProduct && selectedMesh) {
      raycaster.setFromCamera(getNDC(e.clientX, e.clientY), camera);
      const target = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, target)) {
        const desiredPos = target.add(dragOffset);
        const collided   = slideTowards(selectedMesh, desiredPos);

        setCollisionVisual(selectedMesh, collided);

        const idx = productMeshes.indexOf(selectedMesh);
        if (idx >= 0 && productEdges[idx]) productEdges[idx].position.copy(selectedMesh.position);
        renderFrame();
      }
    } else if (isDragging) {
      rotate(e.clientX - prevMouse.x, e.clientY - prevMouse.y);
      prevMouse = { x: e.clientX, y: e.clientY };
    }
  });

  el.addEventListener('wheel', e => {
    e.preventDefault();
    zoom(e.deltaY * 0.2);
  }, { passive: false });

  let lastDist = 0;
  el.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      const t   = e.touches[0];
      const hit = pickProduct(t.clientX, t.clientY);
      if (hit) {
        selectMesh(hit.object);
        isMovingProduct = true;
        lastValidPos.copy(hit.object.position);
        isColliding = false;
        const normal = camera.position.clone().normalize();
        dragPlane.setFromNormalAndCoplanarPoint(normal, hit.point);
        dragOffset.copy(hit.object.position).sub(hit.point);
      } else {
        selectMesh(null);
        isMovingProduct = false;
        isDragging = true;
      }
      prevMouse = { x: t.clientX, y: t.clientY };
    }
    if (e.touches.length === 2) lastDist = touchDist(e);
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (isMovingProduct && selectedMesh) {
        raycaster.setFromCamera(getNDC(t.clientX, t.clientY), camera);
        const target = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(dragPlane, target)) {
          const desiredPos = target.add(dragOffset);
          const collided   = slideTowards(selectedMesh, desiredPos);

          setCollisionVisual(selectedMesh, collided);

          const idx = productMeshes.indexOf(selectedMesh);
          if (idx >= 0 && productEdges[idx]) productEdges[idx].position.copy(selectedMesh.position);
          renderFrame();
        }
      } else if (isDragging) {
        rotate(t.clientX - prevMouse.x, t.clientY - prevMouse.y);
        prevMouse = { x: t.clientX, y: t.clientY };
      }
    }
    if (e.touches.length === 2) {
      const d = touchDist(e);
      zoom(-(d - lastDist) * 0.5);
      lastDist = d;
    }
  }, { passive: true });

  el.addEventListener('touchend', () => {
    if (isMovingProduct && selectedMesh) {
      if (isColliding) {
        selectedMesh.position.copy(lastValidPos);
      }
      isColliding = false;
      setCollisionVisual(selectedMesh, false);
      const idx = productMeshes.indexOf(selectedMesh);
      if (idx >= 0 && productEdges[idx]) productEdges[idx].position.copy(selectedMesh.position);
      renderFrame();
    }
    isDragging = false;
    isMovingProduct = false;
  }, { passive: true });
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

function makeEdges(w, h, d, color, opacity) {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const mat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity: opacity || 1 });
  return new THREE.LineSegments(geo, mat);
}

function buildScene(order, box, placements) {
  if (!scene || !renderer) return; // not yet initialized — skip silently
  const toRemove = [];
  scene.traverse(o => { if (o.isMesh || o.isLineSegments) toRemove.push(o); });
  toRemove.forEach(o => scene.remove(o));
  productMeshes = [];
  productEdges  = [];
  selectedMesh  = null;
  isColliding   = false;
  updateRotateBtn();

  if (!box && !order.length) { renderFrame(); return; }

  const bL = box ? box.l : 60;
  const bW = box ? box.w : 50;
  const bH = box ? box.h : 40;
  boxBounds = { l: bL, w: bW, h: bH };

  scene.position.set(-bL / 2, -bH / 2, -bW / 2);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xd4c9b0, transparent: true, opacity: 0.08, side: THREE.BackSide,
  });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(bL, bH, bW), wallMat);
  shell.position.set(bL / 2, bH / 2, bW / 2);
  scene.add(shell);

  const edgesBox = makeEdges(bL, bH, bW, 0x8a7560, 1);
  edgesBox.position.copy(shell.position);
  scene.add(edgesBox);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xc8bc9e, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(bL, bW), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(bL / 2, 0, bW / 2);
  scene.add(floor);

  if (placements && placements.length) {
    let idx = 0;
    order.forEach((item, pi) => {
      const color = PROD_COLORS_HEX[pi % PROD_COLORS_HEX.length];
      for (let i = 0; i < item.qty; i++) {
        const pl = placements[idx++];
        if (!pl) return;
        const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(pl.l, pl.h, pl.w), mat);
        mesh.position.set(pl.x + pl.l / 2, pl.z + pl.h / 2, pl.y + pl.w / 2);
        mesh.castShadow = mesh.receiveShadow = true;
        scene.add(mesh);
        productMeshes.push(mesh);
        const pe = makeEdges(pl.l, pl.h, pl.w, 0x000000, 0.1);
        pe.position.copy(mesh.position);
        scene.add(pe);
        productEdges.push(pe);
      }
    });
  } else {
    let curY = 0;
    order.forEach((item, pi) => {
      const color = PROD_COLORS_HEX[pi % PROD_COLORS_HEX.length];
      const pl = Math.min(item.l || 10, bL);
      const pw = Math.min(item.w || 10, bW);
      const ph = item.h || 3;
      for (let i = 0; i < item.qty; i++) {
        if (curY + ph > bH) break;
        const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(pl, ph, pw), mat);
        mesh.position.set(pl / 2, curY + ph / 2, pw / 2);
        mesh.castShadow = mesh.receiveShadow = true;
        scene.add(mesh);
        productMeshes.push(mesh);
        const pe = makeEdges(pl, ph, pw, 0x000000, 0.1);
        pe.position.copy(mesh.position);
        scene.add(pe);
        productEdges.push(pe);
        curY += ph;
      }
    });
  }

  const diag = Math.sqrt(bL * bL + bH * bH + bW * bW);
  spherical.radius = diag * 1.1;
  updateCamera();
  renderFrame();
}
