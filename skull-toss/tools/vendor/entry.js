// the parts of Three.js the 3D renderer (src/js/08r*.js) uses; bundled into window.THREE by esbuild
export * from "three";
export { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
export { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
// the authored-asset bridge (08rl_r3d_assets.js): a model built in Blender comes in as a GLB, embedded in the page
export { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
