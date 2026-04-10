import { fateKnotsRuntimeWorldAssetsManifest } from "./runtime-assets-world.module.js";
import { fateKnotsRuntimeUiAssetsManifest } from "./runtime-assets-ui.module.js";
export const fateKnotsRuntimeAssetsManifest = {
  version: 1,
  featureId: "fate-knots",
  generatedFrom: "data/asset-import.manifest.json",
  assets: [
    ...fateKnotsRuntimeWorldAssetsManifest.assets,
    ...fateKnotsRuntimeUiAssetsManifest.assets
  ]
};
export default fateKnotsRuntimeAssetsManifest;
