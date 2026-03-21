/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|ts|cjs|mjs)$", // dot files
          "(^|/)_[^/]+\\.(js|ts|cjs|mjs)$", // underscore prefixed
          "(^|/)index\\.(js|ts|cjs|mjs)$", // index files
          "(^|/)types\\.", // type definitions
          "\.d\.ts$", // declaration files
          "electron/types/(server|error-patterns)\.ts$", // re-exported via index.ts
          "src/js/modules/webview/providers/shared/scraper-helpers\.ts$", // intentionally not imported (reference copy pattern)
          "src/types/us1-mail\.ts$", // type-only shared contract (depcruise treats as orphan)
          "src/js/pages/entrance/scene/scene-character-role\.ts$", // type-only scene contract imported via `import type`
          "src/js/ui/theme/theme-contract\.ts$", // type-only theme contract imported via `import type`
          "src/js/scene-system/theme-source-contract\.ts$", // scene theme source contract consumed as type-only API
          "src/js/scene-system/scene-theme-registry-contract\.ts$", // scene theme registry contract consumed as type-only API
          "ghost-agent/src/shared/", // shared types for ghost-agent (imported via @shared alias, not resolvable by depcruise)
        ],
      },
      to: {},
    },
    {
      name: "no-deprecated-core",
      comment: "These core modules are deprecated - find an alternative.",
      severity: "warn",
      from: {},
      to: {
        dependencyTypes: ["core"],
        path: [
          "^(punycode|domain|constants|sys|_http_common)$",
          "^url/$", // Node.js 22'de deprecated
        ],
      },
    },
    {
      name: "no-duplicate-dep-types",
      comment: "Warn if a dependency is declared both as devDependency and dependency.",
      severity: "warn",
      from: {},
      to: {
        moreThanOneDependencyType: true,
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "not-to-test",
      comment: "Do not import test files from production code.",
      severity: "error",
      from: {
        pathNot: "\\.(spec|test)\\.(js|ts|cjs|mjs)$",
      },
      to: {
        path: "\\.(spec|test)\\.(js|ts|cjs|mjs)$",
      },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment: "Do not import devDependencies from production code.",
      from: {
        path: "^(src|electron)",
        pathNot: "\\.(spec|test)\\.(js|ts|cjs|mjs)$",
      },
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["type-only"],
        pathNot: [
          "node_modules/@types/",
          "node_modules/typescript/",
          "node_modules/electron/",
          "node_modules/ws/",
          "node_modules/prettier/",
        ],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
    },
  },
};
