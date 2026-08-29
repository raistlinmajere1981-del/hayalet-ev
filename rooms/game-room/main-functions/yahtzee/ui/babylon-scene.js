/* global window, document */

(function (global) {
  "use strict";

  const DEFAULT_DICE = [1, 1, 1, 1, 1];
  const DEFAULT_HELD = [false, false, false, false, false];
  const TABLE_FOOTPRINT_SCALE = 0.95;
  const DIE_SCALE = 0.9;
  const DIE_LAYOUT = [
    [-1.28, -0.7, -0.08],
    [0, -0.8, 0.05],
    [1.28, -0.68, -0.04],
    [-0.64, 0.2, 0.08],
    [0.67, 0.19, -0.07],
  ];
  const RACK_LAYOUT = [
    [2.62, 1.48, -1.06],
    [2.62, 1.48, -0.54],
    [2.62, 1.48, 0],
    [2.62, 1.48, 0.54],
    [2.62, 1.48, 1.06],
  ];
  let activeHandle = null;

  const DIE_PIPS = {
    1: [[0, 0]],
    2: [
      [-0.19, -0.19],
      [0.19, 0.19],
    ],
    3: [
      [-0.2, -0.2],
      [0, 0],
      [0.2, 0.2],
    ],
    4: [
      [-0.19, -0.19],
      [0.19, -0.19],
      [-0.19, 0.19],
      [0.19, 0.19],
    ],
    5: [
      [-0.2, -0.2],
      [0.2, -0.2],
      [0, 0],
      [-0.2, 0.2],
      [0.2, 0.2],
    ],
    6: [
      [-0.2, -0.22],
      [0.2, -0.22],
      [-0.2, 0],
      [0.2, 0],
      [-0.2, 0.22],
      [0.2, 0.22],
    ],
  };

  function hasRuntime(B) {
    return Boolean(
      B &&
        typeof B.Engine === "function" &&
        typeof B.Scene === "function" &&
        typeof B.CreateBox === "function" &&
        typeof B.CreateCylinder === "function" &&
        typeof B.CreateDisc === "function" &&
        typeof B.CreateTorus === "function"
    );
  }

  function color3(B, values) {
    return new B.Color3(values[0], values[1], values[2]);
  }

  function createMaterial(B, scene, name, diffuse, options) {
    const settings = options || {};
    const material = new B.StandardMaterial(name, scene);
    material.diffuseColor = color3(B, diffuse);
    material.specularColor = color3(B, settings.specular || [0.05, 0.04, 0.03]);
    material.specularPower = Number(settings.specularPower) || 48;
    if (settings.ambient) material.ambientColor = color3(B, settings.ambient);
    if (settings.emissive) material.emissiveColor = color3(B, settings.emissive);
    if (typeof settings.alpha === "number") material.alpha = settings.alpha;
    if (settings.doubleSided) material.backFaceCulling = false;
    return material;
  }

  function applyTexture(B, scene, material, src, uScale, vScale) {
    if (
      !material ||
      typeof src !== "string" ||
      src.trim() === "" ||
      typeof B.Texture !== "function"
    ) {
      return;
    }
    const texture = new B.Texture(src, scene, false, false);
    texture.uScale = uScale;
    texture.vScale = vScale;
    material.diffuseTexture = texture;
  }

  function makeUnpickable(mesh, parent) {
    mesh.isPickable = false;
    if (parent) mesh.parent = parent;
    return mesh;
  }

  function normalizeDice(candidate) {
    return DEFAULT_DICE.map(function (fallback, index) {
      const value = Array.isArray(candidate) ? Number(candidate[index]) : fallback;
      return Number.isInteger(value) && value >= 1 && value <= 6 ? value : fallback;
    });
  }

  function normalizeHeld(candidate) {
    return DEFAULT_HELD.map(function (_fallback, index) {
      return Array.isArray(candidate) && candidate[index] === true;
    });
  }

  function readTurn(state) {
    return state && typeof state === "object" && state.turn && typeof state.turn === "object"
      ? state.turn
      : state || {};
  }

  function createTable(B, scene, root, materials) {
    const tableRoot = new B.TransformNode("yahtzee-table-root", scene);
    tableRoot.position = new B.Vector3(0, 0, 0.08);
    tableRoot.scaling = new B.Vector3(TABLE_FOOTPRINT_SCALE, 1, TABLE_FOOTPRINT_SCALE);
    tableRoot.parent = root;

    const top = B.CreateBox(
      "yahtzee-game-table-top",
      { width: 7.05, height: 0.32, depth: 3.86 },
      scene
    );
    top.position = new B.Vector3(0, 0.92, 0);
    top.material = materials.table;
    makeUnpickable(top, tableRoot);

    const inset = B.CreateBox(
      "yahtzee-game-table-inset",
      { width: 5.56, height: 0.06, depth: 3.14 },
      scene
    );
    inset.position = new B.Vector3(-0.37, 1.112, 0);
    inset.material = materials.tableInset;
    makeUnpickable(inset, tableRoot);

    [
      { width: 6.84, depth: 0.14, x: 0, z: -1.86 },
      { width: 6.84, depth: 0.14, x: 0, z: 1.86 },
      { width: 0.14, depth: 3.66, x: -3.39, z: 0 },
      { width: 0.14, depth: 3.66, x: 3.39, z: 0 },
    ].forEach(function (edge) {
      const trim = B.CreateBox(
        "yahtzee-game-table-trim",
        { width: edge.width, height: 0.12, depth: edge.depth },
        scene
      );
      trim.position = new B.Vector3(edge.x, 1.17, edge.z);
      trim.material = materials.tableTrim;
      makeUnpickable(trim, tableRoot);
    });

    const apron = B.CreateBox(
      "yahtzee-game-table-front-apron",
      { width: 6.42, height: 0.46, depth: 0.18 },
      scene
    );
    apron.position = new B.Vector3(0, 0.68, -1.86);
    apron.material = materials.darkWood;
    makeUnpickable(apron, tableRoot);

    [-1.18, -0.6, 0, 0.6, 1.18].forEach(function (z, index) {
      const well = B.CreateDisc(
        "yahtzee-game-table-hold-well-" + index,
        { radius: 0.16, tessellation: 18 },
        scene
      );
      well.position = new B.Vector3(2.91, 1.228, z);
      well.rotation.x = Math.PI / 2;
      well.material = materials.well;
      makeUnpickable(well, tableRoot);

      const ring = B.CreateTorus(
        "yahtzee-game-table-hold-ring-" + index,
        { diameter: 0.4, thickness: 0.05, tessellation: 18 },
        scene
      );
      ring.position = new B.Vector3(2.91, 1.232, z);
      ring.material = materials.brass;
      makeUnpickable(ring, tableRoot);
    });

    return tableRoot;
  }

  function createLantern(B, scene, root, materials) {
    const lanternRoot = new B.TransformNode("yahtzee-lantern-root", scene);
    lanternRoot.position = new B.Vector3(2.3, 1.13, 0.86);
    lanternRoot.scaling = new B.Vector3(0.76, 0.76, 0.76);
    lanternRoot.parent = root;

    const base = B.CreateCylinder(
      "yahtzee-lantern-base",
      { height: 0.12, diameter: 0.46, tessellation: 10 },
      scene
    );
    base.position.y = 0.06;
    base.material = materials.metal;
    makeUnpickable(base, lanternRoot);

    const glass = B.CreateCylinder(
      "yahtzee-lantern-glass",
      { height: 0.64, diameter: 0.33, tessellation: 10 },
      scene
    );
    glass.position.y = 0.42;
    glass.material = materials.lanternGlass;
    makeUnpickable(glass, lanternRoot);

    const cap = B.CreateCylinder(
      "yahtzee-lantern-cap",
      { height: 0.1, diameter: 0.42, tessellation: 10 },
      scene
    );
    cap.position.y = 0.76;
    cap.material = materials.metal;
    makeUnpickable(cap, lanternRoot);

    const flame = B.CreateSphere("yahtzee-lantern-flame", { diameter: 0.18, segments: 7 }, scene);
    flame.position.y = 0.42;
    flame.scaling.y = 1.45;
    flame.material = materials.flame;
    makeUnpickable(flame, lanternRoot);

    const light = new B.PointLight("yahtzee-lantern-light", new B.Vector3(0, 0.5, 0), scene);
    light.parent = lanternRoot;
    light.diffuse = color3(B, [1, 0.46, 0.14]);
    light.specular = color3(B, [1, 0.3, 0.08]);
    light.intensity = 1.58;
    light.range = 8.2;

    return { flame: flame, light: light };
  }

  function createDie(B, scene, root, materials, index) {
    const layout = DIE_LAYOUT[index] || [0, 0, 0];
    const rack = RACK_LAYOUT[index] || RACK_LAYOUT[0];
    const dieRoot = new B.TransformNode("yahtzee-die-root-" + index, scene);
    dieRoot.position = new B.Vector3(layout[0], 1.47, layout[1]);
    dieRoot.rotation.y = layout[2];
    dieRoot.scaling = new B.Vector3(DIE_SCALE, DIE_SCALE, DIE_SCALE);
    dieRoot.parent = root;

    const cube = B.CreateBox("yahtzee-die-mesh-" + index, { size: 0.78, wrap: true }, scene);
    cube.material = materials.die;
    cube.parent = dieRoot;
    cube.isPickable = true;
    cube.metadata = Object.assign({}, cube.metadata || {}, { yahtzeeDieIndex: index });

    const pips = [];
    for (let pipIndex = 0; pipIndex < 6; pipIndex += 1) {
      const pip = B.CreateDisc(
        "yahtzee-die-pip-" + index + "-" + pipIndex,
        { radius: 0.075, tessellation: 10 },
        scene
      );
      pip.position.y = 0.396;
      pip.rotation.x = Math.PI / 2;
      pip.material = materials.pip;
      pip.setEnabled(false);
      makeUnpickable(pip, dieRoot);
      pips.push(pip);
    }

    return {
      root: dieRoot,
      cube: cube,
      pips: pips,
      basePosition: new B.Vector3(layout[0], 1.47, layout[1]),
      rackPosition: new B.Vector3(rack[0], rack[1], rack[2]),
      targetPosition: new B.Vector3(layout[0], 1.47, layout[1]),
      baseYaw: layout[2],
      value: 1,
      held: false,
      roll: null,
    };
  }

  function applyDieValue(model, value) {
    model.value = value;
    const positions = DIE_PIPS[value] || DIE_PIPS[1];
    model.pips.forEach(function (pip, index) {
      const position = positions[index];
      pip.setEnabled(Boolean(position));
      if (!position) return;
      pip.position.x = position[0];
      pip.position.z = position[1];
    });
  }

  function applyHeldState(model, held, materials) {
    model.held = held;
    model.cube.material = held ? materials.dieHeld : materials.die;
    model.targetPosition.copyFrom(held ? model.rackPosition : model.basePosition);
  }

  function readPickedDieIndex(pickInfo) {
    const mesh = pickInfo && pickInfo.hit === true ? pickInfo.pickedMesh : null;
    const value = mesh && mesh.metadata ? Number(mesh.metadata.yahtzeeDieIndex) : NaN;
    return Number.isInteger(value) && value >= 0 && value < DEFAULT_DICE.length ? value : -1;
  }

  function canToggleDie(index) {
    const actions = global.GameRoomYahtzeeStageActions;
    return Boolean(
      actions && typeof actions.canToggleDie === "function" && actions.canToggleDie(index) === true
    );
  }

  function toggleDie(index) {
    const actions = global.GameRoomYahtzeeStageActions;
    if (!actions || typeof actions.toggleDie !== "function") return false;
    return actions.toggleDie(index) === true;
  }

  function mount(canvas, initialState) {
    const B = global.BABYLON;
    if (!canvas || !hasRuntime(B)) return null;

    let engine = null;
    let scene = null;

    try {
      engine = new B.Engine(canvas, true, {
        antialias: true,
        preserveDrawingBuffer: false,
        stencil: false,
        premultipliedAlpha: true,
      });
      const pixelRatio = Number(global.devicePixelRatio) || 1;
      engine.setHardwareScalingLevel(Math.max(1.15, pixelRatio / 1.2));

      scene = new B.Scene(engine);
      scene.clearColor = new B.Color4(0, 0, 0, 0);
      scene.ambientColor = color3(B, [0.09, 0.08, 0.075]);

      const camera = new B.ArcRotateCamera(
        "yahtzee-stage-camera",
        -Math.PI / 2,
        1.04,
        12.7,
        new B.Vector3(0, 1.15, 0.1),
        scene
      );
      camera.minZ = 0.1;
      camera.panningSensibility = 0;
      camera.wheelPrecision = 0;
      camera.inputs.clear();

      const moonFill = new B.HemisphericLight(
        "yahtzee-moon-fill",
        new B.Vector3(-0.2, 1, -0.15),
        scene
      );
      moonFill.diffuse = color3(B, [0.36, 0.46, 0.6]);
      moonFill.groundColor = color3(B, [0.06, 0.04, 0.03]);
      moonFill.intensity = 0.96;

      const warmFill = new B.PointLight(
        "yahtzee-stage-warm-fill",
        new B.Vector3(-3.5, 3.3, -3.4),
        scene
      );
      warmFill.diffuse = color3(B, [1, 0.46, 0.2]);
      warmFill.specular = color3(B, [1, 0.38, 0.12]);
      warmFill.intensity = 0.62;
      warmFill.range = 11;

      const theme = global.GameRoomYahtzeePirateDeckTheme || { assets: {}, shots: {} };
      const themeAssets = theme.assets || {};

      const materials = {
        darkWood: createMaterial(B, scene, "yahtzee-stage-dark-wood", [0.52, 0.34, 0.27], {
          specular: [0.1, 0.045, 0.018],
          ambient: [0.05, 0.018, 0.009],
        }),
        table: createMaterial(B, scene, "yahtzee-table", [0.66, 0.42, 0.31], {
          specular: [0.24, 0.11, 0.04],
          ambient: [0.08, 0.026, 0.01],
          specularPower: 66,
        }),
        tableInset: createMaterial(B, scene, "yahtzee-table-inset", [0.56, 0.2, 0.18], {
          specular: [0.055, 0.02, 0.015],
          ambient: [0.055, 0.01, 0.008],
        }),
        tableTrim: createMaterial(B, scene, "yahtzee-table-trim", [0.42, 0.2, 0.052], {
          specular: [0.38, 0.2, 0.065],
          ambient: [0.1, 0.045, 0.012],
          specularPower: 76,
        }),
        brass: createMaterial(B, scene, "yahtzee-brass", [0.52, 0.28, 0.07], {
          specular: [0.6, 0.33, 0.095],
          emissive: [0.02, 0.008, 0.002],
          specularPower: 88,
        }),
        well: createMaterial(B, scene, "yahtzee-table-well", [0.022, 0.01, 0.008], {
          specular: [0.015, 0.006, 0.004],
        }),
        metal: createMaterial(B, scene, "yahtzee-metal", [0.3, 0.16, 0.04], {
          specular: [0.42, 0.22, 0.07],
        }),
        lanternGlass: createMaterial(B, scene, "yahtzee-lantern-glass", [0.46, 0.16, 0.025], {
          emissive: [0.2, 0.05, 0.005],
          alpha: 0.34,
        }),
        flame: createMaterial(B, scene, "yahtzee-flame", [1, 0.34, 0.025], {
          emissive: [0.9, 0.15, 0.005],
          specular: [0, 0, 0],
        }),
        die: createMaterial(B, scene, "yahtzee-die", [0.87, 0.69, 0.37], {
          specular: [0.34, 0.23, 0.1],
          emissive: [0.03, 0.018, 0.006],
          specularPower: 62,
        }),
        dieHeld: createMaterial(B, scene, "yahtzee-die-held", [0.74, 0.37, 0.09], {
          emissive: [0.07, 0.02, 0.002],
          specular: [0.28, 0.13, 0.035],
        }),
        pip: createMaterial(B, scene, "yahtzee-pip", [0.018, 0.012, 0.009], {
          specular: [0, 0, 0],
          doubleSided: true,
        }),
      };

      applyTexture(B, scene, materials.darkWood, themeAssets.tableWood, 2.4, 1.35);
      applyTexture(B, scene, materials.table, themeAssets.tableWood, 2.1, 1.25);
      applyTexture(B, scene, materials.tableInset, themeAssets.tableFelt, 2, 2);

      const gameRoot = new B.TransformNode("yahtzee-game-root", scene);
      gameRoot.position = new B.Vector3(0, -0.08, 0.12);
      createTable(B, scene, gameRoot, materials);
      const lantern = createLantern(B, scene, gameRoot, materials);
      const diceModels = DEFAULT_DICE.map(function (_value, index) {
        return createDie(B, scene, gameRoot, materials, index);
      });

      const directorFactory = global.GameRoomYahtzeeCameraDirector;
      const cameraDirector =
        directorFactory && typeof directorFactory.create === "function"
          ? directorFactory.create(camera, B, theme)
          : null;

      const reduceMotion = Boolean(
        global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
      let elapsed = 0;
      let disposed = false;
      let latestState = initialState && typeof initialState === "object" ? initialState : {};
      let lastRenderAt = 0;
      let lastSceneTickAt = 0;

      scene.constantlyUpdateMeshUnderPointer = false;
      scene.onPointerDown = function (_event, pickInfo) {
        const index = readPickedDieIndex(pickInfo);
        if (index < 0 || !canToggleDie(index)) return;
        toggleDie(index);
      };

      scene.onPointerMove = function (_event, pickInfo) {
        const index = readPickedDieIndex(pickInfo);
        canvas.style.cursor = index >= 0 && canToggleDie(index) ? "pointer" : "default";
      };

      function startDieRoll(model, index) {
        if (model.held) {
          model.roll = null;
          return;
        }
        model.root.position.copyFrom(model.basePosition);
        model.targetPosition.copyFrom(model.basePosition);
        model.roll = {
          elapsed: 0,
          duration: 560 + index * 32,
          turnsX: 2 + (index % 3),
          turnsZ: 2 + ((index + 1) % 3),
          lateral: 0.13 + index * 0.012,
        };
      }

      function beginRoll() {
        if (cameraDirector && typeof cameraDirector.focusRoll === "function") {
          cameraDirector.focusRoll(latestState);
        }
        if (reduceMotion) return;
        diceModels.forEach(function (model, index) {
          startDieRoll(model, index);
        });
      }

      function update(nextState, options) {
        const incoming = nextState && typeof nextState === "object" ? nextState : {};
        const looksLikeFullState =
          Object.prototype.hasOwnProperty.call(incoming, "active") ||
          Object.prototype.hasOwnProperty.call(incoming, "complete") ||
          Array.isArray(incoming.players);
        latestState = looksLikeFullState
          ? incoming
          : Object.assign({}, latestState, { turn: incoming });
        const turn = readTurn(latestState);
        const values = normalizeDice(turn.dice);
        const held = normalizeHeld(turn.held);
        diceModels.forEach(function (model, index) {
          applyDieValue(model, values[index]);
          applyHeldState(model, held[index], materials);
        });
        if (cameraDirector && typeof cameraDirector.syncState === "function") {
          cameraDirector.syncState(latestState);
        }
        if (options && options.animate === true) beginRoll();
      }

      function moveTowardTarget(model, delta) {
        const amount = reduceMotion ? 1 : 1 - Math.exp(-Math.max(1, delta) * 0.015);
        model.root.position.x += (model.targetPosition.x - model.root.position.x) * amount;
        model.root.position.y += (model.targetPosition.y - model.root.position.y) * amount;
        model.root.position.z += (model.targetPosition.z - model.root.position.z) * amount;
        model.root.rotation.x *= 1 - amount;
        model.root.rotation.y += (model.baseYaw - model.root.rotation.y) * amount;
        model.root.rotation.z *= 1 - amount;
      }

      function animateDice(delta) {
        diceModels.forEach(function (model, index) {
          if (!model.roll) {
            moveTowardTarget(model, delta);
            return;
          }

          model.roll.elapsed += delta;
          const progress = Math.min(1, model.roll.elapsed / model.roll.duration);
          const envelope = Math.sin(progress * Math.PI);
          model.root.position.x =
            model.basePosition.x + Math.sin(progress * Math.PI * 2 + index) * model.roll.lateral * envelope;
          model.root.position.y =
            model.basePosition.y + envelope * (0.52 + index * 0.018);
          model.root.position.z =
            model.basePosition.z + Math.cos(progress * Math.PI * 2.35 + index) * 0.1 * envelope;
          model.root.rotation.x = progress * model.roll.turnsX * Math.PI * 2;
          model.root.rotation.y = model.baseYaw + progress * (index + 2) * Math.PI * 2;
          model.root.rotation.z = progress * model.roll.turnsZ * Math.PI * 2;

          if (progress >= 1) {
            model.roll = null;
            model.root.position.copyFrom(model.targetPosition);
            model.root.rotation.set(0, model.baseYaw, 0);
          }
        });
      }

      update(latestState, { animate: false });

      scene.onBeforeRenderObservable.add(function () {
        const tickAt = nowMs();
        const delta = lastSceneTickAt > 0 ? Math.min(80, tickAt - lastSceneTickAt) : 16;
        lastSceneTickAt = tickAt;
        elapsed += delta * 0.001;

        if (!reduceMotion) {
          lantern.flame.scaling.y = 1.4 + Math.sin(elapsed * 8.2) * 0.11;
          lantern.light.intensity =
            1.56 + Math.sin(elapsed * 8.7) * 0.07 + Math.sin(elapsed * 3.7) * 0.035;
        }

        animateDice(delta);
        if (cameraDirector && typeof cameraDirector.tick === "function") {
          cameraDirector.tick(delta);
        }
      });

      function nowMs() {
        if (global.performance && typeof global.performance.now === "function") {
          return global.performance.now();
        }
        return Date.now();
      }

      function hasRollingDice() {
        return diceModels.some(function (model) {
          return Boolean(model.roll);
        });
      }

      engine.runRenderLoop(function () {
        if (document.hidden || disposed) return;
        const now = nowMs();
        const targetFps = hasRollingDice() ? 45 : latestState.active === true ? 30 : 15;
        const frameInterval = 1000 / targetFps;
        if (now - lastRenderAt < frameInterval) return;
        lastRenderAt = now;
        scene.render();
      });

      function getDiceAnimationState() {
        return diceModels.map(function (model, index) {
          return {
            index: index,
            value: model.value,
            held: model.held,
            rolling: Boolean(model.roll),
            position: [model.root.position.x, model.root.position.y, model.root.position.z],
            targetPosition: [model.targetPosition.x, model.targetPosition.y, model.targetPosition.z],
            rotation: [model.root.rotation.x, model.root.rotation.y, model.root.rotation.z],
          };
        });
      }

      const resize = function () {
        if (!disposed) engine.resize();
      };
      global.addEventListener("resize", resize);
      canvas.dataset.babylonActive = "true";
      resize();

      const handle = {
        beginRoll: beginRoll,
        update: update,
        getDiceAnimationState: getDiceAnimationState,
        resize: resize,
        setShot: function (name) {
          if (cameraDirector && typeof cameraDirector.setShot === "function") {
            cameraDirector.setShot(name);
          }
        },
        dispose: function () {
          if (disposed) return;
          disposed = true;
          scene.onPointerDown = null;
          scene.onPointerMove = null;
          canvas.style.cursor = "default";
          global.removeEventListener("resize", resize);
          delete canvas.dataset.babylonActive;
          if (cameraDirector && typeof cameraDirector.dispose === "function") {
            cameraDirector.dispose();
          }
          engine.stopRenderLoop();
          scene.dispose();
          engine.dispose();
          if (activeHandle === handle) activeHandle = null;
        },
      };
      activeHandle = handle;
      return handle;
    } catch (_error) {
      try {
        if (scene) scene.dispose();
        if (engine) engine.dispose();
      } catch (_disposeError) {
        /* Lightweight 2D stage remains available. */
      }
      return null;
    }
  }

  global.GameRoomYahtzeeBabylonScene = {
    mount: mount,
    syncState: function (nextState) {
      if (activeHandle && typeof activeHandle.update === "function") {
        activeHandle.update(nextState, { animate: false });
      }
    },
    getDiceAnimationState: function () {
      return activeHandle && typeof activeHandle.getDiceAnimationState === "function"
        ? activeHandle.getDiceAnimationState()
        : [];
    },
    setShot: function (name) {
      if (activeHandle && typeof activeHandle.setShot === "function") {
        activeHandle.setShot(name);
      }
    },
  };
})(window);
