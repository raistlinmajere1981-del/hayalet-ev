/**
 * AST-based Code Transformation using jscodeshift
 *
 * Safe refactoring that preserves formatting and prevents syntax errors
 * Uses Facebook's battle-tested codemod tool (used in React, Next.js, Angular)
 *
 * @module ast-transformer
 */

import * as jscodeshiftNamespace from "jscodeshift";
import type { API, FileInfo, Options, Transform, ASTNode } from "jscodeshift";

const jscodeshift = jscodeshiftNamespace.default;
import { logToolError } from "./mcp-logger.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getProgramBody(value: unknown): ASTNode[] {
  return Array.isArray(value) ? (value as ASTNode[]) : [];
}

function getIdentifierName(node: unknown): string | null {
  if (!isRecord(node)) return null;
  const name = node["name"];
  return typeof name === "string" ? name : null;
}

export interface TransformResult {
  success: boolean;
  code?: string;
  error?: string;
  modified: boolean;
}

/**
 * Apply a jscodeshift transform to code
 *
 * @param code - Source code to transform
 * @param filePath - File path (for context)
 * @param transform - jscodeshift transform function
 * @returns Transform result with modified code
 */
export function applyTransform(
  code: string,
  filePath: string,
  transform: Transform
): TransformResult {
  try {
    const fileInfo: FileInfo = {
      path: filePath,
      source: code,
    };

    const api: API = {
      jscodeshift: jscodeshift.withParser("tsx"),
      j: jscodeshift.withParser("tsx"),
      stats: () => {},
      report: () => {},
    };

    const options: Options = {};

    const result = transform(fileInfo, api, options);

    if (result === undefined || result === null) {
      // No changes
      return {
        success: true,
        code: code,
        modified: false,
      };
    }

    return {
      success: true,
      code: typeof result === "string" ? result : code,
      modified: result !== code,
    };
  } catch (error) {
    logToolError("applyTransform", error as Error, { filePath });
    return {
      success: false,
      error: (error as Error).message,
      modified: false,
    };
  }
}

/**
 * Find and replace function/method calls
 *
 * @example
 * replaceFunctionCalls(code, 'test.js', 'oldFunc', 'newFunc')
 * // Changes: oldFunc(a, b) → newFunc(a, b)
 */
export function replaceFunctionCalls(
  code: string,
  filePath: string,
  oldName: string,
  newName: string
): TransformResult {
  const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    let modified = false;

    // Replace direct function calls
    root
      .find(j.CallExpression, {
        callee: { type: "Identifier", name: oldName },
      })
      .forEach((path) => {
        if (path.node.callee.type === "Identifier") {
          path.node.callee.name = newName;
          modified = true;
        }
      });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return modified ? root.toSource() : null;
  };

  return applyTransform(code, filePath, transform);
}

/**
 * Rename variables (within optional scope)
 *
 * @param scopeFilter - Optional: limit to specific function/class
 * @example
 * renameVariable(code, 'test.js', 'oldVar', 'newVar', { type: 'function', name: 'myFunc' })
 */
export function renameVariable(
  code: string,
  filePath: string,
  oldName: string,
  newName: string,
  scopeFilter?: { type: string; name: string }
): TransformResult {
  const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    let modified = false;
    let collection = root;

    // If scope filter provided, narrow down to specific scope
    if (scopeFilter) {
      if (scopeFilter.type === "function") {
        collection = root.find(j.FunctionDeclaration, {
          id: { name: scopeFilter.name },
        });
      } else if (scopeFilter.type === "class") {
        collection = root.find(j.ClassDeclaration, {
          id: { name: scopeFilter.name },
        });
      }
    }

    // Rename all identifiers
    collection.find(j.Identifier, { name: oldName }).forEach((path) => {
      path.node.name = newName;
      modified = true;
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return modified ? root.toSource() : null;
  };

  return applyTransform(code, filePath, transform);
}

/**
 * Replace import source
 *
 * @example
 * replaceImportSource(code, 'test.js', './old-path', './new-path')
 * // Changes: import { foo } from './old-path' → import { foo } from './new-path'
 */
export function replaceImportSource(
  code: string,
  filePath: string,
  oldSource: string,
  newSource: string
): TransformResult {
  const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    let modified = false;

    root
      .find(j.ImportDeclaration, {
        source: { value: oldSource },
      })
      .forEach((path) => {
        path.node.source.value = newSource;
        modified = true;
      });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return modified ? root.toSource() : null;
  };

  return applyTransform(code, filePath, transform);
}

/**
 * Add import statement (if not already present)
 *
 * @example
 * addImport(code, 'test.js', ['useState', 'useEffect'], 'react')
 * // Adds: import { useState, useEffect } from 'react';
 */
