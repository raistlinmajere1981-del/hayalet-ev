export { expandCodeChunks, findAndReplaceCode } from "./code-operations.js";
export { createChunkedFile, appendChunk } from "./chunked-writer.js";
export { grep, showFile } from "./search.js";
export { expandFolder } from "./folder-operations.js";
export { executeBash } from "./bash-executor.js";
export { trashList, restoreFile, trashEmpty } from "./trash-manager.js";
export { backupFile, undoOperation, operationHistory } from "./history-manager.js";
export { fileDiff, contentDiff } from "./diff-tools.js";
export { createTechnicalPlan } from "./plan-creator.js";

import { EXPAND_CODE_CHUNKS_TOOL, FIND_AND_REPLACE_TOOL } from "./code-operations.js";
import { CREATE_CHUNKED_FILE_TOOL, APPEND_CHUNK_TOOL } from "./chunked-writer.js";
import { GREP_TOOL, SHOW_FILE_TOOL } from "./search.js";
import { EXPAND_FOLDER_TOOL } from "./folder-operations.js";
import { BASH_EXECUTOR_TOOL } from "./bash-executor.js";
import { TRASH_LIST_TOOL, RESTORE_FILE_TOOL, TRASH_EMPTY_TOOL } from "./trash-manager.js";
import {
  BACKUP_FILE_TOOL,
  UNDO_OPERATION_TOOL,
  OPERATION_HISTORY_TOOL,
} from "./history-manager.js";
import { FILE_DIFF_TOOL, CONTENT_DIFF_TOOL } from "./diff-tools.js";
import { CREATE_PLAN_TOOL } from "./plan-creator.js";

export {
  EXPAND_CODE_CHUNKS_TOOL,
  FIND_AND_REPLACE_TOOL,
  CREATE_CHUNKED_FILE_TOOL,
  APPEND_CHUNK_TOOL,
  GREP_TOOL,
  SHOW_FILE_TOOL,
  EXPAND_FOLDER_TOOL,
  BASH_EXECUTOR_TOOL,
  TRASH_LIST_TOOL,
  RESTORE_FILE_TOOL,
  TRASH_EMPTY_TOOL,
  BACKUP_FILE_TOOL,
  UNDO_OPERATION_TOOL,
  OPERATION_HISTORY_TOOL,
  FILE_DIFF_TOOL,
  CONTENT_DIFF_TOOL,
  CREATE_PLAN_TOOL,
};

export const FILESYSTEM_TOOL_DEFINITIONS = [
  EXPAND_CODE_CHUNKS_TOOL,
  FIND_AND_REPLACE_TOOL,
  CREATE_CHUNKED_FILE_TOOL,
  APPEND_CHUNK_TOOL,
  GREP_TOOL,
  SHOW_FILE_TOOL,
  EXPAND_FOLDER_TOOL,
  BASH_EXECUTOR_TOOL,
  TRASH_LIST_TOOL,
  RESTORE_FILE_TOOL,
  TRASH_EMPTY_TOOL,
  BACKUP_FILE_TOOL,
  UNDO_OPERATION_TOOL,
  OPERATION_HISTORY_TOOL,
  FILE_DIFF_TOOL,
  CONTENT_DIFF_TOOL,
  CREATE_PLAN_TOOL,
];
