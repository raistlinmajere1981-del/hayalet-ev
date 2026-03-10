import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { logToolError } from "../../utils/mcp-logger.js";

interface ToolRegistrationOptions {
  tool_name: string;
  description: string;
  function_name: string;
  tool_constant: string;
  auto_add_to?: string[];
  test_immediately?: boolean;
  auto_build_restart?: boolean;
  dry_run?: boolean;
}

interface ToolRegistrationResult {
  success: boolean;
  output: string;
  modified_files: string[];
}

function registerToolT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.toolRegistration.${key}`, params);
}

function registerToolDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.toolRegistration.definition.${key}`, params);
}

export function registerNewTool(
  options: ToolRegistrationOptions,
  projectRoot: string
): ToolRegistrationResult {
  const {
    tool_name: toolName,
    description,
    function_name: functionName,
    tool_constant: toolConstant,
    auto_add_to: autoAddTo = ["handlers", "registry", "index"],
    test_immediately: testImmediately = false,
    auto_build_restart: autoBuildRestart = true,
    dry_run: dryRun = true,
  } = options;

  const modifiedFiles: string[] = [];

  try {
    const root = projectRoot;

    if (autoAddTo.includes("index")) {
      const indexPath = join(root, "src", "mcp-server", "tools", "dev", "index.ts");
      const success = addToDevIndex(indexPath, functionName, toolConstant, dryRun);
      if (success) modifiedFiles.push("dev/index.ts");
    }

    if (autoAddTo.includes("handlers")) {
      const handlersPath = join(root, "src", "mcp-server", "core", "handlers", "dev-handlers.ts");
      const success = addToHandlers(handlersPath, toolName, functionName, dryRun);
      if (success) modifiedFiles.push("core/handlers/dev-handlers.ts");
    }

    if (autoAddTo.includes("registry")) {
      const registryPath = join(root, "src", "mcp-server", "core", "handlers", "dev-handlers.ts");
      const success = addToRegistry(registryPath, toolName, description, dryRun);
      if (success && !modifiedFiles.includes("core/handlers/dev-handlers.ts")) {
        modifiedFiles.push("core/handlers/dev-handlers.ts");
      }
    }

    if (!dryRun && modifiedFiles.length > 0 && autoBuildRestart) {
      execSync("npm run mcp:build", { cwd: root, stdio: "pipe" });
      setTimeout(() => {
        process.stderr.write("[hev_dev_register_tool] MCP restart requested after mcp:build\n");
        process.exit(0);
      }, 1200);
    }

    return {
      success: modifiedFiles.length > 0,
      output: formatOutput(toolName, modifiedFiles, dryRun, testImmediately, autoBuildRestart),
      modified_files: modifiedFiles,
    };
  } catch (error) {
    logToolError("tool-registration-helper", error as Error, {});
    return {
      success: false,
      output: registerToolT("runtime.error", { message: String(error) }),
      modified_files: [],
    };
  }
}

function addToDevIndex(
  filePath: string,
  functionName: string,
  toolConstant: string,
  dryRun: boolean
): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");

    const exportLine = `export { ${functionName}, ${toolConstant} } from "./${functionName}.js";`;
    const importLine = `import { ${toolConstant} } from "./${functionName}.js";`;

    const lines = content.split("\\n");
    let exportInsertAt = -1;
    let importInsertAt = -1;
    let arrayInsertAt = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.includes("// Function exports") === true && exportInsertAt === -1) {
        exportInsertAt = i + 1;
      }
      if (lines[i]?.includes("// Import tool definitions") === true && importInsertAt === -1) {
        importInsertAt = i + 1;
      }
      if (lines[i]?.includes("export const DEV_TOOL_DEFINITIONS = [") === true) {
        arrayInsertAt = i + 1;
      }
    }

    if (exportInsertAt !== -1) lines.splice(exportInsertAt, 0, exportLine);
    if (importInsertAt !== -1) lines.splice(importInsertAt + 1, 0, importLine);
    if (arrayInsertAt !== -1) lines.splice(arrayInsertAt, 0, `  ${toolConstant},`);

    if (!dryRun) {
      writeFileSync(filePath, lines.join("\\n"), "utf-8");
    }

    return true;
  } catch {
    return false;
  }
}

