import { readFileSync, existsSync } from "node:fs";
import {
  SHARED_SCENE_SCALE_PATH,
  CSS_VAR_DEFINE_RE,
  CUSTOM_MEDIA_DEFINE_RE,
  CSS_VAR_USE_RE,
  CUSTOM_MEDIA_USE_RE,
  GRADIENT_RE,
  CSS_VAR_DECL_RE,
  SCENE_SCALE_VAR_RE,
} from "./design-audit-config.mjs";
import {
  toProjectPath,
  isTokenOrThemeFile,
  isThemeFile,
  isTokenFile,
  isIntentionalScopedDuplicateVar,
  getLineNumber,
  normalizeCssValue,
  getEnclosingCssSelector,
} from "./design-audit-utils.mjs";

function pushIssue(issues, filePath, line, rule, detail) {
  issues.push({ filePath: toProjectPath(filePath), line, rule, detail });
}

export function collectPatternIssues(issues, filePath, content, regex, rule, detailFactory) {
  regex.lastIndex = 0;
  let match = regex.exec(content);
  while (match !== null) {
    pushIssue(issues, filePath, getLineNumber(content, match.index), rule, detailFactory(match[0], match));
    match = regex.exec(content);
  }
}

export function collectDefinedCssVars(cssFiles) {
  const definedVars = new Set();
  for (const filePath of cssFiles) {
    const content = readFileSync(filePath, "utf8");
    CSS_VAR_DEFINE_RE.lastIndex = 0;
    let match = CSS_VAR_DEFINE_RE.exec(content);
    while (match !== null) {
      definedVars.add(match[2]);
      match = CSS_VAR_DEFINE_RE.exec(content);
    }
  }
  return definedVars;
}

export function collectDefinedCustomMedia(cssFiles) {
  const definedMedia = new Set();
  for (const filePath of cssFiles) {
    const content = readFileSync(filePath, "utf8");
    CUSTOM_MEDIA_DEFINE_RE.lastIndex = 0;
    let match = CUSTOM_MEDIA_DEFINE_RE.exec(content);
    while (match !== null) {
      definedMedia.add(match[1]);
      match = CUSTOM_MEDIA_DEFINE_RE.exec(content);
    }
  }
  return definedMedia;
}

export function collectUndefinedVarIssues(issues, cssFiles, definedVars) {
  for (const filePath of cssFiles) {
    const projectPath = toProjectPath(filePath);
    if (isTokenOrThemeFile(projectPath)) continue;

    const content = readFileSync(filePath, "utf8");
    CSS_VAR_USE_RE.lastIndex = 0;
    let match = CSS_VAR_USE_RE.exec(content);
    while (match !== null) {
      const variableName = match[1];
      if (!definedVars.has(variableName)) {
        pushIssue(issues, filePath, getLineNumber(content, match.index), "undefined-css-var", `Undefined custom property ${variableName}`);
      }
      match = CSS_VAR_USE_RE.exec(content);
    }
  }
}

export function collectUndefinedCustomMediaIssues(issues, cssFiles, definedMedia) {
  for (const filePath of cssFiles) {
    const projectPath = toProjectPath(filePath);
    if (isTokenOrThemeFile(projectPath)) continue;

    const content = readFileSync(filePath, "utf8");
    CUSTOM_MEDIA_USE_RE.lastIndex = 0;
    let match = CUSTOM_MEDIA_USE_RE.exec(content);
    while (match !== null) {
      const mediaName = match[1];
      if (!definedMedia.has(mediaName)) {
        pushIssue(issues, filePath, getLineNumber(content, match.index), "undefined-custom-media", `Undefined custom media token ${mediaName}`);
      }
      match = CUSTOM_MEDIA_USE_RE.exec(content);
    }
  }
}

