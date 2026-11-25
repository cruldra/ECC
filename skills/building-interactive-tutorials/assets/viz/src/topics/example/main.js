import { startNotebook } from '../../notebook/runtime.js';
import { createFlowView } from '../../notebook/flow-3d.js';
import { createGraphView } from '../../notebook/graph-3d.js';
import { buildConceptScenes, buildFlowScenes, buildGraphScenes, buildMergeScenes, buildPreSplitScenes, CONCEPTS, FLOW, GRAPH, MERGE_FLOW, PRE_SPLIT_FLOW } from './steps.js';

/** 给每段演示配上创建画面的函数，排成以 `id` 为键的条目，拼起来就是 [startNotebook] 要的演示表。 */
const withView = (scenes, createView) => scenes.map((scene) => [scene.id, { ...scene, createView }]);

// 三段数据流转演示、概念图和组件图各画各的布局；每段各建一份画面。
startNotebook(Object.fromEntries([
  ...withView(buildFlowScenes(), () => createFlowView(FLOW)),
  ...withView(buildConceptScenes(), () => createGraphView(CONCEPTS)),
  ...withView(buildPreSplitScenes(), () => createFlowView(PRE_SPLIT_FLOW)),
  ...withView(buildMergeScenes(), () => createFlowView(MERGE_FLOW)),
  ...withView(buildGraphScenes(), () => createGraphView(GRAPH)),
]));
