export {
  readFileContent,
  writeFileContent,
  listDirectory,
  deleteFile,
  moveFile,
} from "./operations.js";

export { editFileContent } from "./edit.js";

import {
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  LIST_DIRECTORY_TOOL,
  DELETE_FILE_TOOL,
  MOVE_FILE_TOOL,
} from "./operations.js";

import { EDIT_FILE_TOOL } from "./edit.js";

export const BASIC_FILE_TOOL_DEFINITIONS = [
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  LIST_DIRECTORY_TOOL,
  DELETE_FILE_TOOL,
  MOVE_FILE_TOOL,
  EDIT_FILE_TOOL,
];

export const BASIC_FILE_TOOL_METADATA = {
  category: "Filesystem",
  emoji: "📁",
  tools: BASIC_FILE_TOOL_DEFINITIONS.map((t) => t.name),
};