function addToHandlers(
  filePath: string,
  toolName: string,
  functionName: string,
  dryRun: boolean
): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\\n");

    let insertAt = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i]?.includes('if (name === "hev_dev_') === true) {
        for (let j = i; j < lines.length; j++) {
          if (lines[j]?.trim() === "}") {
            insertAt = j + 1;
            break;
          }
        }
        break;
      }
    }

    if (insertAt !== -1) {
      const handlerCode = `    if (name === "${toolName}") {
      const result = await ${functionName}(args as Record<string, unknown>, PROJECT_ROOT);
      return { content: [{ type: "text", text: result.output }] };
    }`;
      lines.splice(insertAt, 0, handlerCode);

      if (!dryRun) {
        writeFileSync(filePath, lines.join("\\n"), "utf-8");
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function addToRegistry(
  filePath: string,
  toolName: string,
  description: string,
  dryRun: boolean
): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\\n");

    let insertAt = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i]?.includes("export const TOOL_DEFINITIONS = [") === true) {
        insertAt = i;
        break;
      }
    }

    if (insertAt !== -1) {
      const toolDef = `  {
    name: "${toolName}",
    description: "${description}",
    inputSchema: { type: "object", properties: {} }
  },`;
      lines.splice(insertAt, 0, toolDef);

      if (!dryRun) {
        writeFileSync(filePath, lines.join("\\n"), "utf-8");
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function formatOutput(
  toolName: string,
  modifiedFiles: string[],
  dryRun: boolean,
  testImmediately: boolean,
  autoBuildRestart: boolean
): string {
  let output = `${registerToolT("runtime.title")}\\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`;
  output += `${registerToolT("runtime.tool", { toolName })}\\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n`;

  output += `${registerToolT("runtime.modifiedFiles")}\\n`;
  modifiedFiles.forEach((file) => {
    output += `  ✅ ${file}\\n`;
  });

  if (dryRun) {
    output += `\\n${registerToolT("runtime.dryRun")}\\n`;
  } else {
    output += `\\n${registerToolT("runtime.success")}\\n`;
    if (autoBuildRestart) {
      output += `\\n${registerToolT("runtime.autoBuildRestart")}\\n`;
    } else {
      output += `\\n${registerToolT("runtime.nextStepsTitle")}\\n`;
      output += `   1. ${registerToolT("runtime.nextSteps.build")}\\n`;
      output += `   2. ${registerToolT("runtime.nextSteps.restart")}\\n`;
    }
    if (testImmediately) {
      output += `   ${autoBuildRestart ? "1" : "3"}. ${registerToolT("runtime.testWith", { toolName })}\\n`;
    }
  }

  return output;
}

export const TOOL_REGISTRATION_HELPER_TOOL = {
  name: "hev_dev_register_tool",
  description: registerToolDefT("description"),
  inputSchema: {
    type: "object",
    properties: {
      tool_name: {
        type: "string",
        description: registerToolDefT("toolName"),
      },
      description: {
        type: "string",
        description: registerToolDefT("toolDescription"),
      },
      function_name: {
        type: "string",
        description: registerToolDefT("functionName"),
      },
      tool_constant: {
        type: "string",
        description: registerToolDefT("toolConstant"),
      },
      auto_add_to: {
        type: "array",
        items: { type: "string", enum: ["handlers", "registry", "index"] },
        description: registerToolDefT("autoAddTo"),
        default: ["handlers", "registry", "index"],
      },
      test_immediately: {
        type: "boolean",
        description: registerToolDefT("testImmediately"),
        default: false,
      },
      auto_build_restart: {
        type: "boolean",
        description: registerToolDefT("autoBuildRestart"),
        default: true,
      },
      dry_run: {
        type: "boolean",
        description: registerToolDefT("dryRun"),
        default: true,
      },
    },
    required: ["tool_name", "description", "function_name", "tool_constant"],
  },
  metadata: {
    category: "development",
    subcategory: "tool-management",
    priority: "high",
    complexity: "complex",
    useCases: [
      registerToolDefT("useCases.registerTool"),
      registerToolDefT("useCases.autoAdd"),
      registerToolDefT("useCases.streamlineWorkflow"),
    ],
    relatedTools: ["hev_dev_analyze_project", "hev_fs_show"],
    agentGuidance: registerToolDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["tool", "registration", "automation", "boilerplate"],
  },
};
