/**
 * Basic Filesystem Tools - Export Hub
 *
 * Temel dosya CRUD operasyonları için merkezi export noktası
 *
 * @module fs/basic
 */

// Function exports
export {
  readFileContent,
  writeFileContent,
  listDirectory,
  deleteFile,
  moveFile,
} from "./operations.js";

export { editFileContent } from "./edit.js";

// Tool definition imports
import {
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  LIST_DIRECTORY_TOOL,
  DELETE_FILE_TOOL,
  MOVE_FILE_TOOL,
} from "./operations.js";

import { EDIT_FILE_TOOL } from "./edit.js";

// Combined tool definitions array (for MCP registration)
export const BASIC_FILE_TOOL_DEFINITIONS = [
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  LIST_DIRECTORY_TOOL,
  DELETE_FILE_TOOL,
  MOVE_FILE_TOOL,
  EDIT_FILE_TOOL,
];

// Metadata for tool listing
export const BASIC_FILE_TOOL_METADATA = {
  category: "Filesystem",
  emoji: "📁",
  tools: BASIC_FILE_TOOL_DEFINITIONS.map((t) => t.name),
};
