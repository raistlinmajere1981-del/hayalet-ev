const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  // === Global Ignores ===
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dist-electron/**",
      "build/**",
      "*.min.js",
      "package-lock.json",
      ".rovo/scripts/**",
      "mcp-server/**",
    ],
  },

  // === Base JS Config ===
  js.configs.recommended,

  // === TypeScript Config (Renderer - src/js) ===
  {
    files: ["src/js/**/*.{js,ts}"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        // Browser globals
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        btoa: "readonly",
        atob: "readonly",
        FileReader: "readonly",
        Blob: "readonly",
        File: "readonly",
        FormData: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        EventTarget: "readonly",
        HTMLElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        NodeList: "readonly",
        DOMParser: "readonly",
        XMLSerializer: "readonly",
        Image: "readonly",
        Audio: "readonly",
        MediaRecorder: "readonly",
        AudioContext: "readonly",
        WebSocket: "readonly",
        AbortController: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        Option: "readonly",
        BroadcastChannel: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        requestIdleCallback: "readonly",
        cancelIdleCallback: "readonly",
        getComputedStyle: "readonly",
        performance: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
      },
    },
    rules: {
      // === TypeScript Specific (Step 1: Ease Strictness) ===
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^(_|e|err|error|evt|event)",
          varsIgnorePattern: "^(_|e|err|error|evt|event)",
          caughtErrorsIgnorePattern: "^(_|e|err|error)",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "off",       // AI-friendly: TypeScript strict mode yeterli
      "@typescript-eslint/no-unsafe-member-access": "off",    // AI-friendly: TypeScript strict mode yeterli
      "@typescript-eslint/no-unsafe-call": "off",             // AI-friendly: TypeScript strict mode yeterli
      "@typescript-eslint/no-unsafe-return": "off",           // AI-friendly: TypeScript strict mode yeterli
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "off",  // AI-friendly: || vs ?? pragmatik kullanım
      "@typescript-eslint/prefer-optional-chain": "off",      // AI-friendly: benzer noise azaltımı
      "@typescript-eslint/strict-boolean-expressions": "off", // Too strict for this project
      
      // === General Rules ===
      "no-unused-vars": "off", // TypeScript versiyonu kullanılıyor
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off",
      "prefer-const": "warn",
      "no-undef": "off", // TypeScript bunu hallediyor
    },
  },

  // === Electron Main Process Config (ESM) ===
  {
    files: ["electron/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node.js globals
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        global: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        crypto: "readonly",
        performance: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^(_|e|err|error|evt|event)",
          varsIgnorePattern: "^(_|e|err|error|evt|event)",
          caughtErrorsIgnorePattern: "^(_|e|err|error)",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off",
      "prefer-const": "warn",
      "no-undef": "error",
    },
  },

  // === Electron Preload (renderer context with Node access) ===
  {
    files: ["electron/preload.cjs", "electron/webview-preload.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        // Node.js
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        // Browser (preload runs in renderer)
        window: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        navigator: "readonly",
        location: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        HTMLElement: "readonly",
        MutationObserver: "readonly",
        performance: "readonly",
        crypto: "readonly",
        atob: "readonly",
        btoa: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^(_|e|err|error|evt|event)",
          varsIgnorePattern: "^(_|e|err|error|evt|event)",
          caughtErrorsIgnorePattern: "^(_|e|err|error)",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off",
      "prefer-const": "warn",
      "no-undef": "error",
    },
  },

  // === Webview Preload (browser context) ===
  {
    files: ["electron/webview-preload.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        // Node/Electron
        console: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        // Browser (webview context)
        window: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        MutationObserver: "readonly",
        navigator: "readonly",
        location: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        XMLHttpRequest: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        HTMLElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        NodeList: "readonly",
        getComputedStyle: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        crypto: "readonly",
        performance: "readonly",
        atob: "readonly",
        btoa: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        DataTransfer: "readonly",
        DragEvent: "readonly",
        ClipboardEvent: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        InputEvent: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^(_|e|err|error|evt|event)",
          varsIgnorePattern: "^(_|e|err|error|evt|event)",
          caughtErrorsIgnorePattern: "^(_|e|err|error)",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off",
      "prefer-const": "warn",
      "no-undef": "error",
    },
  },

  // === Electron TypeScript Files ===
  {
    files: ["electron/**/*.ts"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        project: "./tsconfig.electron.json",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        fetch: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^(_|e|err|error|evt|event)",
          varsIgnorePattern: "^(_|e|err|error|evt|event)",
          caughtErrorsIgnorePattern: "^(_|e|err|error)",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off",
      "prefer-const": "warn",
    },
  },

  // === MCP Server TypeScript Files ===
  {
    files: ["mcp-server/**/*.ts"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        project: "./mcp-server/tsconfig.json",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^(_|e|err|error|evt|event)",
          varsIgnorePattern: "^(_|e|err|error|evt|event)",
          caughtErrorsIgnorePattern: "^(_|e|err|error)",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off",
      "prefer-const": "warn",
    },
  }
);
