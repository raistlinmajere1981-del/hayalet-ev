/**
 * List Tools Handler
 * Returns all tool definitions from all modules
 */

import {
  FILESYSTEM_TOOL_DEFINITIONS,
  SAFE_CHUNK_TOOL_DEFINITIONS,
} from "../tools/index.js";
import { PROVIDER_TOOL_DEFINITIONS } from "../tools/provider-tools.js";
import { webToolDefinitions } from "../tools/web-tools.js";
import { WORKFLOW_TOOL_DEFINITIONS } from "../tools/workflow-tools.js";
import { GIT_TOOL_DEFINITIONS } from "../tools/git-tools.js";
import { CONTEXT_TOOL_DEFINITIONS } from "../tools/context-tools.js";
import { DEV_TOOL_DEFINITIONS } from "../tools/dev-tools.js";
import { TOOL_DEFINITIONS, OVERRIDE_TOOL_DEFINITIONS } from "./tools-registry.js";

export function getAllToolDefinitions() {
  return [
    ...TOOL_DEFINITIONS,
    ...FILESYSTEM_TOOL_DEFINITIONS,
    ...SAFE_CHUNK_TOOL_DEFINITIONS,
    ...DEV_TOOL_DEFINITIONS,
    ...PROVIDER_TOOL_DEFINITIONS,
    ...webToolDefinitions,
    ...WORKFLOW_TOOL_DEFINITIONS,
    ...GIT_TOOL_DEFINITIONS,
    ...CONTEXT_TOOL_DEFINITIONS,
    // IMPORTANT: Override tools MUST be last to override Rovodev built-ins
    ...OVERRIDE_TOOL_DEFINITIONS,
  ];
}
