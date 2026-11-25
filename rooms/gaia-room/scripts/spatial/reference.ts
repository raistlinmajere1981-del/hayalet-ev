import {
  fromParent,
  toParent,
  worldPose,
  yaw360,
  type Calibration,
  type Id,
  type Pose,
  type ReferenceLayer,
  type V2,
  type V3,
  type World,
} from "./world.ts";

export function referenceScale({ pixels: [a, b], distanceM }: Calibration): number {
  return distanceM / Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function imagePose(calibration: Calibration): Pose {
  const [a, b] = calibration.pixels;
  const bearing = (Math.atan2(a[1] - b[1], b[0] - a[0]) * 180) / Math.PI;
  return { p: calibration.anchor, yaw: yaw360(yaw360(calibration.bearingDeg) - bearing) };
}

export function pixelInFrame(calibration: Calibration, [u, v]: V2): V3 {
  const [a] = calibration.pixels;
  const scale = referenceScale(calibration);
  return toParent(imagePose(calibration), [(u - a[0]) * scale, (a[1] - v) * scale, 0]);
}

export function referenceFrame(world: World, frame: Id | null): Pose {
  return frame === null ? { p: [0, 0, 0], yaw: 0 } : worldPose(world, frame);
}

export function reframeCalibration(world: World, layer: ReferenceLayer, frame: Id | null) {
  if (!layer.calibration || layer.frame === frame) return layer.calibration;
  const prior = referenceFrame(world, layer.frame);
  const next = referenceFrame(world, frame);
  return {
    ...layer.calibration,
    anchor: fromParent(next, toParent(prior, layer.calibration.anchor)),
    bearingDeg: yaw360(yaw360(layer.calibration.bearingDeg) + prior.yaw - next.yaw),
  };
}

export interface ReferenceProjection {
  origin: V3;
  yaw: number;
  scale: number;
  pixels: V2;
}

export function projectReference(
  world: World,
  layer: ReferenceLayer,
  target: Id | null = null
): ReferenceProjection | undefined {
  const calibration = layer.calibration;
  const pixels = world.assets[layer.asset]?.pixels;
  if (!calibration || !pixels) return undefined;
  const source = referenceFrame(world, layer.frame);
  const destination = referenceFrame(world, target);
  return {
    origin: fromParent(destination, toParent(source, pixelInFrame(calibration, [0, 0]))),
    yaw: yaw360(source.yaw + imagePose(calibration).yaw - destination.yaw),
    scale: referenceScale(calibration),
    pixels,
  };
}

export function referencePoint(view: ReferenceProjection, [u, v]: V2): V3 {
  return toParent({ p: view.origin, yaw: view.yaw }, [u * view.scale, -v * view.scale, 0]);
}
