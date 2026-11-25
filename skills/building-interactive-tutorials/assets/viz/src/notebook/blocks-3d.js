import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
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
export const ONE = new THREE.Vector3(1, 1, 1);

export const palette = (tag) => PALETTE[tag] ?? PALETTE.base;
export const opacityOf = (tag) => (tag === 'muted' ? 0.45 : 1);
const measure = document.createElement('canvas').getContext('2d');

/** 用 CSS 字体写法 `font`（如 `600 52px sans-serif`）量一段文字画出来有多宽，单位是像素。 */
export function measureText(text, font) {
  measure.font = font;
  return measure.measureText(text).width;
}

export const textWidth = (text, px, weight = 600) => measureText(text, `${weight} ${px}px ${FONT}`);

export function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export const blockWidth = (text, depth) => Math.max(depth, textWidth(text, depth * PX * 0.5) / PX + depth * 0.45);

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

/** 顶面写着 `text` 的方块，宽度随文字变；`size` 给出厚度 `height` 和进深 `depth`。 */
export function makeBlock(text, tag, size) {
  const width = blockWidth(text, size.depth);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, size.height, size.depth), blockMaterials(text, width, size.depth, tag));
  mesh.castShadow = true;
  mesh.userData = { text, tag, width, size };
  return mesh;
}

export function setBlockTag(mesh, tag) {
  if (mesh.userData.tag === tag) return;
  const opacity = getOpacity(mesh);
  disposeMaterials(mesh.material);
  mesh.material = blockMaterials(mesh.userData.text, mesh.userData.width, mesh.userData.size.depth, tag);
  setOpacity(mesh, opacity);
  mesh.userData.tag = tag;
}

/** 始终朝向镜头的文字标签；`anchor` 是文字上对齐到所在位置的点，`[1, 0.5]` 表示右对齐。 */
export function makeLabel(anchor = [0, 0.5]) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  sprite.center.set(...anchor);
  sprite.userData = {};
  return sprite;
}

