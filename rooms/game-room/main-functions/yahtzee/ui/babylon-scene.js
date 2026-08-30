/* global window, document */

(function (global) {
  "use strict";

  const DEFAULT_DICE = [1, 1, 1, 1, 1];
  const DEFAULT_HELD = [false, false, false, false, false];
  const FALLBACK_STAGE_CONFIG = {
    root: { position: [0, -0.08, 0.12] },
    table: {
      position: [0, 0, 0],
      footprintScale: 1,
      width: 6.86,
      height: 0.34,
      depth: 3.74,
      topY: 0.91,
      insetWidth: 5.28,
      insetHeight: 0.06,
      insetDepth: 3,
      insetX: -0.42,
      insetY: 1.11,
      outerTrimInset: 0.18,
      outerTrimThickness: 0.16,
      outerTrimHeight: 0.12,
      outerTrimY: 1.17,
      innerRailThickness: 0.09,
      innerRailHeight: 0.075,
      innerRailY: 1.165,
      apronWidth: 6.44,
      apronHeight: 0.48,
      apronDepth: 0.2,
      apronY: 0.66,
      apronAccentHeight: 0.055,
      rackBedWidth: 0.68,
      rackBedHeight: 0.055,
      rackBedDepth: 3.18,
      rackDividerWidth: 0.065,
      darkWoodTextureScale: [2.2, 1.2],
      woodTextureScale: [1.8, 1.12],
      feltTextureScale: [1.65, 1.65],
    },
    dice: {
      size: 0.8,
      chamfer: 0.105,
      scale: 0.9,
      heldScale: 0.65,
      baseY: 1.5,
      pipRadius: 0.082,
      pipLift: 0.006,
      pipTessellation: 12,
      layout: [
        [-1.3, -0.66, -0.08],
        [-0.02, -0.77, 0.045],
        [1.27, -0.64, -0.045],
        [-0.66, 0.24, 0.075],
        [0.68, 0.24, -0.065],
      ],
      moveEase: 0.016,
      rollDurationMs: 540,
      rollDurationStepMs: 30,
      rollLateral: 0.13,
      rollLateralStep: 0.012,
      rollLift: 0.5,
      rollLiftStep: 0.016,
      rollDepth: 0.09,
    },
    rack: {
      x: 2.69,
      y: 1.4,
      zSlots: [-1.2, -0.6, 0, 0.6, 1.2],
      yawSlots: [-0.06, -0.03, 0, 0.03, 0.06],
      wellY: 1.17,
      wellRadius: 0.23,
      ringDiameter: 0.58,
      ringThickness: 0.05,
      tessellation: 18,
    },
    lantern: {
      position: [-2.72, 1.12, 1.42],
      scale: 0.68,
      lightIntensity: 1.48,
      lightRange: 7.6,
    },
    lighting: { moonIntensity: 0.9, warmIntensity: 0.56, warmRange: 10.5 },
    performance: {
      hardwareScalingFloor: 1.15,
      pixelRatioDivisor: 1.2,
      rollingFps: 45,
      activeFps: 30,
      idleFps: 15,
    },
  };
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

  const DIE_FACES = [
    {
      name: "top",
      value: 1,
      normal: [0, 1, 0],
      horizontal: [1, 0, 0],
      vertical: [0, 0, 1],
      rotation: [-Math.PI / 2, 0, 0],
    },
    {
      name: "bottom",
      value: 6,
      normal: [0, -1, 0],
      horizontal: [-1, 0, 0],
      vertical: [0, 0, 1],
      rotation: [Math.PI / 2, 0, 0],
    },
    {
      name: "front",
      value: 2,
      normal: [0, 0, -1],
      horizontal: [1, 0, 0],
      vertical: [0, 1, 0],
      rotation: [0, Math.PI, 0],
    },
    {
      name: "back",
      value: 5,
      normal: [0, 0, 1],
      horizontal: [-1, 0, 0],
      vertical: [0, 1, 0],
      rotation: [0, 0, 0],
    },
    {
      name: "right",
      value: 3,
      normal: [1, 0, 0],
      horizontal: [0, 0, -1],
      vertical: [0, 1, 0],
      rotation: [0, Math.PI / 2, 0],
    },
    {
      name: "left",
      value: 4,
      normal: [-1, 0, 0],
      horizontal: [0, 0, 1],
      vertical: [0, 1, 0],
      rotation: [0, -Math.PI / 2, 0],
    },
  ];

  const DIE_VALUE_ROTATIONS = {
    1: [0, 0, 0],
    2: [Math.PI / 2, 0, 0],
    3: [0, 0, Math.PI / 2],
    4: [0, 0, -Math.PI / 2],
    5: [-Math.PI / 2, 0, 0],
    6: [Math.PI, 0, 0],
  };

  function hasRuntime(B) {
    return Boolean(
      B &&
      typeof B.Engine === "function" &&
      typeof B.Scene === "function" &&
      typeof B.CreateBox === "function" &&
      typeof B.CreateCylinder === "function" &&
      typeof B.CreateDisc === "function" &&
      typeof B.CreatePolyhedron === "function" &&
      typeof B.CreateTorus === "function" &&
      typeof B.Mesh === "function" &&
      typeof B.Mesh.MergeMeshes === "function"
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

  function resolveStageConfig(theme) {
    const source =
      theme && theme.stageConfig && typeof theme.stageConfig === "object" ? theme.stageConfig : {};
    const resolved = {};
    Object.keys(FALLBACK_STAGE_CONFIG).forEach(function (section) {
      const candidate = source[section];
      resolved[section] = Object.assign(
        {},
        FALLBACK_STAGE_CONFIG[section],
        candidate && typeof candidate === "object" ? candidate : {}
      );
    });
    return resolved;
  }

  function vector3Values(candidate, fallback) {
    return [0, 1, 2].map(function (index) {
      const value = Array.isArray(candidate) ? Number(candidate[index]) : NaN;
      return Number.isFinite(value) ? value : fallback[index];
    });
  }

  function createChamferedCubeData(chamfer) {
    const half = 0.5;
    const inset = Math.max(0.28, Math.min(0.47, half - (Number(chamfer) || 0.1)));
    const vertices = [];
    const vertexIndexes = new Map();
    const signs = [-1, 1];

    function addVertex(axis, sx, sy, sz) {
      const coordinates = [inset * sx, inset * sy, inset * sz];
      coordinates[axis] = half * [sx, sy, sz][axis];
      const key = coordinates.join(":");
      if (!vertexIndexes.has(key)) {
        vertexIndexes.set(key, vertices.length);
        vertices.push(coordinates);
      }
      return vertexIndexes.get(key);
    }

    signs.forEach(function (sx) {
      signs.forEach(function (sy) {
        signs.forEach(function (sz) {
          addVertex(0, sx, sy, sz);
          addVertex(1, sx, sy, sz);
          addVertex(2, sx, sy, sz);
        });
      });
    });

    function orderedFace(indexes, normal) {
      const center = [0, 0, 0];
      indexes.forEach(function (index) {
        center[0] += vertices[index][0] / indexes.length;
        center[1] += vertices[index][1] / indexes.length;
        center[2] += vertices[index][2] / indexes.length;
      });
      const reference = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const tangent = [
        normal[1] * reference[2] - normal[2] * reference[1],
        normal[2] * reference[0] - normal[0] * reference[2],
        normal[0] * reference[1] - normal[1] * reference[0],
      ];
      const bitangent = [
        normal[1] * tangent[2] - normal[2] * tangent[1],
        normal[2] * tangent[0] - normal[0] * tangent[2],
        normal[0] * tangent[1] - normal[1] * tangent[0],
      ];
      return indexes.slice().sort(function (leftIndex, rightIndex) {
        const left = vertices[leftIndex].map(function (value, axis) {
          return value - center[axis];
        });
        const right = vertices[rightIndex].map(function (value, axis) {
          return value - center[axis];
        });
        const leftAngle = Math.atan2(
          left[0] * bitangent[0] + left[1] * bitangent[1] + left[2] * bitangent[2],
          left[0] * tangent[0] + left[1] * tangent[1] + left[2] * tangent[2]
        );
        const rightAngle = Math.atan2(
          right[0] * bitangent[0] + right[1] * bitangent[1] + right[2] * bitangent[2],
          right[0] * tangent[0] + right[1] * tangent[1] + right[2] * tangent[2]
        );
        return leftAngle - rightAngle;
      });
    }

    const faces = [];
    [0, 1, 2].forEach(function (axis) {
      signs.forEach(function (sign) {
        const indexes = vertices
          .map(function (vertex, index) {
            return Math.abs(vertex[axis] - sign * half) < 0.0001 ? index : -1;
          })
          .filter(function (index) {
            return index >= 0;
          });
        const normal = [0, 0, 0];
        normal[axis] = sign;
        faces.push(orderedFace(indexes, normal));
      });
    });

    [
      [0, 1],
      [0, 2],
      [1, 2],
    ].forEach(function (axes) {
      signs.forEach(function (firstSign) {
        signs.forEach(function (secondSign) {
          const indexes = vertices
            .map(function (vertex, index) {
              const plane = firstSign * vertex[axes[0]] + secondSign * vertex[axes[1]];
              return Math.abs(plane - (half + inset)) < 0.0001 ? index : -1;
            })
            .filter(function (index) {
              return index >= 0;
            });
          const normal = [0, 0, 0];
          normal[axes[0]] = firstSign;
          normal[axes[1]] = secondSign;
          faces.push(orderedFace(indexes, normal));
        });
      });
    });

    signs.forEach(function (sx) {
      signs.forEach(function (sy) {
        signs.forEach(function (sz) {
          const indexes = [
            addVertex(0, sx, sy, sz),
            addVertex(1, sx, sy, sz),
            addVertex(2, sx, sy, sz),
          ];
          faces.push(orderedFace(indexes, [sx, sy, sz]));
        });
      });
    });

    return { vertex: vertices, face: faces };
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

  function createTable(B, scene, root, materials, tableConfig, rackConfig) {
    const tableRoot = new B.TransformNode("yahtzee-table-root", scene);
    const tablePosition = vector3Values(tableConfig.position, [0, 0, 0]);
    const footprintScale = Number(tableConfig.footprintScale) || 1;
    tableRoot.position = new B.Vector3(tablePosition[0], tablePosition[1], tablePosition[2]);
    tableRoot.scaling = new B.Vector3(footprintScale, 1, footprintScale);
    tableRoot.parent = root;

    const top = B.CreateBox(
      "yahtzee-game-table-top",
      {
        width: Number(tableConfig.width),
        height: Number(tableConfig.height),
        depth: Number(tableConfig.depth),
      },
      scene
    );
    top.position = new B.Vector3(0, Number(tableConfig.topY), 0);
    top.material = materials.table;
    makeUnpickable(top, tableRoot);

    const inset = B.CreateBox(
      "yahtzee-game-table-inset",
      {
        width: Number(tableConfig.insetWidth),
        height: Number(tableConfig.insetHeight),
        depth: Number(tableConfig.insetDepth),
      },
      scene
    );
    inset.position = new B.Vector3(Number(tableConfig.insetX), Number(tableConfig.insetY), 0);
    inset.material = materials.tableInset;
    makeUnpickable(inset, tableRoot);

    const outerTrimInset = Number(tableConfig.outerTrimInset);
    const outerTrimThickness = Number(tableConfig.outerTrimThickness);
    const outerTrimWidth = Number(tableConfig.width) - outerTrimInset * 2;
    const outerTrimDepth = Number(tableConfig.depth) - outerTrimInset * 2;
    [
      {
        width: outerTrimWidth,
        depth: outerTrimThickness,
        x: 0,
        z: -(Number(tableConfig.depth) - outerTrimInset) / 2,
      },
      {
        width: outerTrimWidth,
        depth: outerTrimThickness,
        x: 0,
        z: (Number(tableConfig.depth) - outerTrimInset) / 2,
      },
      {
        width: outerTrimThickness,
        depth: outerTrimDepth,
        x: -(Number(tableConfig.width) - outerTrimInset) / 2,
        z: 0,
      },
      {
        width: outerTrimThickness,
        depth: outerTrimDepth,
        x: (Number(tableConfig.width) - outerTrimInset) / 2,
        z: 0,
      },
    ].forEach(function (edge) {
      const trim = B.CreateBox(
        "yahtzee-game-table-trim",
        {
          width: edge.width,
          height: Number(tableConfig.outerTrimHeight),
          depth: edge.depth,
        },
        scene
      );
      trim.position = new B.Vector3(edge.x, Number(tableConfig.outerTrimY), edge.z);
      trim.material = materials.tableTrim;
      makeUnpickable(trim, tableRoot);
    });

    const railThickness = Number(tableConfig.innerRailThickness);
    const railX = Number(tableConfig.insetX);
    const railHalfWidth = Number(tableConfig.insetWidth) / 2 + railThickness / 2;
    const railHalfDepth = Number(tableConfig.insetDepth) / 2 + railThickness / 2;
    [
      {
        width: Number(tableConfig.insetWidth) + railThickness * 2,
        depth: railThickness,
        x: railX,
        z: -railHalfDepth,
      },
      {
        width: Number(tableConfig.insetWidth) + railThickness * 2,
        depth: railThickness,
        x: railX,
        z: railHalfDepth,
      },
      {
        width: railThickness,
        depth: Number(tableConfig.insetDepth),
        x: railX - railHalfWidth,
        z: 0,
      },
      {
        width: railThickness,
        depth: Number(tableConfig.insetDepth),
        x: railX + railHalfWidth,
        z: 0,
      },
    ].forEach(function (edge) {
      const rail = B.CreateBox(
        "yahtzee-game-table-inner-rail",
        {
          width: edge.width,
          height: Number(tableConfig.innerRailHeight),
          depth: edge.depth,
        },
        scene
      );
      rail.position = new B.Vector3(edge.x, Number(tableConfig.innerRailY), edge.z);
      rail.material = materials.tableTrim;
      makeUnpickable(rail, tableRoot);
    });

    const apron = B.CreateBox(
      "yahtzee-game-table-front-apron",
      {
        width: Number(tableConfig.apronWidth),
        height: Number(tableConfig.apronHeight),
        depth: Number(tableConfig.apronDepth),
      },
      scene
    );
    apron.position = new B.Vector3(
      0,
      Number(tableConfig.apronY),
      -Number(tableConfig.depth) / 2 + Number(tableConfig.apronDepth) / 2
    );
    apron.material = materials.darkWood;
    makeUnpickable(apron, tableRoot);

    const apronAccent = B.CreateBox(
      "yahtzee-game-table-apron-accent",
      {
        width: Number(tableConfig.apronWidth) - 0.18,
        height: Number(tableConfig.apronAccentHeight),
        depth: 0.075,
      },
      scene
    );
    apronAccent.position = new B.Vector3(
      0,
      Number(tableConfig.apronY) + Number(tableConfig.apronHeight) * 0.24,
      -Number(tableConfig.depth) / 2 - 0.012
    );
    apronAccent.material = materials.brass;
    makeUnpickable(apronAccent, tableRoot);

    const rackBed = B.CreateBox(
      "yahtzee-game-table-rack-bed",
      {
        width: Number(tableConfig.rackBedWidth),
        height: Number(tableConfig.rackBedHeight),
        depth: Number(tableConfig.rackBedDepth),
      },
      scene
    );
    rackBed.position = new B.Vector3(Number(rackConfig.x), Number(tableConfig.insetY), 0);
    rackBed.material = materials.darkWood;
    makeUnpickable(rackBed, tableRoot);

    const rackDivider = B.CreateBox(
      "yahtzee-game-table-rack-divider",
      {
        width: Number(tableConfig.rackDividerWidth),
        height: Number(tableConfig.innerRailHeight),
        depth: Number(tableConfig.rackBedDepth),
      },
      scene
    );
    rackDivider.position = new B.Vector3(
      Number(rackConfig.x) -
        Number(tableConfig.rackBedWidth) / 2 -
        Number(tableConfig.rackDividerWidth) / 2,
      Number(tableConfig.innerRailY),
      0
    );
    rackDivider.material = materials.brass;
    makeUnpickable(rackDivider, tableRoot);

    const zSlots = Array.isArray(rackConfig.zSlots)
      ? rackConfig.zSlots.slice(0, DEFAULT_DICE.length)
      : FALLBACK_STAGE_CONFIG.rack.zSlots;
    zSlots.forEach(function (z, index) {
      const well = B.CreateCylinder(
        "yahtzee-game-table-hold-well-" + index,
        {
          height: 0.028,
          diameter: Number(rackConfig.wellRadius) * 2,
          tessellation: Number(rackConfig.tessellation),
        },
        scene
      );
      well.position = new B.Vector3(
        Number(rackConfig.x),
        Number(rackConfig.wellY) - 0.014,
        Number(z)
      );
      well.material = materials.well;
      makeUnpickable(well, tableRoot);

      const ring = B.CreateTorus(
        "yahtzee-game-table-hold-ring-" + index,
        {
          diameter: Number(rackConfig.ringDiameter),
          thickness: Number(rackConfig.ringThickness),
          tessellation: Number(rackConfig.tessellation),
        },
        scene
      );
      ring.position = new B.Vector3(
        Number(rackConfig.x),
        Number(rackConfig.wellY) + 0.006,
        Number(z)
      );
      ring.material = materials.brass;
      makeUnpickable(ring, tableRoot);
    });

    return tableRoot;
  }

  function createLantern(B, scene, root, materials, config) {
    const lanternRoot = new B.TransformNode("yahtzee-lantern-root", scene);
    const position = vector3Values(config.position, FALLBACK_STAGE_CONFIG.lantern.position);
    const scale = Number(config.scale) || FALLBACK_STAGE_CONFIG.lantern.scale;
    lanternRoot.position = new B.Vector3(position[0], position[1], position[2]);
    lanternRoot.scaling = new B.Vector3(scale, scale, scale);
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
    light.intensity = Number(config.lightIntensity);
    light.range = Number(config.lightRange);

    return { flame: flame, light: light };
  }

  function pipPositionOnFace(face, position, surface) {
    return [
      face.normal[0] * surface + face.horizontal[0] * position[0] + face.vertical[0] * position[1],
      face.normal[1] * surface + face.horizontal[1] * position[0] + face.vertical[1] * position[1],
      face.normal[2] * surface + face.horizontal[2] * position[0] + face.vertical[2] * position[1],
    ];
  }

  function createDiePipMesh(B, scene, visualRoot, material, index, diceConfig) {
    const sourceMeshes = [];
    const surface = Number(diceConfig.size) / 2 + Number(diceConfig.pipLift);

    DIE_FACES.forEach(function (face) {
      const positions = DIE_PIPS[face.value];
      positions.forEach(function (position, pipIndex) {
        const pip = B.CreateDisc(
          "yahtzee-die-pip-source-" + index + "-" + face.name + "-" + pipIndex,
          {
            radius: Number(diceConfig.pipRadius),
            tessellation: Number(diceConfig.pipTessellation),
          },
          scene
        );
        const facePosition = pipPositionOnFace(face, position, surface);
        pip.position.set(facePosition[0], facePosition[1], facePosition[2]);
        pip.rotation.set(face.rotation[0], face.rotation[1], face.rotation[2]);
        pip.material = material;
        pip.isPickable = false;
        sourceMeshes.push(pip);
      });
    });

    const pipMesh = B.Mesh.MergeMeshes(sourceMeshes, true, true);
    if (!pipMesh) throw new Error("Unable to merge Yahtzee die pips");
    pipMesh.name = "yahtzee-die-pips-" + index;
    pipMesh.material = material;
    return makeUnpickable(pipMesh, visualRoot);
  }

  function createDie(B, scene, root, materials, index, diceConfig, rackConfig, geometry) {
    const layoutSource = Array.isArray(diceConfig.layout)
      ? diceConfig.layout
      : FALLBACK_STAGE_CONFIG.dice.layout;
    const layout = vector3Values(layoutSource[index], [0, 0, 0]);
    const zSlots = Array.isArray(rackConfig.zSlots)
      ? rackConfig.zSlots
      : FALLBACK_STAGE_CONFIG.rack.zSlots;
    const yawSlots = Array.isArray(rackConfig.yawSlots)
      ? rackConfig.yawSlots
      : FALLBACK_STAGE_CONFIG.rack.yawSlots;
    const baseScale = Number(diceConfig.scale);
    const heldScale = Number(diceConfig.heldScale);
    const size = Number(diceConfig.size);
    const dieRoot = new B.TransformNode("yahtzee-die-root-" + index, scene);
    dieRoot.position = new B.Vector3(layout[0], Number(diceConfig.baseY), layout[1]);
    dieRoot.rotation.y = layout[2];
    dieRoot.scaling = new B.Vector3(baseScale, baseScale, baseScale);
    dieRoot.parent = root;

    const visualRoot = new B.TransformNode("yahtzee-die-visual-root-" + index, scene);
    visualRoot.parent = dieRoot;

    const cube = B.CreatePolyhedron(
      "yahtzee-die-mesh-" + index,
      { custom: geometry, size: size, flat: false, sideOrientation: 2 },
      scene
    );
    cube.material = materials.die;
    cube.parent = visualRoot;
    cube.isPickable = true;
    cube.metadata = Object.assign({}, cube.metadata || {}, { yahtzeeDieIndex: index });
    const pipMesh = createDiePipMesh(B, scene, visualRoot, materials.pip, index, diceConfig);

    return {
      root: dieRoot,
      visualRoot: visualRoot,
      cube: cube,
      pipMesh: pipMesh,
      basePosition: new B.Vector3(layout[0], Number(diceConfig.baseY), layout[1]),
      rackPosition: new B.Vector3(
        Number(rackConfig.x),
        Number(rackConfig.y),
        Number(zSlots[index])
      ),
      targetPosition: new B.Vector3(layout[0], Number(diceConfig.baseY), layout[1]),
      baseYaw: layout[2],
      rackYaw: Number(yawSlots[index]) || 0,
      targetYaw: layout[2],
      baseScale: baseScale,
      heldScale: heldScale,
      targetScale: baseScale,
      value: 1,
      held: false,
      roll: null,
    };
  }

  function applyDieValue(model, value) {
    model.value = value;
    const rotation = DIE_VALUE_ROTATIONS[value] || DIE_VALUE_ROTATIONS[1];
    model.visualRoot.rotation.set(rotation[0], rotation[1], rotation[2]);
  }

  function applyHeldState(model, held, materials) {
    model.held = held;
    model.cube.material = held ? materials.dieHeld : materials.die;
    model.targetPosition.copyFrom(held ? model.rackPosition : model.basePosition);
    model.targetScale = held ? model.heldScale : model.baseScale;
    model.targetYaw = held ? model.rackYaw : model.baseYaw;
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
    const theme = global.GameRoomYahtzeePirateDeckTheme || { assets: {}, shots: {} };
    const stageConfig = resolveStageConfig(theme);
    const performanceConfig = stageConfig.performance;

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
      engine.setHardwareScalingLevel(
        Math.max(
          Number(performanceConfig.hardwareScalingFloor),
          pixelRatio / Number(performanceConfig.pixelRatioDivisor)
        )
      );

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
      moonFill.intensity = Number(stageConfig.lighting.moonIntensity);

      const warmFill = new B.PointLight(
        "yahtzee-stage-warm-fill",
        new B.Vector3(-3.5, 3.3, -3.4),
        scene
      );
      warmFill.diffuse = color3(B, [1, 0.46, 0.2]);
      warmFill.specular = color3(B, [1, 0.38, 0.12]);
      warmFill.intensity = Number(stageConfig.lighting.warmIntensity);
      warmFill.range = Number(stageConfig.lighting.warmRange);

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
        tableInset: createMaterial(B, scene, "yahtzee-table-inset", [0.5, 0.13, 0.14], {
          specular: [0.04, 0.015, 0.012],
          ambient: [0.045, 0.009, 0.008],
        }),
        tableTrim: createMaterial(B, scene, "yahtzee-table-trim", [0.42, 0.2, 0.052], {
          specular: [0.38, 0.2, 0.065],
          ambient: [0.1, 0.045, 0.012],
          specularPower: 76,
        }),
        brass: createMaterial(B, scene, "yahtzee-brass", [0.5, 0.3, 0.095], {
          specular: [0.58, 0.36, 0.12],
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
        die: createMaterial(B, scene, "yahtzee-die", [0.92, 0.82, 0.63], {
          specular: [0.24, 0.18, 0.1],
          emissive: [0.018, 0.012, 0.006],
          ambient: [0.08, 0.055, 0.026],
          specularPower: 84,
        }),
        dieHeld: createMaterial(B, scene, "yahtzee-die-held", [0.88, 0.73, 0.47], {
          emissive: [0.035, 0.018, 0.006],
          ambient: [0.075, 0.045, 0.018],
          specular: [0.24, 0.17, 0.08],
          specularPower: 76,
        }),
        pip: createMaterial(B, scene, "yahtzee-pip", [0.045, 0.022, 0.012], {
          specular: [0, 0, 0],
          doubleSided: true,
        }),
      };

      const darkWoodTextureScale = vector3Values(
        stageConfig.table.darkWoodTextureScale,
        [2.4, 1.35, 0]
      );
      const woodTextureScale = vector3Values(stageConfig.table.woodTextureScale, [2.1, 1.25, 0]);
      const feltTextureScale = vector3Values(stageConfig.table.feltTextureScale, [2, 2, 0]);
      applyTexture(
        B,
        scene,
        materials.darkWood,
        themeAssets.tableWood,
        darkWoodTextureScale[0],
        darkWoodTextureScale[1]
      );
      applyTexture(
        B,
        scene,
        materials.table,
        themeAssets.tableWood,
        woodTextureScale[0],
        woodTextureScale[1]
      );
      applyTexture(
        B,
        scene,
        materials.tableInset,
        themeAssets.tableFelt,
        feltTextureScale[0],
        feltTextureScale[1]
      );

      const gameRoot = new B.TransformNode("yahtzee-game-root", scene);
      const rootPosition = vector3Values(
        stageConfig.root.position,
        FALLBACK_STAGE_CONFIG.root.position
      );
      gameRoot.position = new B.Vector3(rootPosition[0], rootPosition[1], rootPosition[2]);
      createTable(B, scene, gameRoot, materials, stageConfig.table, stageConfig.rack);
      const lantern = createLantern(B, scene, gameRoot, materials, stageConfig.lantern);
      const dieGeometry = createChamferedCubeData(stageConfig.dice.chamfer);
      const diceModels = DEFAULT_DICE.map(function (_value, index) {
        return createDie(
          B,
          scene,
          gameRoot,
          materials,
          index,
          stageConfig.dice,
          stageConfig.rack,
          dieGeometry
        );
      });

      const reduceMotion = Boolean(
        global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
      const directorFactory = global.GameRoomYahtzeeCameraDirector;
      const cameraDirector =
        directorFactory && typeof directorFactory.create === "function"
          ? directorFactory.create(camera, B, theme, { reduceMotion: reduceMotion })
          : null;

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
        model.root.scaling.set(model.baseScale, model.baseScale, model.baseScale);
        model.targetScale = model.baseScale;
        model.targetYaw = model.baseYaw;
        model.roll = {
          elapsed: 0,
          duration:
            Number(stageConfig.dice.rollDurationMs) +
            index * Number(stageConfig.dice.rollDurationStepMs),
          turnsX: 2 + (index % 3),
          turnsZ: 2 + ((index + 1) % 3),
          lateral:
            Number(stageConfig.dice.rollLateral) + index * Number(stageConfig.dice.rollLateralStep),
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
        const amount = reduceMotion
          ? 1
          : 1 - Math.exp(-Math.max(1, delta) * Number(stageConfig.dice.moveEase));
        model.root.position.x += (model.targetPosition.x - model.root.position.x) * amount;
        model.root.position.y += (model.targetPosition.y - model.root.position.y) * amount;
        model.root.position.z += (model.targetPosition.z - model.root.position.z) * amount;
        const currentScale = model.root.scaling.x;
        const nextScale = currentScale + (model.targetScale - currentScale) * amount;
        model.root.scaling.set(nextScale, nextScale, nextScale);
        model.root.rotation.x *= 1 - amount;
        model.root.rotation.y += (model.targetYaw - model.root.rotation.y) * amount;
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
            model.basePosition.x +
            Math.sin(progress * Math.PI * 2 + index) * model.roll.lateral * envelope;
          model.root.position.y =
            model.basePosition.y +
            envelope *
              (Number(stageConfig.dice.rollLift) + index * Number(stageConfig.dice.rollLiftStep));
          model.root.position.z =
            model.basePosition.z +
            Math.cos(progress * Math.PI * 2.35 + index) *
              Number(stageConfig.dice.rollDepth) *
              envelope;
          model.root.rotation.x = progress * model.roll.turnsX * Math.PI * 2;
          model.root.rotation.y = model.baseYaw + progress * (index + 2) * Math.PI * 2;
          model.root.rotation.z = progress * model.roll.turnsZ * Math.PI * 2;

          if (progress >= 1) {
            model.roll = null;
            model.root.position.copyFrom(model.targetPosition);
            model.root.rotation.set(0, model.targetYaw, 0);
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
            Number(stageConfig.lantern.lightIntensity) +
            Math.sin(elapsed * 8.7) * 0.055 +
            Math.sin(elapsed * 3.7) * 0.025;
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
        const targetFps = hasRollingDice()
          ? Number(performanceConfig.rollingFps)
          : latestState.active === true
            ? Number(performanceConfig.activeFps)
            : Number(performanceConfig.idleFps);
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
            targetPosition: [
              model.targetPosition.x,
              model.targetPosition.y,
              model.targetPosition.z,
            ],
            scale: model.root.scaling.x,
            targetScale: model.targetScale,
            rotation: [model.root.rotation.x, model.root.rotation.y, model.root.rotation.z],
            visualRotation: [
              model.visualRoot.rotation.x,
              model.visualRoot.rotation.y,
              model.visualRoot.rotation.z,
            ],
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
