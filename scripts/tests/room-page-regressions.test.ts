import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  canUseDirectFileUrls,
  toRoomRuntimeFileUrl,
} from "../../src/js/modules/rooms/room-runtime-url.ts";
import { readCssWithImports } from "./helpers/css-imports.ts";

type LaboratoryManifestFeature = {
  id?: string;
  name?: string;
  scene?: {
    hotspot?: { id?: string };
    view?: {
      id?: string;
      backgroundSrc?: string;
    };
  };
};
