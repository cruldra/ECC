import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { blockWidth, canvasTexture, createBlockScene, FONT, makeLabel, setLabel, setOpacity, textWidth } from './blocks-3d.js';

const BLOCK = { depth: 1, height: 0.45, gap: 0.3, lift: 0.35 };
const ARROW = { idle: '#3a4256', lit: '#f08a59', gap: 0.35, head: 0.5 };

/** 平台名：平铺在平台左后角的地面上，像流程图里子图的标题。 */
function plateTitle(text, color) {
  const font = `600 56px ${FONT}`;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(textWidth(text, 56)) + 20;
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

/**
 * 3D 数据流转图：几块平台像流程图的节点一样排开，平台之间是地面上的箭头；真实数据是一块块方块，一步步在平台之间移动、拆开、换形。
 *
 * 适合讲「一份数据经过几个环节变成另一份数据」：每个环节是一块平台，平台上的 `slots` 是方块排队的位置。
 * 换步时同一个 id 的方块滑到新位置；写了 `from` 的新方块从来源方块的中点长出来，来源方块这一步不在了就飞进新方块，见 [createBlockScene](viz/src/notebook/blocks-3d.js#createBlockScene)。
 * 每一步的字段：`blocks`（方块 `{ id, text, tag, at, from }`，`at` 是 slot 名，`tag` 同方块视图）、`plates`（点亮的平台 id）、`arrows`（点亮的箭头 id）。
 *
 * @param flow 整个演示共用的布局：`plates`（平台 `{ id, label, color, x, z, w, d }`）、`slots`（slot 名 → `{ x, z, label, alignWith }`，
 *   方块以 `x` 为中心排成一行，`label` 是排在这行左边的名字，`alignWith` 是要逐块对齐的另一个 slot）、
 *   `arrows`（`{ id, from, to, z, label }`，从平台 `from` 的边沿沿着深度 `z` 指向平台 `to`）；镜头自动取景看全所有平台
 */
export function createFlowView(flow) {
  const fit = {
    minX: Math.min(...flow.plates.map((p) => p.x - p.w / 2)),
    maxX: Math.max(...flow.plates.map((p) => p.x + p.w / 2)),
    minZ: Math.min(...flow.plates.map((p) => p.z - p.d / 2)),
    maxZ: Math.max(...flow.plates.map((p) => p.z + p.d / 2)),
  };
  const stage = createBlockScene({ fit });
  const { scene, tween, discard } = stage;

  const plates = new Map();
  for (const p of flow.plates) {
    const plateMat = new THREE.MeshStandardMaterial({ color: p.color, transparent: true, opacity: 0.07, roughness: 1 });
    const plate = new THREE.Mesh(new RoundedBoxGeometry(p.w, 0.08, p.d, 2, 0.04), plateMat);
    plate.position.set(p.x, 0.04, p.z);
    plate.receiveShadow = true;
    const borderMat = new THREE.LineBasicMaterial({ color: p.color, transparent: true, opacity: 0.35 });
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w, 0.08, p.d)), borderMat);
    border.position.copy(plate.position);
    const title = plateTitle(p.label, p.color);
    const tw = title.geometry.parameters.width;
    title.position.set(p.x - p.w / 2 + tw / 2 + 0.3, 0.1, p.z - p.d / 2 + 0.55);
    scene.add(plate, border, title);
    plates.set(p.id, { p, plateMat, borderMat, title });
  }

  const arrows = new Map();
  for (const a of flow.arrows ?? []) {
    const from = plates.get(a.from)?.p;
    const to = plates.get(a.to)?.p;
    if (!from || !to) throw new Error(`箭头 ${a.id} 连着不存在的平台`);
    const dir = Math.sign(to.x - from.x);
    const x0 = from.x + dir * (from.w / 2 + ARROW.gap);
    const x1 = to.x - dir * (to.w / 2 + ARROW.gap);
    const mat = new THREE.MeshStandardMaterial({ color: ARROW.idle, emissive: '#000000', transparent: true, opacity: 0.7 });
    const shaftLen = Math.abs(x1 - x0) - ARROW.head;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(shaftLen, 0.06, 0.12), mat);
    shaft.position.set(x0 + (dir * shaftLen) / 2, 0.08, a.z);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.26, ARROW.head, 16), mat);
    head.rotation.z = -dir * (Math.PI / 2);
    head.position.set(x1 - (dir * ARROW.head) / 2, 0.08, a.z);
    const label = makeLabel([0.5, 0.5]);
    label.position.set((x0 + x1) / 2, 0.55, a.z);
    const dots = [0, 1, 2].map(() => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), new THREE.MeshBasicMaterial({ color: ARROW.lit }));
      dot.visible = false;
      return dot;
    });
    scene.add(shaft, head, label, ...dots);
    arrows.set(a.id, { a, x0, x1, mat, label, dots, lit: false });
  }
  // 点亮的箭头上有三个点顺着箭头方向流动。
  stage.onFrame((now) => {
    for (const e of arrows.values()) {
      if (!e.lit) continue;
      e.dots.forEach((d, i) => d.position.set(e.x0 + (e.x1 - e.x0) * ((now / 1200 + i / 3) % 1), 0.18, e.a.z));
    }
  });

  const blocks = new Map();
  const slotLabels = new Map();

  function paint(step) {
    const litPlates = new Set(step.plates ?? []);
    for (const [id, e] of plates) {
      const on = litPlates.has(id);
      e.plateMat.opacity = on ? 0.2 : 0.07;
      e.borderMat.opacity = on ? 1 : 0.35;
      e.title.material.opacity = on ? 1 : 0.55;
    }
    const litArrows = new Set(step.arrows ?? []);
    for (const [id, e] of arrows) {
      e.lit = litArrows.has(id);
      e.mat.color.set(e.lit ? ARROW.lit : ARROW.idle);
      e.mat.emissive.set(e.lit ? ARROW.lit : '#000000');
      e.mat.emissiveIntensity = 0.6;
      e.dots.forEach((d) => (d.visible = e.lit));
      setLabel(e.label, e.a.label, e.lit ? ARROW.lit : '#5a6275', 0.36, 600);
    }
  }

  /** 一行方块各自的中心 x：以 `centre` 为中心、间隔 [BLOCK] 的 `gap` 排开。 */
  function centredRow(list, centre) {
    const widths = list.map((b) => blockWidth(b.text, BLOCK.depth));
    const total = widths.reduce((s, w) => s + w, 0) + BLOCK.gap * Math.max(0, list.length - 1);
    let x = centre - total / 2;
    return widths.map((w) => {
      const mid = x + w / 2;
      x += w + BLOCK.gap;
      return { mid, left: mid - w / 2 };
    });
  }

  /**
   * 按 slot 把这一步的方块排成一行，`focus` 的方块抬高；有名字的 slot 把名字放在这行左边。
   *
   * 写了 `alignWith` 的 slot，第 i 块对准那个 slot 的第 i 块，查表这类一一对应的关系上下对齐成一列；没有对应的块才按 slot 的 `x` 居中。
   */
  function layoutBlocks(step) {
    const bySlot = new Map();
    for (const b of step.blocks ?? []) {
      if (!flow.slots[b.at]) throw new Error(`方块 ${b.id} 的位置 ${b.at} 不在 slots 里`);
      bySlot.set(b.at, [...(bySlot.get(b.at) ?? []), b]);
    }
    const rows = new Map();
    const names = Object.keys(flow.slots).sort((a, b) => !!flow.slots[a].alignWith - !!flow.slots[b].alignWith);
    for (const name of names) {
      const slot = flow.slots[name];
      const list = bySlot.get(name) ?? [];
      const own = centredRow(list, slot.x);
      const ref = slot.alignWith ? rows.get(slot.alignWith) : null;
      rows.set(name, ref?.length === list.length ? ref : own);
    }

    const placed = new Map();
    for (const [name, slot] of Object.entries(flow.slots)) {
      const list = bySlot.get(name) ?? [];
      const xs = rows.get(name);
      list.forEach((b, i) => {
        placed.set(b.id, { t: b, size: BLOCK, pos: new THREE.Vector3(xs[i].mid, BLOCK.height / 2 + (b.tag === 'focus' ? BLOCK.lift : 0), slot.z) });
      });
      if (!slot.label) continue;
      let label = slotLabels.get(name);
      if (!label) {
        label = makeLabel([1, 0.5]);
        setLabel(label, slot.label, '#8a93a6', 0.4);
        setOpacity(label, 0);
        scene.add(label);
        slotLabels.set(name, label);
      }
      const at = new THREE.Vector3((xs[0]?.left ?? slot.x) - 0.4, 0.3, slot.z);
      if (label.material.opacity === 0) label.position.copy(at);
      tween(label, { pos: at, opacity: list.length ? 1 : 0 });
    }
    stage.syncBlocks(blocks, placed);
  }

  return {
    mount: stage.mount,
    setActive: stage.setActive,
    render(step, { reset }) {
      if (reset) {
        stage.clearTweens();
        blocks.forEach(discard);
        blocks.clear();
      }
      paint(step);
      layoutBlocks(step);
    },
  };
}
