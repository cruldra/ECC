import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const SANS = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, "PingFang SC", monospace';
const LABEL_PX = 100;
const NODE = { w: 3.4, h: 0.7, d: 1.7 };
const EDGE_IDLE = '#3a4256';

/**
 * 组件种类表：`shape` 是 `box`（圆角方块）或 `cylinder`（圆柱），`body` 是本体颜色，`label` 是名牌描边色，有 `rings` 的圆柱多两道环。
 *
 * 页面要别的种类时在 `graph.kinds` 里补一项，同名的会盖掉这里的。
 */
export const KINDS = {
  process: { shape: 'box', body: '#2f3d5c', label: '#6aa8ff' },
  store: { shape: 'cylinder', body: '#24504c', label: '#4fd1c5' },
  table: { shape: 'cylinder', body: '#4a4526', label: '#e2b93b', rings: '#e2b93b' },
  ref: { shape: 'box', body: '#45346a', label: '#a78bfa' },
};

/**
 * 每一步组件和连线的状态色：组件按它发光、名牌第三行按它着色，点亮的连线按它上色。
 *
 * `base` 和 `off` 不发光也不抬高，只用来给名牌第三行配色；页面要别的状态时在 `graph.tones` 里补一项。
 */
export const TONES = { active: '#f08a59', new: '#3ecf8e', gap: '#e5484d', base: '#8a93a6', off: '#5a6275' };

