import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const PX = 128;
const PALETTE = {
  base: { face: '#2a3142', text: '#e8ecf3', side: '#3a4460', bar: '#4c5a7a', label: '#e8ecf3' },
  focus: { face: '#f08a59', text: '#1a1a1a', side: '#c4693f', bar: '#f08a59', label: '#f08a59' },
  new: { face: '#3ecf8e', text: '#0d1f17', side: '#2c9a69', bar: '#3ecf8e', label: '#3ecf8e' },
  done: { face: '#2f6f55', text: '#e8ecf3', side: '#24533f', bar: '#3ecf8e', label: '#3ecf8e' },
  muted: { face: '#1f2431', text: '#6b7489', side: '#262c3a', bar: '#2c3242', label: '#5a6275' },
  unk: { face: '#5b6272', text: '#ffffff', side: '#4a505e', bar: '#5b6272', label: '#e8ecf3' },
  removed: { face: '#e5484d', text: '#ffffff', side: '#b23a3e', bar: '#e5484d', label: '#e5484d' },
};
const ROW = { x0: -9.5, gapZ: 1.8, gap: 0.3, depth: 1, height: 0.45, lift: 0.35 };
const BARS = { labelX: 2.4, startX: 2.7, maxLen: 4.2, gapZ: 0.95, height: 0.3, depth: 0.55 };
const CHIP = { depth: 0.7, height: 0.3, gap: 0.22 };
const ONE = new THREE.Vector3(1, 1, 1);

const palette = (tag) => PALETTE[tag] ?? PALETTE.base;
const opacityOf = (tag) => (tag === 'muted' ? 0.45 : 1);
const measure = document.createElement('canvas').getContext('2d');

function textWidth(text, px, weight = 600) {
  measure.font = `${weight} ${px}px ${FONT}`;
  return measure.measureText(text).width;
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const blockWidth = (text, depth) => Math.max(depth, textWidth(text, depth * PX * 0.5) / PX + depth * 0.45);

/** 方块的材质：顶面画上文字且不受光照影响，保证字看得清；其余各面用受光材质，带出立体感。 */
function blockMaterials(text, width, depth, tag) {
  const c = palette(tag);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * PX);
  canvas.height = Math.round(depth * PX);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = c.face;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = c.text;
  ctx.font = `600 ${Math.round(depth * PX * 0.5)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const top = new THREE.MeshBasicMaterial({ map: canvasTexture(canvas), transparent: true });
  const side = new THREE.MeshStandardMaterial({ color: c.side, roughness: 0.55, metalness: 0.1, transparent: true });
  return [side, side, top, side, side, side];
}

function makeBlock(text, tag, size) {
  const width = blockWidth(text, size.depth);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, size.height, size.depth), blockMaterials(text, width, size.depth, tag));
  mesh.castShadow = true;
  mesh.userData = { text, tag, width, size };
  return mesh;
}

function setBlockTag(mesh, tag) {
  if (mesh.userData.tag === tag) return;
  const opacity = getOpacity(mesh);
  disposeMaterials(mesh.material);
  mesh.material = blockMaterials(mesh.userData.text, mesh.userData.width, mesh.userData.size.depth, tag);
  setOpacity(mesh, opacity);
  mesh.userData.tag = tag;
}

/** 始终朝向镜头的文字标签；`anchor` 是文字上对齐到所在位置的点，`[1, 0.5]` 表示右对齐。 */
function makeLabel(anchor = [0, 0.5]) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  sprite.center.set(...anchor);
  sprite.userData = {};
  return sprite;
}

function setLabel(sprite, text, color, size = 0.42, weight = 500) {
  const key = `${text}|${color}|${size}|${weight}`;
  if (sprite.userData.key === key) return;
  const px = 64;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(textWidth(text, px, weight)) + 12;
  canvas.height = px + 24;
  const ctx = canvas.getContext('2d');
  ctx.font = `${weight} ${px}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 6, canvas.height / 2);
  sprite.material.map?.dispose();
  sprite.material.map = canvasTexture(canvas);
  sprite.material.needsUpdate = true;
  sprite.scale.set((canvas.width * size) / px, (canvas.height * size) / px, 1);
  sprite.userData.key = key;
}