export function setLabel(sprite, text, color, size = 0.42, weight = 500) {
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

export function getOpacity(obj) {
  return materialsOf(obj)[0].opacity;
}

export function setOpacity(obj, opacity) {
  for (const m of materialsOf(obj)) m.opacity = opacity;
}

export function disposeMaterials(material) {
  for (const m of new Set(Array.isArray(material) ? material : [material])) {
    m.map?.dispose();
    m.dispose();
  }
}

/**
 * 两种 3D 画面共用的镜头控制：左键拖动平移，右键拖动旋转。
 *
 * 滚轮不缩放，留给页面上下滚动；镜头最低降到略高于地面，不会转到地面下面。
 *
 * @param camera 要控制的镜头
 * @param dom 接收鼠标事件的画布
 */
export function makeControls(camera, dom) {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.enableZoom = false;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  return controls;
}

/**
 * 方块画面共用的舞台：深色地面和网格、灯光、可拖动的镜头，以及让方块在步与步之间滑动、长出、飞走的过渡动画。
 *
 * 各个方块视图在它上面摆自己的东西，再把舞台的 `mount`、`setActive` 交给播放器，见 [mountDemo](viz/src/notebook/player.js#mountDemo)。
 *
 * @param camera 镜头的初始位置 `[x, y, z]`，双击画面回到这里；给了 `fit` 时不用
 * @param target 镜头看向的点 `[x, y, z]`；给了 `fit` 时不用
 * @param fit 要刚好看全的地面范围 `{ minX, maxX, minZ, maxZ }`：镜头按画面宽高比从斜上方自动取景，画面尺寸变了重新取景
 */
export function createBlockScene({ camera: cameraAt, target, fit }) {
  // 自动取景用窄视角从远处看，宽画面两端的平台不会被透视拉歪。
  const fov = fit ? 24 : 40;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14161c');
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
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

  const tweens = new Set();
  const everyFrame = [];
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

  /**
   * 把方块挪到这一步的位置。同一个 id 的方块滑过去；文字变了的旧块沉下去，换一块新的。
   *
   * 新方块写了 `from` 时，从这些来源方块的中点长出来并跳一下；来源方块这一步不在了就飞进新方块，还在就留在原处。
   * 没写 `from` 的新方块从上方落下；其余这一步不在的方块沉下去消失。
   *
   * @param blocks 方块 id → 方块，跨步保留，这里直接增删
   * @param placed 这一步每块的 id → `{ t, pos, size }`：`t` 是步骤数据里的方块（`text`、`tag`、可选的 `from`），`pos` 是目标位置，`size` 见 [makeBlock]
   */
  function syncBlocks(blocks, placed) {
    const absorbedBy = new Map();
    let fresh = 0;
    for (const [id, { t, pos, size }] of placed) {
      let mesh = blocks.get(id);
      if (mesh && mesh.userData.text !== t.text) {
        blocks.delete(id);
        fadeAway(mesh);
        mesh = null;
      }
      if (mesh) {
        setBlockTag(mesh, t.tag);
        tween(mesh, { pos, scale: ONE, opacity: opacityOf(t.tag) });
        continue;
      }
      mesh = makeBlock(t.text, t.tag, size);
      scene.add(mesh);
      const sources = (t.from ?? []).filter((f) => blocks.has(f));
      blocks.set(id, mesh);
      if (sources.length) {
        const centre = new THREE.Vector3();
        for (const f of sources) {
          centre.add(blocks.get(f).position);
          if (!placed.has(f)) absorbedBy.set(f, pos);
        }
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
    for (const [id, mesh] of blocks) {
      if (placed.has(id)) continue;
      blocks.delete(id);
      const target = absorbedBy.get(id);
      if (target) tween(mesh, { pos: target, scale: new THREE.Vector3(0.3, 1, 1), opacity: 0 }, { duration: 600, done: () => discard(mesh) });
      else fadeAway(mesh);
    }
  }

  /** 从斜上方取景，让 `fit` 范围四周各留一点边、左右和前后都装得下，并记成双击复位的位置。 */
  function frameFit() {
    const pad = 1.2;
    const width = fit.maxX - fit.minX + pad * 2;
    const depth = fit.maxZ - fit.minZ + pad * 2;
    const half = THREE.MathUtils.degToRad(fov / 2);
    const span = Math.max(width / camera.aspect, depth * 0.85);
    // 离镜头近的前沿看起来更宽，多退一点免得两角出画。
    const dist = (span / 2 / Math.tan(half)) * 1.08;
    const centre = new THREE.Vector3((fit.minX + fit.maxX) / 2, 0, (fit.minZ + fit.maxZ) / 2);
    camera.position.copy(centre).addScaledVector(new THREE.Vector3(0, 0.95, 0.72).normalize(), dist);
    controls.target.copy(centre);
    controls.saveState();
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
    for (const run of everyFrame) run(now);
    controls.update();
    renderer.render(scene, camera);
  }

  return {
    scene,
    tween,
    discard,
    fadeAway,
    syncBlocks,
    clearTweens: () => tweens.clear(),
    /** 登记每一帧都要跑的动画，参数是当前时间（毫秒）。 */
    onFrame: (run) => everyFrame.push(run),
    mount(stage) {
      stage.append(renderer.domElement);
      controls = makeControls(camera, renderer.domElement);
      if (!fit) {
        camera.position.set(...cameraAt);
        controls.target.set(...target);
        controls.saveState();
      }
      renderer.domElement.addEventListener('dblclick', () => controls.reset());
      const resize = () => {
        const { clientWidth: w, clientHeight: h } = stage;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (fit) frameFit();
      };
      new ResizeObserver(resize).observe(stage);
      resize();
    },
    setActive(active) {
      renderer.setAnimationLoop(active ? frame : null);
    },
  };
}