export function collectDuplicateGradientIssues(issues, cssFiles) {
  const gradients = new Map();

  for (const filePath of cssFiles) {
    const projectPath = toProjectPath(filePath);
    if (isTokenOrThemeFile(projectPath)) continue;

    const content = readFileSync(filePath, "utf8");
    GRADIENT_RE.lastIndex = 0;
    let match = GRADIENT_RE.exec(content);
    while (match !== null) {
      const normalized = normalizeCssValue(match[0]);
      if (!gradients.has(normalized)) {
        gradients.set(normalized, []);
      }
      gradients.get(normalized).push({
        filePath,
        line: getLineNumber(content, match.index),
      });
      match = GRADIENT_RE.exec(content);
    }
  }

  for (const locations of gradients.values()) {
    if (locations.length < 2) continue;
    const [canonical, ...duplicates] = locations.sort((left, right) => {
      const leftPath = toProjectPath(left.filePath);
      const rightPath = toProjectPath(right.filePath);
      if (leftPath === rightPath) return left.line - right.line;
      return leftPath.localeCompare(rightPath);
    });

    for (const duplicate of duplicates) {
      pushIssue(
        issues, duplicate.filePath, duplicate.line,
        "duplicate-gradient",
        `Duplicate gradient also used in ${toProjectPath(canonical.filePath)}:${canonical.line}`
      );
    }
  }
}

export function collectDuplicateVarDefinitionIssues(issues, cssFiles) {
  const definitions = new Map();

  for (const filePath of cssFiles) {
    const content = readFileSync(filePath, "utf8");
    CSS_VAR_DECL_RE.lastIndex = 0;
    let match = CSS_VAR_DECL_RE.exec(content);
    while (match !== null) {
      const projectPath = toProjectPath(filePath);
      const varName = match[2];
      const value = normalizeCssValue(match[3]);
      if (!definitions.has(varName)) {
        definitions.set(varName, []);
      }
      definitions.get(varName).push({
        filePath, projectPath,
        line: getLineNumber(content, match.index),
        selector: getEnclosingCssSelector(content, match.index),
        value,
      });
      match = CSS_VAR_DECL_RE.exec(content);
    }
  }

  for (const [varName, locations] of definitions.entries()) {
    const uniquePaths = new Set(locations.map((l) => l.projectPath));
    if (uniquePaths.size < 2) continue;
    if (locations.every((l) => isThemeFile(l.projectPath))) continue;

    const canonical =
      locations.find((l) => isTokenFile(l.projectPath)) ??
      locations.find((l) => isThemeFile(l.projectPath)) ??
      locations[0];

    for (const duplicate of locations) {
      if (duplicate.projectPath === canonical.projectPath) continue;
      if (isThemeFile(duplicate.projectPath)) continue;
      if (isIntentionalScopedDuplicateVar(varName, duplicate.selector)) continue;
      pushIssue(
        issues, duplicate.filePath, duplicate.line,
        "duplicate-css-var-definition",
        `Duplicate ${varName} also defined in ${canonical.projectPath}:${canonical.line}`
      );
    }
  }
}

export function collectSceneScaleConsumerIssues(issues, cssFiles) {
  if (existsSync(SHARED_SCENE_SCALE_PATH)) return;

  for (const filePath of cssFiles) {
    const projectPath = toProjectPath(filePath);
    if (projectPath === "src/styles/entrance/scene.css" || projectPath.startsWith("src/styles/design-system/tokens/")) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    const usedSceneVars = new Set();
    SCENE_SCALE_VAR_RE.lastIndex = 0;
    let match = SCENE_SCALE_VAR_RE.exec(content);
    let firstLine = 1;
    while (match !== null) {
      usedSceneVars.add(match[1]);
      if (usedSceneVars.size === 1) {
        firstLine = getLineNumber(content, match.index);
      }
      match = SCENE_SCALE_VAR_RE.exec(content);
    }

    if (usedSceneVars.size === 0) continue;

    pushIssue(
      issues, filePath, firstLine,
      "scene-scale-import-order",
      `Uses shared scene scale vars without owning their definition: ${Array.from(usedSceneVars).sort().join(", ")}`
    );
  }
}
