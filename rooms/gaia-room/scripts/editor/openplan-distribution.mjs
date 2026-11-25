import ts from "typescript";

const editorLabels =
  /^(canvas\.|canvasActions\.|canvasDisplay\.|canvasHints\.|canvasStatus\.|canvasZoom\.|contextMenu\.|layers\.|layerVisibility\.|moveToFloor\.|backgroundProperties\.distancePrompt$|editorRecovery\.dismiss$)/;

const catalogs = {
  "utils/furnitureCatalog.ts": { furnitureCatalog: "table", importPreviews: [] },
  "utils/entourageCatalog.ts": { entourageCatalog: [] },
  "utils/roomPresets.ts": { roomPresets: [] },
  "utils/roomTemplates.ts": { roomTemplates: [] },
  "i18n/furnitureNames.ts": { portugueseFurnitureNames: {} },
  "i18n/locales/en.ts": { en: editorLabels },
};

function initializerFor(file, value, selection) {
  if (Array.isArray(selection)) return ts.isArrayLiteralExpression(value) && "[]";
  if (typeof selection === "string" && ts.isArrayLiteralExpression(value)) {
    const matches = value.elements.filter(
      (entry) =>
        ts.isObjectLiteralExpression(entry) &&
        entry.properties.some(
          (prop) =>
            ts.isPropertyAssignment(prop) &&
            prop.name.getText(file) === "id" &&
            ts.isStringLiteral(prop.initializer) &&
            prop.initializer.text === selection
        )
    );
    if (matches.length === 1) return "[" + matches[0].getText(file) + "]";
  }
  if (ts.isObjectLiteralExpression(value)) {
    if (!(selection instanceof RegExp)) return "{}";
    const matches = value.properties.filter(
      (prop) =>
        ts.isPropertyAssignment(prop) &&
        ts.isStringLiteral(prop.name) &&
        selection.test(prop.name.text)
    );
    if (matches.length) return "{" + matches.map((prop) => prop.getText(file)).join(",\n") + "}";
  }
  return false;
}

export function openPlanDistribution(upstream) {
  const prefix = upstream.replaceAll("\\", "/").replace(/\/+$/, "") + "/";
  return {
    name: "gaia-openplan3d-distribution",
    enforce: "pre",
    transform(source, id) {
      if (!id.startsWith(prefix)) return;
      const rules = catalogs[id.slice(prefix.length)];
      if (!rules) return;
      const file = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, true);
      const replacements = [];
      for (const statement of file.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          const name = declaration.name.getText(file);
          if (!Object.hasOwn(rules, name) || !declaration.initializer) continue;
          const value = ts.isAsExpression(declaration.initializer)
            ? declaration.initializer.expression
            : declaration.initializer;
          const text = initializerFor(file, value, rules[name]);
          if (!text) this.error("Unexpected OpenPlan3D catalog shape for " + name);
          replacements.push({ node: value, text });
        }
      }
      if (replacements.length !== Object.keys(rules).length)
        this.error("OpenPlan3D distribution inputs changed in " + id);
      // Keep upstream helpers and table dimensions while excluding out-of-profile data.
      for (const { node, text } of replacements.reverse())
        source = source.slice(0, node.getStart(file)) + text + source.slice(node.end);
      return { code: source, map: null };
    },
  };
}
