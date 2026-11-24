import { startNotebook } from '../../notebook/runtime.js';
import { createGraphView } from '../../notebook/graph-3d.js';
import { buildChangeScenes, GRAPH_NEXT, GRAPH_NOW } from './steps.js';

// 现状用现状的图，方案用方案的图；两张图里都有的组件位置相同。
const [now, next] = buildChangeScenes();
startNotebook({
  [now.id]: { ...now, createView: () => createGraphView(GRAPH_NOW) },
  [next.id]: { ...next, createView: () => createGraphView(GRAPH_NEXT) },
});