function materialsOf(obj) {
  return [...new Set(Array.isArray(obj.material) ? obj.material : [obj.material])];
}

function getOpacity(obj) {
  return materialsOf(obj)[0].opacity;
}

function setOpacity(obj, opacity) {
  for (const m of materialsOf(obj)) m.opacity = opacity;
}

function disposeMaterials(material) {
  for (const m of new Set(Array.isArray(material) ? material : [material])) {
    m.map?.dispose();
    m.dispose();
  }
}

/**
 * 3D 画面：`rows` 的每一项是桌面上的一块方块，`bars` 是右边一排立体条，`vocab` 是后排的小方块；拖动鼠标可以转视角。
 *
 * 换步时同一 `id` 的块滑到新位置，带 `from` 的块从来源方块的中点长出来并跳一下，被合并或删掉的块飞进新块或沉下去消失。
 * 返回的对象提供播放器要的 `mount(stage)`、`render(step, { reset })`、`setActive(active)`，见 [mountDemo](viz/src/notebook/player.js#mountDemo)。
 */
export function createTilesView() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14161c');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let controls;

  scene.add(new THREE.HemisphereLight('#dfe6ff', '#0b0d12', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(6, 16, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: '#171a22', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(80, 80, '#242b3a', '#1c212c');
  grid.position.y = 0.002;
  scene.add(grid);

  const tiles = new Map();
  const rowLabels = new Map();
  const bars = new Map();
  const chips = new Map();
  const titles = {
    rows: makeLabel(),
    bars: makeLabel(),
    vocab: makeLabel(),
  };
  Object.values(titles).forEach((t) => scene.add(t));

  const tweens = new Set();
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

  /**
   * 把物体从当前状态平滑过渡到 `to`，同一物体的新过渡会接替旧的。
   *
   * @param to 目标 `pos`、`scale`、`opacity`，缺省的项保持不变
   * @param hop 过渡途中向上跳起的高度
   * @param done 过渡结束后调用
   */
  function tween(obj, to, { duration = 750, delay = 0, hop = 0, done } = {}) {
    if (obj.userData.tween) tweens.delete(obj.userData.tween);
    const p0 = obj.position.clone();
    const s0 = obj.scale.clone();
    const o0 = getOpacity(obj);
    const tw = {
      t0: performance.now() + delay,
      duration,
      run(k) {
        if (to.pos) {
          obj.position.lerpVectors(p0, to.pos, k);
          obj.position.y += Math.sin(Math.PI * k) * hop;
        }
        if (to.scale) obj.scale.lerpVectors(s0, to.scale, k);
        if (to.opacity != null) setOpacity(obj, o0 + (to.opacity - o0) * k);
      },
      done,
    };
    obj.userData.tween = tw;
    tweens.add(tw);
  }

  function discard(obj) {
    scene.remove(obj);
    obj.geometry?.dispose();
    disposeMaterials(obj.material);
  }

  function fadeAway(obj) {
    tween(obj, { pos: obj.position.clone().setY(-0.8), opacity: 0 }, { duration: 500, done: () => discard(obj) });
  }

  function clear() {
    tweens.clear();
    tiles.forEach(discard);
    rowLabels.forEach(discard);
    bars.forEach((b) => [b.bar, b.label, b.value].filter(Boolean).forEach(discard));
    chips.forEach(discard);
    tiles.clear();
    rowLabels.clear();
    bars.clear();
    chips.clear();
  }

  /** 摆语料或输入：每行一排方块，选中的一对抬高；新方块从来源方块的中点长出来，被吸收的方块飞进新方块。 */
  function layoutRows(rows) {
    const zOf = (i) => (i - (rows.length - 1) / 2) * ROW.gapZ;
    const placed = new Map();
    rows.forEach((row, r) => {
      let x = ROW.x0;
      for (const t of row.tiles) {
        const width = blockWidth(t.text, ROW.depth);
        placed.set(t.id, { t, pos: new THREE.Vector3(x + width / 2, ROW.height / 2 + (t.tag === 'focus' ? ROW.lift : 0), zOf(r)) });
        x += width + ROW.gap;
      }
      let label = rowLabels.get(row.key);
      if (!label) {
        label = makeLabel([1, 0.5]);
        label.position.set(ROW.x0 - 0.6, 0.3, zOf(r));
        setOpacity(label, 0);
        rowLabels.set(row.key, label);
        scene.add(label);
      }
      setLabel(label, row.label, '#8a93a6');
      tween(label, { pos: new THREE.Vector3(ROW.x0 - 0.6, 0.3, zOf(r)), opacity: 1 });
    });
    for (const [key, label] of rowLabels) {
      if (rows.some((r) => r.key === key)) continue;
      rowLabels.delete(key);
      fadeAway(label);
    }

    const absorbedBy = new Map();
    let fresh = 0;
    for (const [id, { t, pos }] of placed) {
      let mesh = tiles.get(id);
      if (mesh && mesh.userData.text !== t.text) {
        tiles.delete(id);
        fadeAway(mesh);
        mesh = null;
      }
      if (mesh) {
        setBlockTag(mesh, t.tag);
        tween(mesh, { pos, scale: ONE, opacity: opacityOf(t.tag) });
        continue;
      }
      mesh = makeBlock(t.text, t.tag, ROW);
      scene.add(mesh);
      const sources = (t.from ?? []).filter((f) => tiles.has(f) && !placed.has(f));
      tiles.set(id, mesh);
      if (sources.length) {
        const centre = new THREE.Vector3();
        sources.forEach((f) => {
          centre.add(tiles.get(f).position);
          absorbedBy.set(f, pos);
        });
        mesh.position.copy(centre.divideScalar(sources.length));
        mesh.scale.set(0.3, 1, 1);
        setOpacity(mesh, 0.2);
        tween(mesh, { pos, scale: ONE, opacity: opacityOf(t.tag) }, { delay: 200, hop: 1.4, duration: 900 });
      } else {
        mesh.position.copy(pos).setY(pos.y + 3);
        setOpacity(mesh, 0);
        tween(mesh, { pos, opacity: opacityOf(t.tag) }, { delay: 40 * fresh++ });
      }
    }
    for (const [id, mesh] of tiles) {
      if (placed.has(id)) continue;
      tiles.delete(id);
      const target = absorbedBy.get(id);
      if (target) tween(mesh, { pos: target, scale: new THREE.Vector3(0.3, 1, 1), opacity: 0 }, { duration: 600, done: () => discard(mesh) });
      else fadeAway(mesh);
    }
    return { top: zOf(0) - ROW.depth / 2, bottom: zOf(rows.length - 1) + ROW.depth / 2 };
  }

  /** 摆打分条：条长按最大值折算，标签右对齐在条的左边，数值跟在条的末端；没有数值的项只显示文字。 */
  function layoutBars(spec) {
    const items = spec?.items ?? [];
    const zOf = (i) => (i - (items.length - 1) / 2) * BARS.gapZ;
    const max = Math.max(...items.map((b) => b.value ?? 0), 1e-9);
    items.forEach((b, i) => {
      const c = palette(b.tag);
      const z = zOf(i);
      let entry = bars.get(b.key);
      if (!entry) {
        entry = { label: makeLabel([1, 0.5]), value: makeLabel([0, 0.5]), bar: null };
        for (const s of [entry.label, entry.value]) {
          s.position.set(BARS.startX, 0.35, z);
          setOpacity(s, 0);
          scene.add(s);
        }
        bars.set(b.key, entry);
      }
      if (b.value != null && !entry.bar) {
        entry.bar = new THREE.Mesh(new THREE.BoxGeometry(1, BARS.height, BARS.depth), new THREE.MeshStandardMaterial({ color: c.bar, roughness: 0.5, transparent: true }));
        entry.bar.castShadow = true;
        entry.bar.scale.set(0.01, 1, 1);
        entry.bar.position.set(BARS.startX, BARS.height / 2, z);
        scene.add(entry.bar);
      }
      const len = b.value == null ? 0 : Math.max(0.05, (b.value / max) * BARS.maxLen);
      const lift = b.tag === 'focus' ? 0.2 : 0;
      if (entry.bar) {
        entry.bar.material.color.set(c.bar);
        tween(entry.bar, { pos: new THREE.Vector3(BARS.startX + len / 2, BARS.height / 2 + lift, z), scale: new THREE.Vector3(len, 1, 1), opacity: opacityOf(b.tag) });
      }
      setLabel(entry.label, b.label, b.tag === 'base' ? '#e8ecf3' : c.label, 0.42, 600);
      setLabel(entry.value, b.display, b.tag === 'base' ? '#8a93a6' : c.label, 0.34);
      tween(entry.label, { pos: new THREE.Vector3(BARS.labelX, 0.35 + lift, z), opacity: opacityOf(b.tag) });
      tween(entry.value, { pos: new THREE.Vector3(BARS.startX + len + 0.25, 0.35 + lift, z), opacity: opacityOf(b.tag) });
    });
    for (const [key, entry] of bars) {
      if (items.some((b) => b.key === key)) continue;
      bars.delete(key);
      [entry.bar, entry.label, entry.value].filter(Boolean).forEach(fadeAway);
    }
    return items.length ? { top: zOf(0) - BARS.depth / 2 } : null;
  }

  /** 摆词表：后排一列小方块，新加的跳一下，删掉的变红后下一步沉下去。 */
  function layoutVocab(vocab, z) {
    const items = vocab?.items ?? [];
    let x = ROW.x0;
    let fresh = 0;
    for (const v of items) {
      const width = blockWidth(v.text, CHIP.depth);
      const pos = new THREE.Vector3(x + width / 2, CHIP.height / 2, z);
      x += width + CHIP.gap;
      let mesh = chips.get(v.key);
      if (mesh) {
        const changed = mesh.userData.tag !== v.tag;
        setBlockTag(mesh, v.tag);
        tween(mesh, { pos, scale: ONE, opacity: 1 }, { hop: changed && v.tag !== 'base' ? 0.8 : 0 });
        continue;
      }
      mesh = makeBlock(v.text, v.tag, CHIP);
      mesh.position.copy(pos).setY(2.5);
      setOpacity(mesh, 0);
      chips.set(v.key, mesh);
      scene.add(mesh);
      tween(mesh, { pos, opacity: 1 }, { delay: 30 * fresh++ });
    }
    for (const [key, mesh] of chips) {
      if (items.some((v) => v.key === key)) continue;
      chips.delete(key);
      fadeAway(mesh);
    }
  }

  function placeTitle(sprite, text, x, z) {
    if (!text) return tween(sprite, { opacity: 0 });
    setLabel(sprite, text, '#8a93a6', 0.4);
    if (getOpacity(sprite) === 0) sprite.position.set(x, 0.3, z);
    tween(sprite, { pos: new THREE.Vector3(x, 0.3, z), opacity: 1 });
  }

  function frame() {
    const now = performance.now();
    for (const tw of tweens) {
      const raw = (now - tw.t0) / tw.duration;
      if (raw < 0) continue;
      const k = Math.min(1, raw);
      tw.run(ease(k));
      if (k >= 1) {
        tweens.delete(tw);
        tw.done?.();
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }

  return {
    mount(stage) {
      stage.append(renderer.domElement);
      camera.position.set(-1.8, 11.5, 11.8);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(-1.8, 0, -0.8);
      controls.enableDamping = true;
      // 关掉滚轮缩放，滚轮留给页面上下滚动。
      controls.enableZoom = false;
      controls.maxPolarAngle = Math.PI / 2.1;
      controls.saveState();
      renderer.domElement.addEventListener('dblclick', () => controls.reset());
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
    render(step, { reset }) {
      if (reset) clear();
      const rows = layoutRows(step.rows);
      const barsBox = layoutBars(step.bars);
      const top = Math.min(rows.top, barsBox?.top ?? rows.top);
      layoutVocab(step.vocab, top - 2.4);
      // 每行自带标签、不需要总标题的场景把 `rowsTitle` 设成空字符串。
      placeTitle(titles.rows, step.rowsTitle ?? '输入', ROW.x0 - 1.6, rows.top - 1.1);
      placeTitle(titles.bars, step.bars?.title, BARS.labelX - 2.6, (barsBox?.top ?? 0) - 1.0);
      placeTitle(titles.vocab, step.vocab?.title, ROW.x0 - 1.6, top - 3.3);
    },
  };
}