export function addImport(
  code: string,
  filePath: string,
  imports: string[],
  source: string
): TransformResult {
  const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    const existingImport = root.find(j.ImportDeclaration, {
      source: { value: source },
    });

    if (existingImport.length > 0) {
      return null;
    }

    const importDeclaration = j.importDeclaration(
      imports.map((name) => j.importSpecifier(j.identifier(name))),
      j.literal(source)
    );

    // Keep new imports grouped with the existing import block.
    const programPath = root.find(j.Program).paths()[0];
    if (!programPath) return null;
    const bodyNodes = getProgramBody(programPath.node.body);
    const firstNonImportIndex = bodyNodes.findIndex(
      (node: ASTNode) => node.type !== "ImportDeclaration"
    );

    if (firstNonImportIndex === -1) {
      bodyNodes.push(importDeclaration as unknown as ASTNode);
    } else {
      bodyNodes.splice(firstNonImportIndex, 0, importDeclaration as unknown as ASTNode);
    }

    programPath.node.body = bodyNodes as unknown as typeof programPath.node.body;

    return root.toSource();
  };

  return applyTransform(code, filePath, transform);
}

/**
 * Remove unused imports
 *
 * @example
 * removeUnusedImports(code, 'test.js')
 * // Removes imports that are not used in the code
 */
export function removeUnusedImports(code: string, filePath: string): TransformResult {
  const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    let modified = false;

    root.find(j.ImportDeclaration).forEach((path) => {
      const specifiers = path.node.specifiers;
      if (!specifiers || specifiers.length === 0) return;

      const unusedSpecifiers: number[] = [];

      specifiers.forEach((specifier, index) => {
        if (specifier.type === "ImportSpecifier" && specifier.local) {
          const localName = specifier.local.name;

          // Exclude the import specifier itself when checking for live references.
          const usages = root.find(j.Identifier).filter((p) => {
            const identifierName = getIdentifierName(p.value);
            const parentValue = isRecord(p.parent) ? p.parent["value"] : undefined;
            return identifierName === localName && parentValue !== specifier;
          }); // Exclude the import itself

          if (usages.length === 0) {
            unusedSpecifiers.push(index);
          }
        }
      });

      if (unusedSpecifiers.length > 0) {
        unusedSpecifiers.reverse().forEach((index) => {
          specifiers.splice(index, 1);
        });
        modified = true;

        if (specifiers.length === 0) {
          j(path).remove();
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return modified ? root.toSource() : null;
  };

  return applyTransform(code, filePath, transform);
}

/**
 * Custom transformation using jscodeshift API
 *
 * @param transformFn - Custom function that receives jscodeshift API
 * @example
 * customTransform(code, 'test.js', (j, root) => {
 *   root.find(j.CallExpression).forEach(path => {
 *     // Custom logic
 *   });
 * })
 */
export function customTransform(
  code: string,
  filePath: string,
  transformFn: (j: typeof jscodeshift, root: ReturnType<typeof jscodeshift>) => void
): TransformResult {
  const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    transformFn(j, root);
    return root.toSource();
  };

  return applyTransform(code, filePath, transform);
}

/**
 * Batch transform multiple operations
 *
 * @example
 * batchTransform(code, 'test.js', [
 *   { type: 'function_call', oldName: 'oldFunc', newName: 'newFunc' },
 *   { type: 'import', oldSource: './old', newSource: './new' }
 * ])
 */
export function batchTransform(
  code: string,
  filePath: string,
  operations: Array<{
    type: "function_call" | "variable" | "import";
    oldName?: string;
    newName?: string;
    oldSource?: string;
    newSource?: string;
  }>
): TransformResult {
  let currentCode = code;
  let totalModified = false;

  for (const op of operations) {
    let result: TransformResult;

    switch (op.type) {
      case "function_call":
        if (op.oldName == null || op.oldName === "" || op.newName == null || op.newName === "") {
          return { success: false, error: "oldName and newName required", modified: false };
        }
        result = replaceFunctionCalls(currentCode, filePath, op.oldName, op.newName);
        break;

      case "variable":
        if (op.oldName == null || op.oldName === "" || op.newName == null || op.newName === "") {
          return { success: false, error: "oldName and newName required", modified: false };
        }
        result = renameVariable(currentCode, filePath, op.oldName, op.newName);
        break;

      case "import":
        if (
          op.oldSource == null ||
          op.oldSource === "" ||
          op.newSource == null ||
          op.newSource === ""
        ) {
          return { success: false, error: "oldSource and newSource required", modified: false };
        }
        result = replaceImportSource(currentCode, filePath, op.oldSource, op.newSource);
        break;

      default:
        return {
          success: false,
          error: `Unknown operation type: ${(op as { type: string }).type}`,
          modified: false,
        };
    }

    if (!result.success) {
      return result;
    }

    if (result.modified && result.code != null && result.code !== "") {
      currentCode = result.code;
      totalModified = true;
    }
  }

  return {
    success: true,
    code: currentCode,
    modified: totalModified,
  };
}