const measure = document.createElement('canvas').getContext('2d');
function textWidth(text, font) {
  measure.font = font;
  return measure.measureText(text).width;
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** 画组件的名牌：名字、代码名，有数据时第三行挂这一步的数据；三行画在同一块上，俯视时才不会互相压住。 */
function labelCanvas(name, sub, color, badge, badgeColor) {
  const nameFont = `600 52px ${SANS}`;
  const subFont = `500 32px ${MONO}`;
  const badgeFont = `600 34px ${MONO}`;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(Math.max(textWidth(name, nameFont), sub ? textWidth(sub, subFont) : 0, badge ? textWidth(badge, badgeFont) + 36 : 0)) + 56;
  canvas.height = 128 + (badge ? 62 : 0);
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.roundRect(3, 3, canvas.width - 6, canvas.height - 6, 16);
  ctx.fillStyle = 'rgba(14,17,24,0.9)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = nameFont;
  ctx.fillStyle = '#e8ecf3';
  ctx.fillText(name, canvas.width / 2, 46);
  ctx.font = subFont;
  ctx.fillStyle = '#9aa3b6';
  ctx.fillText(sub ?? '', canvas.width / 2, 94);
  if (badge) {
    const bw = textWidth(badge, badgeFont) + 32;
    ctx.beginPath();
    ctx.roundRect((canvas.width - bw) / 2, 126, bw, 50, 25);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = badgeColor;
    ctx.stroke();
    ctx.font = badgeFont;
    ctx.fillStyle = badgeColor;
    ctx.fillText(badge, canvas.width / 2, 152);
  }
  return canvas;
}

/** 连线中点的标签：始终朝向镜头、不被别的物体挡住的一块圆角文字。 */
function pillSprite() {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  sprite.userData = { key: null };
  sprite.renderOrder = 10;
  return sprite;
}

function setPill(sprite, text, color, size = 0.42) {
  const key = `${text}|${color}|${size}`;
  if (sprite.userData.key === key) return;
  const font = `600 40px ${MONO}`;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(textWidth(text, font)) + 44;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.roundRect(2, 2, canvas.width - 4, canvas.height - 4, 30);
  ctx.fillStyle = 'rgba(17,20,27,0.75)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 22, canvas.height / 2 + 1);
  sprite.material.map?.dispose();
  sprite.material.map = canvasTexture(canvas);
  sprite.material.needsUpdate = true;
  sprite.scale.set((canvas.width / 64) * size, size, 1);
  sprite.userData.key = key;
}

/** 分组名：平铺在平台左后角的地面上，像结构图里子图的标题。 */
function groupTitle(text, color) {
  const font = `600 56px ${SANS}`;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(textWidth(text, font)) + 20;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 10, 42);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(canvas.width / 100, canvas.height / 100),
    new THREE.MeshBasicMaterial({ map: canvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** 连线的端点：从组件中心朝另一个组件出发，碰到组件外框的那一点，箭头才不会扎进组件里。 */
function borderPoint(node, toward) {
  const dx = toward.x - node.x;
  const dz = toward.z - node.z;
  const tx = dx === 0 ? Infinity : NODE.w / 2 / Math.abs(dx);
  const tz = dz === 0 ? Infinity : NODE.d / 2 / Math.abs(dz);
  const t = Math.min(tx, tz);
  return new THREE.Vector3(node.x + dx * t, NODE.h * 0.55, node.z + dz * t);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

/**
 * 3D 组件图：分组是地面上的平台，组件按种类画成方块或圆柱，连线是带箭头的弧线；每一步点亮涉及的组件和连线，点亮的连线上有点在流动。
 *
 * 名牌始终朝向镜头，第三行挂这一步的数据；鼠标悬停看说明和前几行数据，点击固定一个面板看全部数据，双击把镜头拉回这一步的取景。
 * 每一步的字段：`nodes`（组件 id → [TONES] 里的状态，没列出的变暗）、`edges`（点亮的连线 `{ id, label, tone }`）、
 * `badges`（组件 id → 名牌第三行的文字或 `{ text, tone }`）、`details`（组件 id → 点开后的几行数据）、`focus`（镜头要看全的组件 id）。
 * 返回的对象提供播放器要的 `mount(stage)`、`render(step, { reset })`、`setActive(active)`，见 [mountDemo](viz/src/notebook/player.js#mountDemo)。
 *
 * @param graph 整页共用的组件图：`groups`（平台）、`nodes`（组件）、`edges`（连线），可选的 `kinds`、`tones` 补充 [KINDS]、[TONES]；
 *   格式见示例的 [GRAPH](viz/src/topics/example/steps.js#GRAPH)
 */
export function createGraphView(graph) {
  const kinds = { ...KINDS, ...graph.kinds };
  const tones = { ...TONES, ...graph.tones };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#12141a');
  // 窄视角从远处看：近处和远处的组件差不多大，透视不把画面拉歪。
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 600);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  let controls;
  let stageEl;
  let tip;
  let panel;

  scene.add(new THREE.HemisphereLight('#dfe6ff', '#0b0d12', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(6, 22, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 25, bottom: -25 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), new THREE.MeshStandardMaterial({ color: '#15181f', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  for (const g of graph.groups ?? []) {
    const plate = new THREE.Mesh(
      new RoundedBoxGeometry(g.w, 0.08, g.d, 2, 0.04),
      new THREE.MeshStandardMaterial({ color: g.color, transparent: true, opacity: 0.08, roughness: 1 }),
    );
    plate.position.set(g.x, 0.04, g.z);
    plate.receiveShadow = true;
    scene.add(plate);
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(g.w, 0.08, g.d)), new THREE.LineBasicMaterial({ color: g.color, transparent: true, opacity: 0.55 }));
    border.position.copy(plate.position);
    scene.add(border);
    const title = groupTitle(g.label, g.color);
    const tw = title.geometry.parameters.width;
    title.position.set(g.x - g.w / 2 + tw / 2 + 0.3, 0.1, g.z - g.d / 2 + 0.55);
    scene.add(title);
  }

  /** 换名牌的第三行；文字和颜色都没变就不重画。 */
  function setNodeLabel(entry, badge, color) {
    const key = `${badge}|${color}`;
    if (entry.labelKey === key) return;
    const canvas = labelCanvas(entry.n.label, entry.n.sub, entry.kind.label, badge, color);
    entry.labelMat.map?.dispose();
    entry.labelMat.map = canvasTexture(canvas);
    entry.labelMat.needsUpdate = true;
    entry.label.scale.set(canvas.width / LABEL_PX, canvas.height / LABEL_PX, 1);
    entry.labelKey = key;
  }

  const nodes = new Map();
  const pickables = [];
  for (const n of graph.nodes) {
    const kind = kinds[n.kind];
    if (!kind) throw new Error(`组件 ${n.id} 的种类 ${n.kind} 没有定义`);
    const group = new THREE.Group();
    group.position.set(n.x, 0, n.z);
    const bodyMat = new THREE.MeshStandardMaterial({ color: kind.body, roughness: 0.55, metalness: 0.15, transparent: true, emissive: '#000000' });
    let body;
    if (kind.shape === 'cylinder') {
      body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, NODE.h, 48), bodyMat);
      body.scale.set(NODE.w / 2, 1, NODE.d / 2 + 0.15);
      for (const y of kind.rings ? [NODE.h * 0.35, NODE.h * 0.7] : []) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 64), new THREE.MeshBasicMaterial({ color: kind.rings, transparent: true, opacity: 0.6 }));
        ring.rotation.x = Math.PI / 2;
        ring.scale.set(NODE.w / 2 + 0.005, NODE.d / 2 + 0.155, 1);
        ring.position.y = y;
        group.add(ring);
      }
    } else {
      body = new THREE.Mesh(new RoundedBoxGeometry(NODE.w, NODE.h, NODE.d, 3, 0.16), bodyMat);
    }
    body.position.y = NODE.h / 2;
    body.castShadow = true;
    group.add(body);
    const labelMat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
    const label = new THREE.Sprite(labelMat);
    label.center.set(0.5, 0);
    label.position.y = NODE.h + 0.15;
    label.renderOrder = 5;
    group.add(label);
    scene.add(group);
    const entry = { n, kind, x: n.x, z: n.z, group, bodyMat, labelMat, label, labelKey: null, state: null, hover: false };
    setNodeLabel(entry, null, null);
    body.userData.pick = { type: 'node', entry };
    label.userData.pick = body.userData.pick;
    pickables.push(body, label);
    nodes.set(n.id, entry);
  }

  const edges = new Map();
  for (const e of graph.edges ?? []) {
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    if (!a || !b) throw new Error(`连线 ${e.id} 连着不存在的组件`);
    const start = borderPoint(a, b);
    const end = borderPoint(b, a);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += 0.8 + start.distanceTo(end) * 0.16;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const mat = new THREE.MeshStandardMaterial({ color: EDGE_IDLE, emissive: '#000000', transparent: true, opacity: 0.5 });
    const parts = [];
    if (e.dashed) {
      const pts = curve.getSpacedPoints(48);
      for (let i = 0; i < 46; i += 4) parts.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(i, i + 3)), 4, 0.045, 6), mat));
    } else {
      parts.push(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.05, 8), mat));
    }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.45, 12), mat);
    const tangent = curve.getTangent(1).normalize();
    cone.position.copy(end).addScaledVector(tangent, -0.2);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    parts.push(cone);
    parts.forEach((p) => scene.add(p));
    // 连线太细不好指，套一根看不见的粗管子专门接鼠标。
    const hit = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.28, 6), new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(hit);
    const label = pillSprite();
    label.position.copy(curve.getPoint(0.5)).add(new THREE.Vector3(0, 0.35, 0));
    label.visible = false;
    scene.add(label);
    const dots = [0, 1, 2].map(() => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), new THREE.MeshBasicMaterial({ color: tones.active }));
      dot.visible = false;
      scene.add(dot);
      return dot;
    });
    const entry = { e, curve, mat, label, dots, active: null, hover: false };
    hit.userData.pick = { type: 'edge', entry };
    pickables.push(hit);
    edges.set(e.id, entry);
  }

  const tweens = new Set();
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
  function animate(duration, run) {
    tweens.add({ t0: performance.now(), duration, run });
  }

  let step = null;

  /** 按状态给组件上色：点亮的发出状态色并抬高一点，没列出的变暗变淡，悬停时亮一些。 */
  function paintNode(entry) {
    const tone = entry.state;
    const glow = tone && tone !== 'base' && tone !== 'off' ? tones[tone] : null;
    const color = new THREE.Color(entry.kind.body);
    if (!tone) color.multiplyScalar(0.7);
    entry.bodyMat.color.copy(color);
    entry.bodyMat.emissive.set(glow ?? (entry.hover ? entry.kind.label : '#000000'));
    entry.bodyMat.emissiveIntensity = entry.hover ? 0.55 : 0.32;
    entry.bodyMat.opacity = tone ? 1 : 0.6;
    entry.labelMat.opacity = tone ? 1 : 0.45;
    const lift = glow ? 0.25 : 0;
    const y0 = entry.group.position.y;
    animate(500, (k) => (entry.group.position.y = y0 + (lift - y0) * k));
  }

  /** 给连线上色：点亮的按状态色发光、显示标签和流动的点，悬停时只显示标签。 */
  function paintEdge(entry) {
    const a = entry.active;
    const color = a ? tones[a.tone ?? 'active'] : entry.hover ? '#8a93a6' : EDGE_IDLE;
    entry.mat.color.set(color);
    entry.mat.emissive.set(a ? color : '#000000');
    entry.mat.emissiveIntensity = 0.6;
    entry.mat.opacity = a || entry.hover ? 1 : 0.32;
    entry.dots.forEach((d) => {
      d.visible = !!a;
      d.material.color.set(color);
    });
    entry.label.visible = !!a || entry.hover;
    if (entry.label.visible) setPill(entry.label, a?.label ?? entry.e.label, a ? color : '#9aa3b6');
  }

  /** 悬停提示和点开的面板共用的内容：名字、说明、这一步的数据；悬停只给前四行。 */
  function infoHtml(pick, { full }) {
    if (pick.type === 'edge') {
      const { e } = pick.entry;
      const from = nodes.get(e.from).n.label;
      const to = nodes.get(e.to).n.label;
      return `<b>${escapeHtml(from)} → ${escapeHtml(to)}</b><div class="mono">${escapeHtml(e.label)}</div><p>${escapeHtml(e.desc ?? '')}</p>`;
    }
    const { n } = pick.entry;
    const lines = step?.details?.[n.id] ?? [];
    const shown = full ? lines : lines.slice(0, 4);
    const more = !full && lines.length > shown.length ? `<div class="more">点击查看全部 ${lines.length} 行</div>` : '';
    const data = shown.length ? `<pre>${shown.map(escapeHtml).join('\n')}</pre>${more}` : '';
    const code = n.code ? `<div class="code">${escapeHtml(n.code)}</div>` : '';
    return `<b>${escapeHtml(n.label)}</b> <span class="mono">${escapeHtml(n.sub ?? '')}</span><p>${escapeHtml(n.desc ?? '')}</p>${code}${data}`;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let pinned = null;

  function pick(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    return hit?.object.userData.pick ?? null;
  }

  function repaint(p) {
    p.type === 'node' ? paintNode(p.entry) : paintEdge(p.entry);
  }

  function setHover(next) {
    if (hovered?.entry === next?.entry) return;
    if (hovered) {
      hovered.entry.hover = false;
      repaint(hovered);
    }
    hovered = next;
    if (hovered) {
      hovered.entry.hover = true;
      repaint(hovered);
    }
    renderer.domElement.style.cursor = hovered ? 'pointer' : '';
  }

  function showPanel(p) {
    pinned = p;
    panel.hidden = !p;
    // 点开的就是正悬停的那个，悬停提示收起来，不和面板叠在一起。
    if (p) tip.hidden = true;
    if (p) panel.innerHTML = `<button class="close" title="关闭">×</button>${infoHtml(p, { full: true })}`;
  }

  /** 把镜头移到斜上方、刚好看全 `ids` 这些组件和它们的名牌；没给就看全整张图。 */
  function frameCamera(ids, instant) {
    const list = (ids?.length ? ids : [...nodes.keys()]).map((id) => nodes.get(id)).filter(Boolean);
    const minX = Math.min(...list.map((e) => e.x - NODE.w / 2)) - 1.2;
    const maxX = Math.max(...list.map((e) => e.x + NODE.w / 2)) + 1.2;
    // 名牌立在组件上方，画面里朝后伸，所以后面多留些。
    const minZ = Math.min(...list.map((e) => e.z)) - 3.0;
    const maxZ = Math.max(...list.map((e) => e.z)) + 1.6;
    const target = new THREE.Vector3((minX + maxX) / 2, 0.8, (minZ + maxZ) / 2);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const span = Math.max((maxX - minX) / camera.aspect, (maxZ - minZ) * 0.85, 8);
    const dist = (span / 2 / Math.tan(halfFov)) * 1.05;
    const dir = new THREE.Vector3(0, 0.95, 0.72).normalize();
    const pos = target.clone().addScaledVector(dir, dist);
    if (instant) {
      camera.position.copy(pos);
      controls.target.copy(target);
      return;
    }
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    animate(900, (k) => {
      camera.position.lerpVectors(p0, pos, k);
      controls.target.lerpVectors(t0, target, k);
    });
  }

  function frame() {
    const now = performance.now();
    for (const tw of tweens) {
      const k = Math.min(1, (now - tw.t0) / tw.duration);
      tw.run(ease(k));
      if (k >= 1) tweens.delete(tw);
    }
    for (const entry of edges.values()) {
      if (!entry.active) continue;
      entry.dots.forEach((d, i) => d.position.copy(entry.curve.getPoint((now / 1500 + i / 3) % 1)));
    }
    controls.update();
    renderer.render(scene, camera);
  }

  return {
    mount(stage) {
      stageEl = stage;
      stage.append(renderer.domElement);
      tip = document.createElement('div');
      tip.className = 'graph-tip';
      tip.hidden = true;
      panel = document.createElement('div');
      panel.className = 'graph-panel';
      panel.hidden = true;
      stage.append(tip, panel);
      panel.addEventListener('click', (ev) => ev.target.closest('.close') && showPanel(null));
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      // 关掉滚轮缩放，滚轮留给页面上下滚动。
      controls.enableZoom = false;
      controls.maxPolarAngle = Math.PI / 2.1;
      const el = renderer.domElement;
      // 按下和松开离得近才算点击，拖动转视角不会误开面板。
      let down = null;
      el.addEventListener('pointerdown', (ev) => (down = [ev.clientX, ev.clientY]));
      el.addEventListener('pointerup', (ev) => {
        if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return;
        const p = pick(ev);
        showPanel(p && p.entry !== pinned?.entry ? p : null);
      });
      el.addEventListener('pointermove', (ev) => {
        const p = pick(ev);
        setHover(p);
        tip.hidden = !p || p.entry === pinned?.entry;
        if (tip.hidden) return;
        tip.innerHTML = infoHtml(p, { full: false });
        const r = stageEl.getBoundingClientRect();
        const x = Math.min(ev.clientX - r.left + 16, r.width - tip.offsetWidth - 8);
        const y = Math.min(ev.clientY - r.top + 16, r.height - tip.offsetHeight - 8);
        tip.style.left = `${Math.max(8, x)}px`;
        tip.style.top = `${Math.max(8, y)}px`;
      });
      el.addEventListener('pointerleave', () => {
        setHover(null);
        tip.hidden = true;
      });
      el.addEventListener('dblclick', () => frameCamera(step?.focus));
      const resize = () => {
        const { clientWidth: w, clientHeight: h } = stage;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      new ResizeObserver(resize).observe(stage);
      resize();
    },
    setActive(active) {
      renderer.setAnimationLoop(active ? frame : null);
    },
    render(next, { reset }) {
      const first = !step;
      step = next;
      for (const [id, entry] of nodes) {
        entry.state = next.nodes?.[id] ?? null;
        paintNode(entry);
        const b = next.badges?.[id];
        const { text, tone } = typeof b === 'string' ? { text: b } : (b ?? {});
        setNodeLabel(entry, text ?? null, text ? (tones[tone] ?? tones[entry.state] ?? '#e8ecf3') : null);
      }
      const active = new Map((next.edges ?? []).map((a) => [a.id, a]));
      for (const [id, entry] of edges) {
        entry.active = active.get(id) ?? null;
        paintEdge(entry);
      }
      // 换步后固定的面板换成这一步的数据。
      if (pinned) showPanel(pinned);
      frameCamera(next.focus, first || reset);
    },
  };
}
