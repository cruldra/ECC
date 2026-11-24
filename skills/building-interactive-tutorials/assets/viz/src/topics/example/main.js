import { startNotebook } from '../../notebook/runtime.js';
import { createTilesView } from '../../notebook/tiles-3d.js';
import { buildExampleScenes } from './steps.js';

// 这一页的演示都用桌面方块画面；要别的画面时，另写一个同样提供 mount、render、setActive 的视图。
startNotebook(Object.fromEntries(buildExampleScenes().map((scene) => [scene.id, { ...scene, createView: createTilesView }])));
