  // ───────────────────────── v71: the authored-asset bridge (Wilds of Aether's hybrid pipeline) ─────────────────────────
  // Wilds keeps everything procedural (the gameplay, the land, the camera, a fallback model for each character) and
  // lets a model authored in Blender (a GLB, from a headless bpy pipeline, say) replace a character's look once it has
  // loaded. A load that fails never removes the procedural model. The same here, for any actor the game registers:
  //   - the GLB is fitted to the procedural model's bounds (its height, its feet on the same ground, centred), so it
  //     stands exactly where the game expects;
  //   - its materials are brought into the house look: eyes and mouths become flat face colour stacked by polygon
  //     offset (as the procedural face's are), everything else the cel family (toon ramp and rim, its own colour and map);
  //   - its animation clips are found by name, through aliases (idle, fly, throw, hurt, death, taunt, walk), and
  //     crossfade into each other;
  //   - nodes named Slot_<something> are attachment points (a hat, a held thing);
  //   - a manifest can come with it, and an asset can't be marked for shipping without a licence in its manifest (Wilds'
  //     own rule: confirm the provenance and licence of every supplied asset before it ships).
  // The game is one file, so a GLB comes in embedded: a data: URI, an ArrayBuffer, or glTF JSON.
  const R3D_ASSETS = { actors: {}, loads: 0, fails: 0 };
  const ASSET_ALIASES = { idle: ["idle", "stand", "breath", "breathing", "rest"], fly: ["fly", "flight", "spin", "tumble"], throw: ["throw", "launch", "toss"], hurt: ["hurt", "hit", "ouch", "flinch"], death: ["death", "die", "dead", "ko"], taunt: ["taunt", "laugh", "gloat"], walk: ["walk", "walking", "locomotion", "move"], run: ["run", "running", "sprint"] };
  function r3dBounds(object) {   // an object's own bounds, as if it stood at the origin unturned (Wilds' standaloneBounds)
    const c = object.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c), size = box.getSize(new THREE.Vector3());
    return { box, size, minY: box.min.y, height: Math.max(1e-4, size.y) };
  }
  // register an actor: its host (the group the game poses) and its procedural model inside it
  function r3dActorRegister(name, host, procedural) {
    const A = { name, host, procedural, authored: null, reference: r3dBounds(procedural), animation: null, slots: {}, source: null, manifest: null, mode: "procedural", ship: false, error: null };
    R3D_ASSETS.actors[name] = A; return A;
  }
  function r3dAssetLook(model) {   // the house look on an authored model (Wilds' prepareAuthoredActorModel + material profiles)
    model.traverse(o => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.frustumCulled = false;
      const nm = (o.name || "").toLowerCase(), src = Array.isArray(o.material) ? o.material[0] : o.material, col = src && src.color ? src.color.clone() : new THREE.Color(0xffffff);
      const eye = /eye|iris|pupil|highlight|glint/.test(nm), mouth = /mouth|teeth|tongue/.test(nm);
      if (eye || mouth) o.material = new THREE.MeshBasicMaterial({ toneMapped: false, color: col, map: (src && src.map) || null, transparent: !!(src && src.transparent), opacity: src && src.opacity != null ? src.opacity : 1, polygonOffset: true, polygonOffsetFactor: eye ? -3 : -2, polygonOffsetUnits: eye ? -3 : -2 });
      else o.material = r3dToon(col, { map: (src && src.map) || null, vertexColors: !!(o.geometry && o.geometry.attributes.color), transparent: !!(src && src.transparent), opacity: src && src.opacity != null ? src.opacity : 1 });
    });
    return model;
  }
  function r3dAssetFit(model, ref) {   // Wilds' normalizeAuthoredActor: the reference's height, feet on its ground, centred
    model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.scale.set(1, 1, 1); model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    if (size.y <= 1e-6) throw new Error("authored model has no height");
    const k = ref.height / size.y; model.scale.setScalar(k); model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model); size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x; model.position.z -= c.z; model.position.y += ref.minY - box.min.y; model.updateMatrixWorld(true);
    return { scale: k, height: size.y };
  }
  function r3dAssetSlots(model) { const s = {}; model.traverse(o => { if (o.name && /^Slot_/i.test(o.name)) s[o.name] = o; }); return s; }
  function r3dAssetAnimation(model, clips) {   // Wilds' buildAnimationController: clips by name, through aliases, crossfaded
    if (!clips || !clips.length) return null;
    const mixer = new THREE.AnimationMixer(model), actions = {};
    for (const clip of clips) { const k = (clip.name || "").trim().toLowerCase(); if (k) actions[k] = mixer.clipAction(clip); }
    let cur = null;
    const resolve = n => { n = (n || "").toLowerCase(); if (actions[n]) return n; for (const a of ASSET_ALIASES[n] || []) if (actions[a]) return a; for (const k of Object.keys(actions)) if (k.includes(n)) return k; return null; };
    const set = (n, fade = 0.16) => {
      const k = resolve(n); if (!k || k === cur) return false;
      const next = actions[k], prev = cur ? actions[cur] : null;
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play(); if (prev) next.crossFadeFrom(prev, fade, true);
      cur = k; return true;
    };
    set("idle", 0);
    return { mixer, actions, set, resolve, get current() { return cur; } };
  }
  function r3dAssetParse(src) {   // a GLB or glTF, embedded: data: URI, ArrayBuffer, or JSON (string or object)
    const loader = new THREE.GLTFLoader();
    return new Promise((resolve, reject) => {
      if (src instanceof ArrayBuffer) loader.parse(src, "", resolve, reject);
      else if (typeof src === "object" && src) loader.parse(JSON.stringify(src), "", resolve, reject);
      else if (typeof src === "string" && /^\s*\{/.test(src)) loader.parse(src, "", resolve, reject);
      else if (typeof src === "string") loader.load(src, resolve, undefined, reject);
      else reject(new Error("no GLB source"));
    });
  }
  // load an authored model for an actor; it replaces the procedural look only if every step succeeds
  async function r3dActorLoad(name, src, { activate = true, manifest = null, ship = false } = {}) {
    const A = R3D_ASSETS.actors[name]; if (!A) throw new Error("no actor " + name);
    if (ship && !(manifest && manifest.license)) { A.error = "a shipped asset needs a licence in its manifest"; R3D_ASSETS.fails++; throw new Error(A.error); }
    R3D_ASSETS.loads++;
    try {
      const gltf = await r3dAssetParse(src), model = r3dAssetLook(gltf.scene), fit = r3dAssetFit(model, A.reference), animation = r3dAssetAnimation(model, gltf.animations), slots = r3dAssetSlots(model);
      if (A.authored) { A.host.remove(A.authored); A.authored.traverse(o => { if (o.isMesh) { o.geometry && o.geometry.dispose(); [].concat(o.material).forEach(m => m && m.dispose && m.dispose()); } }); }
      Object.assign(A, { authored: model, animation, slots, source: typeof src === "string" ? src.slice(0, 64) : "embedded", manifest, ship, error: null });
      A.host.add(model);
      if (activate) { A.procedural.visible = false; model.visible = true; A.mode = "authored"; } else model.visible = false;
      return { actor: name, mode: A.mode, animations: Object.keys(animation ? animation.actions : {}), slots: Object.keys(slots), height: fit.height, scale: fit.scale };
    } catch (e) { A.error = String(e && e.message || e); R3D_ASSETS.fails++; Debug.warn("RENDER", e, "08rl_r3d_assets:load " + name); throw e; }   // (the procedural model is untouched)
  }
  function r3dActorUse(name, mode) {
    const A = R3D_ASSETS.actors[name]; if (!A || (mode === "authored" && !A.authored)) return false;
    A.procedural.visible = mode !== "authored"; if (A.authored) A.authored.visible = mode === "authored"; A.mode = mode === "authored" ? "authored" : "procedural"; return true;
  }
  function r3dActorAnimate(name, state, fade) { const A = R3D_ASSETS.actors[name]; return !!(A && A.animation && A.animation.set(state, fade)); }
  function r3dAssetsUpdate(dt) { for (const A of Object.values(R3D_ASSETS.actors)) if (A.mode === "authored" && A.animation) A.animation.mixer.update(dt); }
  function r3dAssetsStatus() {
    const out = {};
    for (const [k, A] of Object.entries(R3D_ASSETS.actors)) out[k] = { mode: A.mode, authored: !!A.authored, source: A.source, animations: Object.keys(A.animation ? A.animation.actions : {}), current: A.animation ? A.animation.current : null, slots: Object.keys(A.slots), ship: A.ship, licence: A.manifest ? A.manifest.license || null : null, error: A.error };
    return { actors: out, loads: R3D_ASSETS.loads, fails: R3D_ASSETS.fails, unlicensedShipped: Object.values(R3D_ASSETS.actors).filter(A => A.ship && !(A.manifest && A.manifest.license)).length };
  }
