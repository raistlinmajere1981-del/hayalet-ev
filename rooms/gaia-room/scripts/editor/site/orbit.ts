import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Id } from "../../spatial/world.ts";
import { deviceOffset, frame, type SpatialItem } from "./scene.ts";
import { selectedOrbit } from "../palette.ts";
import { badgeSymbols, type DeviceBadge } from "./device-view.ts";

export function createOrbit(
  host: HTMLElement,
  select: (id: Id | undefined) => void,
  unavailable: () => void
) {
  const canvas = document.createElement("canvas");
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.04, 10000);
  camera.up.set(0, 0, 1);
  camera.position.set(1, -1, 1);
  const controls = new OrbitControls(camera);
  controls.enableDamping = false;
  controls.maxPolarAngle = Math.PI * 0.89;
  const objects = new Group();
  const sun = new DirectionalLight(0xffffff, 2.1);
  sun.position.set(10, -20, 45);
  scene.add(objects, sun, new AmbientLight(0xffffff, 1.6));
  const ray = new Raycaster();
  ray.params.Line = { threshold: 0.16 };
  let request = 0;
  let active = false;
  const meshes = new Map<Id, Group>();
  let items: SpatialItem[] = [];
  let selected: Id | undefined;
  let states: ReadonlyMap<Id, DeviceBadge> = new Map();
  const badges = new Map<Id, { element: HTMLButtonElement; position: Vector3; offset: number }>();
  const badgeLayer = document.createElement("div");
  badgeLayer.className = "orbit-badges";
  badgeLayer.hidden = true;

  function positionBadges() {
    const projection = new Vector3();
    for (const { element, position, offset } of badges.values()) {
      projection.copy(position).project(camera);
      const x = ((projection.x + 1) * host.clientWidth) / 2 + offset;
      const y = ((1 - projection.y) * host.clientHeight) / 2;
      element.hidden =
        projection.z < -1 ||
        projection.z > 1 ||
        x < 0 ||
        y < 0 ||
        x > host.clientWidth ||
        y > host.clientHeight;
      element.style.left = x + "px";
      element.style.top = y + "px";
    }
  }

  function invalidate() {
    if (!active || request) return;
    request = requestAnimationFrame(() => {
      request = 0;
      renderer.render(scene, camera);
      positionBadges();
    });
  }

  function resize() {
    if (!active || !host.clientWidth || !host.clientHeight) return;
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    invalidate();
  }

  function focus(id?: Id) {
    const bounds = frame(items, id);
    const box = new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max));
    const target = box.getCenter(new Vector3());
    const radius = Math.max(2, box.getSize(new Vector3()).length() / 2);
    const distance =
      (radius /
        Math.tan(Math.atan(Math.tan((camera.fov * Math.PI) / 360) * Math.min(camera.aspect, 1)))) *
      1.14;
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(new Vector3(1, -1.24, 1.1).normalize(), distance);
    camera.far = Math.max(10000, distance * 10);
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }

  function clear() {
    objects.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        object.geometry.dispose();
        if (Array.isArray(object.material))
          object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      }
    });
    objects.clear();
    meshes.clear();
    badgeLayer.replaceChildren();
    badges.clear();
  }

  function paintSelection(id?: Id) {
    const item = id ? items.find((entry) => entry.id === id) : undefined;
    if (!item) return;
    const color = new Color(id === selected ? selectedOrbit : item.color);
    meshes.get(item.id)?.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments)
        object.material.color.set(color);
    });
  }

  function paintBadge(id: Id) {
    const badge = badges.get(id);
    const state = states.get(id);
    if (!badge || !state) return;
    const { element } = badge;
    element.dataset["deviceHealth"] = state.health;
    element.setAttribute("aria-pressed", String(id === selected));
    element.title = `${element.dataset["deviceName"]} · ${state.label}`;
    element.setAttribute("aria-label", element.title);
    element.textContent = badgeSymbols[state.health];
  }

  function replace(next: SpatialItem[]) {
    clear();
    items = next;
    for (const item of next) {
      const { id, shape, pose, node, device } = item;
      if (device) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "orbit-badge";
        element.dataset["gaiaDevice"] = id;
        element.dataset["deviceName"] = node.name;
        element.hidden = true;
        element.addEventListener("click", () => select(id));
        badges.set(id, { element, position: new Vector3(...pose.p), offset: deviceOffset(device) });
        badgeLayer.append(element);
        paintBadge(id);
        continue;
      }
      const group = new Group();
      group.userData["gaiaId"] = id;
      meshes.set(id, group);
      objects.add(group);
      if (shape.kind === "area") {
        const ring = new Shape(shape.ring.map(([x, y]) => new Vector2(x, y)));
        const geometry = new ShapeGeometry(ring);
        const surface = new Mesh(
          geometry,
          new MeshBasicMaterial({
            transparent: true,
            opacity: node.kind === "site" ? 0.19 : 0.2,
            depthWrite: false,
          })
        );
        surface.position.z = pose.p[2] - (node.kind === "site" ? 0.025 : 0.01);
        const outline = new LineSegments(
          new EdgesGeometry(geometry),
          new LineBasicMaterial({ transparent: true, opacity: 0.8 })
        );
        outline.position.z = surface.position.z;
        group.add(surface, outline);
      } else if (shape.kind === "path") {
        for (const [a, b] of shape.segments) {
          const start = new Vector3(...a);
          const end = new Vector3(...b);
          const segment = new Mesh(
            new CylinderGeometry(0.11, 0.11, start.distanceTo(end), 8),
            new MeshStandardMaterial()
          );
          segment.position.copy(start).lerp(end, 0.5);
          segment.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), end.sub(start).normalize());
          group.add(segment);
        }
      } else if (shape.kind === "point") {
        const marker = new Mesh(
          new SphereGeometry(node.kind === "mount" ? 0.33 : 0.19, 12, 8),
          new MeshStandardMaterial()
        );
        marker.position.set(...pose.p);
        group.add(marker);
      } else {
        const height = shape.kind === "box" ? shape.size[2] : shape.height;
        const geometry =
          shape.kind === "box"
            ? new BoxGeometry(...shape.size)
            : new CylinderGeometry(shape.radius, shape.radius, shape.height, 24).rotateX(
                Math.PI / 2
              );
        const shell = shape.kind === "box" && shape.shell;
        group.position.set(pose.p[0], pose.p[1], pose.p[2] + height / 2);
        group.rotation.z = (pose.yaw * Math.PI) / 180;
        const edges = new LineSegments(
          new EdgesGeometry(geometry),
          new LineBasicMaterial({ transparent: true, opacity: shell ? 0.65 : 1 })
        );
        group.add(edges);
        if (shell) geometry.dispose();
        else
          group.add(
            new Mesh(
              geometry,
              new MeshStandardMaterial({
                transparent: node.kind === "floor",
                opacity: node.kind === "floor" ? 0.27 : 1,
                depthWrite: node.kind !== "floor",
              })
            )
          );
      }
      paintSelection(id);
    }
    invalidate();
  }

  let down: Vector2 | undefined;
  function pointerDown(event: PointerEvent) {
    down = event.button === 0 ? new Vector2(event.clientX, event.clientY) : undefined;
  }
  function pointerUp(event: PointerEvent) {
    if (!down || down.distanceTo(new Vector2(event.clientX, event.clientY)) > 5) return;
    down = undefined;
    const rect = canvas.getBoundingClientRect();
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    ray.setFromCamera(
      new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((event.clientY - rect.top) / rect.height) * 2
      ),
      camera
    );
    const hits = ray.intersectObjects(objects.children).flatMap(({ object }) => {
      const id: unknown = object.parent?.userData["gaiaId"];
      return typeof id === "string" ? [id] : [];
    });
    // Transparent site and floor surfaces must leave buried contents reachable.
    select(
      hits.find((id) => {
        const node = items.find((item) => item.id === id)?.node;
        return node?.kind === "object" || node?.kind === "route" || node?.kind === "mount";
      }) ?? hits[0]
    );
  }

  canvas.setAttribute("aria-label", host.getAttribute("aria-label") ?? "");
  canvas.hidden = true;
  host.append(canvas, badgeLayer);
  const observer = new ResizeObserver(resize);
  canvas.addEventListener("webglcontextlost", unavailable);

  function setActive(value: boolean) {
    if (value === active) return;
    active = value;
    canvas.hidden = !active;
    badgeLayer.hidden = !active;
    if (active) {
      controls.connect(canvas);
      controls.addEventListener("change", invalidate);
      canvas.addEventListener("pointerdown", pointerDown);
      canvas.addEventListener("pointerup", pointerUp);
      observer.observe(host);
      resize();
    } else {
      cancelAnimationFrame(request);
      request = 0;
      observer.disconnect();
      controls.removeEventListener("change", invalidate);
      controls.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      down = undefined;
    }
  }

  return {
    replace,
    focus,
    setActive,
    update(id: Id | undefined, nextStates: ReadonlyMap<Id, DeviceBadge>) {
      const previous = selected;
      const previousStates = states;
      selected = id;
      states = nextStates;
      if (previous !== id) {
        paintSelection(previous);
        paintSelection(id);
        if (meshes.has(previous ?? "") || meshes.has(id ?? "")) invalidate();
      }
      for (const markerId of badges.keys()) {
        const old = previousStates.get(markerId);
        const next = nextStates.get(markerId);
        if (
          old?.health !== next?.health ||
          old?.label !== next?.label ||
          (previous !== id && (markerId === previous || markerId === id))
        )
          paintBadge(markerId);
      }
    },
    dispose() {
      setActive(false);
      canvas.removeEventListener("webglcontextlost", unavailable);
      clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      badgeLayer.remove();
    },
  };
}
