import { startNotebook } from '../../notebook/runtime.js';
import { createGraphView } from '../../notebook/graph-3d.js';
import { createTilesView } from '../../notebook/tiles-3d.js';
import { buildExampleScenes, buildGraphScenes, GRAPH } from './steps.js';

/** 给每段演示配上创建画面的函数，排成以 `id` 为键的条目，拼起来就是 [startNotebook] 要的演示表。 */
const withView = (scenes, createView) => scenes.map((scene) => [scene.id, { ...scene, createView }]);

// 方块演示用桌面方块画面；组件图演示共用一张 [GRAPH]，每段各建一份画面。
startNotebook(Object.fromEntries([
  ...withView(buildExampleScenes(), createTilesView),
  ...withView(buildGraphScenes(), () => createGraphView(GRAPH)),
]));
