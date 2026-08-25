/* global window, document */

(function (global) {
  "use strict";

  const DEFAULT_DICE = [1, 1, 1, 1, 1];
  const DEFAULT_HELD = [false, false, false, false, false];
  const DIE_SPACING = 1.15;
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
      typeof B.CreateSphere === "function"
    );
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

  function color3(B, values) {
    return new B.Color3(values[0], values[1], values[2]);
  }

  function createMaterial(B, scene, name, diffuse, options) {
    const settings = options || {};
    const material = new B.StandardMaterial(name, scene);
    material.diffuseColor = color3(B, diffuse);
    material.specularColor = color3(B, settings.specular || [0.05, 0.04, 0.03]);
    if (settings.emissive) material.emissiveColor = color3(B, settings.emissive);
    if (typeof settings.alpha === "number") material.alpha = settings.alpha;
    if (settings.doubleSided) material.backFaceCulling = false;
    return material;
  }

  function makeUnpickable(mesh, parent) {
    mesh.isPickable = false;
    if (parent) mesh.parent = parent;
    return mesh;
  }

  function createNightSky(B, scene, materials) {
    const horizon = B.CreatePlane("yahtzee-night-horizon", { width: 46, height: 18 }, scene);
    horizon.position = new B.Vector3(0, 6.2, 19);
    horizon.material = materials.horizon;
    horizon.isPickable = false;

    const ocean = B.CreateGround(
      "yahtzee-dark-ocean",
      { width: 52, height: 52, subdivisions: 1 },
      scene
    );
    ocean.position = new B.Vector3(0, -1.15, 10);
    ocean.material = materials.ocean;
    ocean.isPickable = false;

    for (let index = 0; index < 12; index += 1) {
      const star = B.CreateSphere(
        "yahtzee-star-" + index,
        { diameter: 0.045 + (index % 3) * 0.018, segments: 4 },
        scene
      );
      star.position = new B.Vector3(-10.5 + index * 1.9, 5.8 + (index % 4) * 1.05, 17.8);
      star.material = materials.star;
      star.isPickable = false;
    }

    const moonGlow = B.CreateSphere("yahtzee-moon-halo", { diameter: 3.1, segments: 20 }, scene);
    moonGlow.position = new B.Vector3(-4.2, 5.6, 10.8);
    moonGlow.scaling.z = 0.08;
    moonGlow.material = materials.moonGlow;
    moonGlow.isPickable = false;

    const moon = B.CreateSphere("yahtzee-moon-disc", { diameter: 2.05, segments: 20 }, scene);
    moon.position = new B.Vector3(-4.2, 5.6, 10.7);
    moon.scaling.z = 0.12;
    moon.material = materials.moon;
    moon.isPickable = false;
  }

  function createDeck(B, scene, shipRoot, materials) {
    for (let index = 0; index < 15; index += 1) {
      const plank = B.CreateBox(
        "yahtzee-deck-plank-" + index,
        { width: 1.06, height: 0.12, depth: 13.8 },
        scene
      );
      plank.position = new B.Vector3(-7.42 + index * 1.06, 0, 0.45);
      plank.material = index % 2 === 0 ? materials.deck : materials.deckAlternate;
      makeUnpickable(plank, shipRoot);
    }

    [-8.1, 8.1].forEach(function (x, index) {
      const rail = B.CreateBox(
        "yahtzee-gunwale-" + index,
        { width: 0.28, height: 0.55, depth: 14.2 },
        scene
      );
      rail.position = new B.Vector3(x, 0.48, 0.45);
      rail.material = materials.darkWood;
      makeUnpickable(rail, shipRoot);
    });

    [-5.8, -1.95, 1.95, 5.8].forEach(function (x, index) {
      const beam = B.CreateBox(
        "yahtzee-deck-beam-" + index,
        { width: 0.18, height: 0.16, depth: 13.9 },
        scene
      );
      beam.position = new B.Vector3(x, 0.12, 0.45);
      beam.material = materials.trim;
      makeUnpickable(beam, shipRoot);
    });
  }

  function createMastAndRigging(B, scene, shipRoot, materials) {
    const mast = B.CreateCylinder(
      "yahtzee-main-mast",
      { height: 8.6, diameter: 0.44, tessellation: 12 },
      scene
    );
    mast.position = new B.Vector3(6.1, 4.22, 2.75);
    mast.material = materials.mast;
    makeUnpickable(mast, shipRoot);

    const spar = B.CreateBox("yahtzee-main-spar", { width: 7.5, height: 0.2, depth: 0.22 }, scene);
    spar.position = new B.Vector3(5.45, 6.35, 2.7);
    spar.rotation.z = -0.035;
    spar.material = materials.mast;
    makeUnpickable(spar, shipRoot);

    const sail = B.CreatePlane("yahtzee-sail-silhouette", { width: 5.4, height: 2.6 }, scene);
    sail.position = new B.Vector3(5.45, 4.9, 2.83);
    sail.rotation.z = -0.035;
    sail.material = materials.sail;
    makeUnpickable(sail, shipRoot);

    const ropePaths = [
      [new B.Vector3(6.1, 8.35, 2.75), new B.Vector3(-7.7, 0.75, -5.6)],
      [new B.Vector3(6.1, 8.35, 2.75), new B.Vector3(7.7, 0.75, -5.7)],
      [new B.Vector3(1.75, 6.45, 2.7), new B.Vector3(-7.7, 0.7, 5.8)],
      [new B.Vector3(9.1, 6.25, 2.7), new B.Vector3(7.7, 0.7, 5.8)],
      [new B.Vector3(3.1, 6.35, 2.72), new B.Vector3(3.2, 0.45, 6.3)],
    ];

    ropePaths.forEach(function (points, index) {
      const rope = B.CreateLines("yahtzee-rigging-rope-" + index, { points: points }, scene);
      rope.color = color3(B, [0.12, 0.085, 0.06]);
      rope.alpha = 0.88;
      makeUnpickable(rope, shipRoot);
    });
  }

  function createTable(B, scene, shipRoot, materials) {
    const tableRoot = new B.TransformNode("yahtzee-table-root", scene);
    tableRoot.parent = shipRoot;

    const top = B.CreateBox(
      "yahtzee-game-table-top",
      { width: 7.25, height: 0.34, depth: 4.1 },
      scene
    );
    top.position = new B.Vector3(0, 1.08, -0.15);
    top.material = materials.table;
    makeUnpickable(top, tableRoot);

    const inset = B.CreateBox(
      "yahtzee-game-table-inset",
      { width: 6.7, height: 0.055, depth: 3.55 },
      scene
    );
    inset.position = new B.Vector3(0, 1.28, -0.15);
    inset.material = materials.tableInset;
    makeUnpickable(inset, tableRoot);

    [-2.85, 2.85].forEach(function (x) {
      [-1.4, 1.15].forEach(function (z) {
        const leg = B.CreateCylinder(
          "yahtzee-game-table-leg",
          { height: 1.08, diameter: 0.3, tessellation: 10 },
          scene
        );
        leg.position = new B.Vector3(x, 0.48, z);
        leg.material = materials.darkWood;
        makeUnpickable(leg, tableRoot);
      });
    });

    return tableRoot;
  }

  function createPirate(B, scene, shipRoot, materials, options) {
    const root = new B.TransformNode("yahtzee-pirate-" + options.id, scene);
    root.position = new B.Vector3(options.x, 0.12, options.z);
    root.rotation.y = options.rotation;
    root.scaling = new B.Vector3(options.scale, options.scale, options.scale);
    root.parent = shipRoot;

    const body = B.CreateCylinder(
      "yahtzee-pirate-body-" + options.id,
      { height: 1.65, diameterTop: 0.64, diameterBottom: 0.9, tessellation: 8 },
      scene
    );
    body.position.y = 1.02;
    body.material = materials[options.coat];
    makeUnpickable(body, root);

    const belt = B.CreateTorus(
      "yahtzee-pirate-belt-" + options.id,
      { diameter: 0.78, thickness: 0.1, tessellation: 12 },
      scene
    );
    belt.position.y = 0.76;
    belt.material = materials.leather;
    makeUnpickable(belt, root);

    const head = B.CreateSphere(
      "yahtzee-pirate-head-" + options.id,
      { diameter: 0.58, segments: 8 },
      scene
    );
    head.position.y = 2.05;
    head.material = materials.skin;
    makeUnpickable(head, root);

    const brim = B.CreateCylinder(
      "yahtzee-pirate-hat-brim-" + options.id,
      { height: 0.08, diameter: 0.93, tessellation: 14 },
      scene
    );
    brim.position.y = 2.35;
    brim.material = materials.hat;
    makeUnpickable(brim, root);

    const crown = B.CreateCylinder(
      "yahtzee-pirate-hat-crown-" + options.id,
      { height: 0.27, diameterTop: 0.42, diameterBottom: 0.62, tessellation: 10 },
      scene
    );
    crown.position.y = 2.49;
    crown.material = materials.hat;
    makeUnpickable(crown, root);

    [-1, 1].forEach(function (side) {
      const arm = B.CreateCylinder(
        "yahtzee-pirate-arm-" + options.id + "-" + side,
        { height: 1.02, diameter: 0.18, tessellation: 7 },
        scene
      );
      arm.position = new B.Vector3(side * 0.46, 1.23, -0.06);
      arm.rotation.z = side * (0.52 + options.pose * 0.12);
      arm.rotation.x = options.pose * 0.16;
      arm.material = materials[options.coat];
      makeUnpickable(arm, root);
    });

    return root;
  }

  function createLantern(B, scene, shipRoot, materials) {
    const root = new B.TransformNode("yahtzee-lantern-root", scene);
    root.position = new B.Vector3(0, 1.3, 1.25);
    root.parent = shipRoot;

    const base = B.CreateCylinder(
      "yahtzee-lantern-base",
      { height: 0.12, diameter: 0.48, tessellation: 12 },
      scene
    );
    base.position.y = 0.06;
    base.material = materials.metal;
    makeUnpickable(base, root);

    const cage = B.CreateCylinder(
      "yahtzee-lantern-glass",
      { height: 0.72, diameter: 0.36, tessellation: 12 },
      scene
    );
    cage.position.y = 0.47;
    cage.material = materials.lanternGlass;
    makeUnpickable(cage, root);

    const cap = B.CreateTorus(
      "yahtzee-lantern-cap",
      { diameter: 0.44, thickness: 0.08, tessellation: 14 },
      scene
    );
    cap.position.y = 0.82;
    cap.material = materials.metal;
    makeUnpickable(cap, root);

    const flame = B.CreateSphere("yahtzee-lantern-flame", { diameter: 0.23, segments: 8 }, scene);
    flame.position.y = 0.44;
    flame.scaling.y = 1.55;
    flame.material = materials.flame;
    makeUnpickable(flame, root);

    const light = new B.PointLight("yahtzee-lantern-light", new B.Vector3(0, 0.55, 0), scene);
    light.parent = root;
    light.diffuse = color3(B, [1, 0.48, 0.16]);
    light.specular = color3(B, [1, 0.32, 0.09]);
    light.intensity = 2.25;
    light.range = 12;

    return { flame: flame, light: light };
  }

  function createDie(B, scene, shipRoot, materials, index) {
    const root = new B.TransformNode("yahtzee-die-root-" + index, scene);
    root.position = new B.Vector3((index - 2) * DIE_SPACING, 1.79, -0.7 + (index % 2) * 0.12);
    root.rotation.y = (index - 2) * 0.045;
    root.parent = shipRoot;

    const cube = B.CreateBox("yahtzee-die-mesh-" + index, { size: 0.82, wrap: true }, scene);
    cube.material = materials.die;
    makeUnpickable(cube, root);

    const heldRing = B.CreateTorus(
      "yahtzee-die-held-ring-" + index,
      { diameter: 1.03, thickness: 0.065, tessellation: 24 },
      scene
    );
    heldRing.position.y = -0.47;
    heldRing.material = materials.heldGlow;
    heldRing.setEnabled(false);
    makeUnpickable(heldRing, root);

    const pips = [];
    for (let pipIndex = 0; pipIndex < 6; pipIndex += 1) {
      const pip = B.CreateDisc(
        "yahtzee-die-pip-" + index + "-" + pipIndex,
        { radius: 0.075, tessellation: 12 },
        scene
      );
      pip.position.y = 0.416;
      pip.rotation.x = Math.PI / 2;
      pip.material = materials.pip;
      pip.setEnabled(false);
      makeUnpickable(pip, root);
      pips.push(pip);
    }

    return {
      root: root,
      cube: cube,
      heldRing: heldRing,
      pips: pips,
      basePosition: root.position.clone(),
      baseYaw: root.rotation.y,
      held: false,
      roll: null,
    };
  }

  function applyDieValue(model, value) {
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
    model.heldRing.setEnabled(held);
    if (!model.roll) model.root.position.y = model.basePosition.y + (held ? 0.16 : 0);
  }

  function mount(canvas, initialTurn) {
    const B = global.BABYLON;
    if (!canvas || !hasRuntime(B)) return null;

    let engine = null;
    let scene = null;

    try {
      engine = new B.Engine(canvas, true, {
        antialias: true,
        preserveDrawingBuffer: false,
        stencil: false,
      });
      const pixelRatio = Number(global.devicePixelRatio) || 1;
      engine.setHardwareScalingLevel(Math.max(1, pixelRatio / 1.5));

      scene = new B.Scene(engine);
      scene.clearColor = new B.Color4(0.006, 0.011, 0.025, 1);
      scene.ambientColor = color3(B, [0.04, 0.055, 0.085]);
      scene.fogMode = B.Scene.FOGMODE_LINEAR;
      scene.fogStart = 15;
      scene.fogEnd = 38;
      scene.fogColor = color3(B, [0.006, 0.015, 0.032]);

      const camera = new B.ArcRotateCamera(
        "yahtzee-deck-camera",
        -Math.PI / 2,
        1.08,
        14.6,
        new B.Vector3(0, 1.05, 0.35),
        scene
      );
      camera.lowerRadiusLimit = 12.3;
      camera.upperRadiusLimit = 17.2;
      camera.lowerBetaLimit = 0.88;
      camera.upperBetaLimit = 1.28;
      camera.panningSensibility = 0;
      camera.wheelPrecision = 90;
      camera.minZ = 0.1;
      camera.attachControl(canvas, true);

      const moonFill = new B.HemisphericLight(
        "yahtzee-moon-fill",
        new B.Vector3(-0.25, 1, -0.15),
        scene
      );
      moonFill.diffuse = color3(B, [0.43, 0.56, 0.76]);
      moonFill.groundColor = color3(B, [0.018, 0.025, 0.05]);
      moonFill.intensity = 0.5;

      const moonKey = new B.DirectionalLight(
        "yahtzee-moon-key",
        new B.Vector3(0.38, -0.82, 0.28),
        scene
      );
      moonKey.diffuse = color3(B, [0.52, 0.64, 0.86]);
      moonKey.intensity = 0.72;

      const materials = {
        horizon: createMaterial(B, scene, "yahtzee-horizon-material", [0.004, 0.012, 0.03], {
          emissive: [0.004, 0.013, 0.032],
          specular: [0, 0, 0],
          doubleSided: true,
        }),
        ocean: createMaterial(B, scene, "yahtzee-ocean-material", [0.006, 0.025, 0.052], {
          emissive: [0.002, 0.012, 0.026],
          specular: [0.14, 0.21, 0.3],
        }),
        star: createMaterial(B, scene, "yahtzee-star-material", [0.55, 0.68, 0.82], {
          emissive: [0.48, 0.62, 0.8],
          specular: [0, 0, 0],
        }),
        moon: createMaterial(B, scene, "yahtzee-moon-material", [0.72, 0.8, 0.82], {
          emissive: [0.78, 0.86, 0.9],
          specular: [0, 0, 0],
        }),
        moonGlow: createMaterial(B, scene, "yahtzee-moon-glow-material", [0.42, 0.55, 0.68], {
          emissive: [0.36, 0.48, 0.62],
          alpha: 0.18,
          specular: [0, 0, 0],
          doubleSided: true,
        }),
        deck: createMaterial(B, scene, "yahtzee-deck-material", [0.17, 0.066, 0.026], {
          specular: [0.08, 0.05, 0.025],
        }),
        deckAlternate: createMaterial(
          B,
          scene,
          "yahtzee-deck-alternate-material",
          [0.135, 0.046, 0.018],
          { specular: [0.055, 0.035, 0.018] }
        ),
        trim: createMaterial(B, scene, "yahtzee-deck-trim-material", [0.08, 0.025, 0.012]),
        darkWood: createMaterial(B, scene, "yahtzee-dark-wood-material", [0.055, 0.018, 0.009]),
        mast: createMaterial(B, scene, "yahtzee-mast-material", [0.13, 0.045, 0.018]),
        sail: createMaterial(B, scene, "yahtzee-sail-material", [0.025, 0.03, 0.04], {
          alpha: 0.76,
          specular: [0, 0, 0],
          doubleSided: true,
        }),
        table: createMaterial(B, scene, "yahtzee-table-material", [0.235, 0.085, 0.024], {
          specular: [0.18, 0.09, 0.035],
        }),
        tableInset: createMaterial(B, scene, "yahtzee-table-inset-material", [0.12, 0.032, 0.014], {
          specular: [0.06, 0.03, 0.015],
        }),
        coatRed: createMaterial(B, scene, "yahtzee-pirate-red", [0.19, 0.035, 0.025]),
        coatBlue: createMaterial(B, scene, "yahtzee-pirate-blue", [0.025, 0.065, 0.105]),
        coatBrown: createMaterial(B, scene, "yahtzee-pirate-brown", [0.12, 0.055, 0.024]),
        coatBlack: createMaterial(B, scene, "yahtzee-pirate-black", [0.028, 0.025, 0.026]),
        leather: createMaterial(B, scene, "yahtzee-pirate-leather", [0.045, 0.018, 0.01]),
        skin: createMaterial(B, scene, "yahtzee-pirate-skin", [0.31, 0.18, 0.11]),
        hat: createMaterial(B, scene, "yahtzee-pirate-hat", [0.018, 0.016, 0.017]),
        metal: createMaterial(B, scene, "yahtzee-lantern-metal", [0.18, 0.105, 0.035], {
          specular: [0.34, 0.2, 0.08],
        }),
        lanternGlass: createMaterial(B, scene, "yahtzee-lantern-glass", [0.5, 0.19, 0.035], {
          emissive: [0.26, 0.07, 0.008],
          alpha: 0.38,
          specular: [0.38, 0.18, 0.06],
        }),
        flame: createMaterial(B, scene, "yahtzee-flame-material", [1, 0.36, 0.035], {
          emissive: [1, 0.19, 0.008],
          specular: [0, 0, 0],
        }),
        die: createMaterial(B, scene, "yahtzee-die-material", [0.72, 0.6, 0.4], {
          specular: [0.28, 0.2, 0.12],
        }),
        dieHeld: createMaterial(B, scene, "yahtzee-die-held-material", [0.88, 0.46, 0.11], {
          emissive: [0.12, 0.035, 0.004],
          specular: [0.4, 0.18, 0.05],
        }),
        pip: createMaterial(B, scene, "yahtzee-die-pip-material", [0.018, 0.012, 0.009], {
          specular: [0, 0, 0],
          doubleSided: true,
        }),
        heldGlow: createMaterial(B, scene, "yahtzee-held-glow-material", [0.9, 0.35, 0.04], {
          emissive: [0.85, 0.19, 0.015],
          specular: [0, 0, 0],
        }),
      };

      createNightSky(B, scene, materials);

      const shipRoot = new B.TransformNode("yahtzee-ship-sway-root", scene);
      createDeck(B, scene, shipRoot, materials);
      createMastAndRigging(B, scene, shipRoot, materials);
      createTable(B, scene, shipRoot, materials);

      const pirateOptions = [
        { id: "port", x: -4.65, z: 0.5, scale: 0.96, rotation: -0.42, coat: "coatRed", pose: 1 },
        {
          id: "starboard",
          x: 4.7,
          z: 0.65,
          scale: 1.02,
          rotation: 0.44,
          coat: "coatBlue",
          pose: -1,
        },
        {
          id: "aft-left",
          x: -3.25,
          z: 4.2,
          scale: 0.83,
          rotation: -0.12,
          coat: "coatBrown",
          pose: -0.5,
        },
        {
          id: "aft-right",
          x: 3.15,
          z: 4.35,
          scale: 0.88,
          rotation: 0.14,
          coat: "coatBlack",
          pose: 0.6,
        },
      ];
      pirateOptions.forEach(function (options) {
        createPirate(B, scene, shipRoot, materials, options);
      });

      const lantern = createLantern(B, scene, shipRoot, materials);
      const diceModels = DEFAULT_DICE.map(function (_value, index) {
        return createDie(B, scene, shipRoot, materials, index);
      });
      const reduceMotion = Boolean(
        global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
      let elapsed = 0;
      let disposed = false;

      function beginRoll() {
        if (reduceMotion) return;
        diceModels.forEach(function (model, index) {
          model.roll = {
            elapsed: 0,
            duration: 540 + index * 24,
            turnsX: 2 + (index % 3),
            turnsZ: 2 + ((index + 1) % 3),
          };
        });
      }

      function update(turn, options) {
        const source = turn && typeof turn === "object" ? turn : {};
        const values = normalizeDice(source.dice);
        const held = normalizeHeld(source.held);
        diceModels.forEach(function (model, index) {
          applyDieValue(model, values[index]);
          applyHeldState(model, held[index], materials);
        });
        if (options && options.animate === true) beginRoll();
      }

      function animateDice(delta) {
        diceModels.forEach(function (model, index) {
          const heldOffset = model.held ? 0.16 : 0;
          if (!model.roll) {
            model.root.position.y = model.basePosition.y + heldOffset;
            model.root.rotation.x = 0;
            model.root.rotation.y = model.baseYaw;
            model.root.rotation.z = 0;
          } else {
            model.roll.elapsed += delta;
            const progress = Math.min(1, model.roll.elapsed / model.roll.duration);
            const envelope = Math.sin(progress * Math.PI);
            model.root.position.x =
              model.basePosition.x + Math.sin(progress * Math.PI * 2 + index) * 0.11 * envelope;
            model.root.position.y =
              model.basePosition.y + heldOffset + envelope * (0.52 + index * 0.025);
            model.root.position.z =
              model.basePosition.z + Math.cos(progress * Math.PI * 2 + index) * 0.08 * envelope;
            model.root.rotation.x = progress * model.roll.turnsX * Math.PI * 2;
            model.root.rotation.y = model.baseYaw + progress * (index + 2) * Math.PI * 2;
            model.root.rotation.z = progress * model.roll.turnsZ * Math.PI * 2;
            if (progress >= 1) {
              model.roll = null;
              model.root.position.copyFrom(model.basePosition);
              model.root.position.y += heldOffset;
              model.root.rotation.set(0, model.baseYaw, 0);
            }
          }

          if (model.held) {
            const pulse = 1 + Math.sin(elapsed * 3.4 + index) * 0.045;
            model.heldRing.scaling.set(pulse, pulse, pulse);
          }
        });
      }

      update(initialTurn, { animate: false });

      scene.onBeforeRenderObservable.add(function () {
        const delta = Math.min(40, engine.getDeltaTime());
        elapsed += delta * 0.001;
        if (!reduceMotion) {
          shipRoot.rotation.z = Math.sin(elapsed * 0.48) * 0.008;
          shipRoot.rotation.x = Math.sin(elapsed * 0.31 + 0.8) * 0.004;
          shipRoot.position.y = Math.sin(elapsed * 0.55) * 0.025;
          lantern.flame.scaling.y = 1.45 + Math.sin(elapsed * 8.7) * 0.18;
        }
        lantern.light.intensity =
          2.16 + Math.sin(elapsed * 10.7) * 0.16 + Math.sin(elapsed * 4.1) * 0.08;
        animateDice(delta);
      });

      engine.runRenderLoop(function () {
        if (!document.hidden && !disposed) scene.render();
      });

      const resize = function () {
        if (!disposed) engine.resize();
      };
      global.addEventListener("resize", resize);
      canvas.dataset.babylonActive = "true";
      resize();

      return {
        beginRoll: beginRoll,
        update: update,
        resize: resize,
        dispose: function () {
          if (disposed) return;
          disposed = true;
          global.removeEventListener("resize", resize);
          delete canvas.dataset.babylonActive;
          engine.stopRenderLoop();
          scene.dispose();
          engine.dispose();
        },
      };
    } catch (_error) {
      try {
        if (scene) scene.dispose();
        if (engine) engine.dispose();
      } catch (_disposeError) {
        /* CSS fallback remains available. */
      }
      return null;
    }
  }

  global.GameRoomYahtzeeBabylonScene = {
    mount: mount,
  };
})(window);
