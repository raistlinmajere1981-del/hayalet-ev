import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";
import { createLaboratoryHostActivation } from "../../rooms/laboratory/shared/host/activation.ts";
import { createLaboratoryProjectLifecycleRuntime } from "../../rooms/laboratory/shared/host/project-lifecycle.ts";
import { createMediaExportActionRuntime } from "../../rooms/laboratory/features/media-analysis/host/action-handlers-export.ts";
import { createAudioAnalysisProbeRuntime } from "../../rooms/laboratory/features/audio-analysis/host/analysis-probes.ts";
import { createMediaLocalSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-local.ts";
import { createLaboratoryJobStateRuntime } from "../../rooms/laboratory/shared/host/job-state.ts";
import { createLaboratoryProcessRuntime } from "../../rooms/laboratory/shared/host/process-runtime.ts";
import { syncSourceLabAssetForProject } from "../../rooms/laboratory/shared/host/lab-assets.ts";
import { createLaboratoryReportExportRuntime } from "../../rooms/laboratory/shared/host/reporting-export.ts";
import {
  createLaboratoryHostUtils,
  sanitizeLaboratoryFileSegment,
  toLaboratoryFfmpegTimestamp,
} from "../../rooms/laboratory/shared/host/host-utils.ts";

