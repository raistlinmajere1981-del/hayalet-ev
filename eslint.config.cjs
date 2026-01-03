const js = require("@eslint/js");

module.exports = [
  {
    ignores: ["node_modules", "dist", "build", "*.min.js", "package-lock.json"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
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
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        Element: "readonly",
        Blob: "readonly",
        FormData: "readonly",
        FileReader: "readonly",
        File: "readonly",
        DataTransfer: "readonly",
        AbortController: "readonly",
        URL: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        Option: "readonly",
        BroadcastChannel: "readonly",
      },
    },
    rules: {
      // This project intentionally uses unused placeholders like `_`, `e`, `err` in many callbacks/catches.
      // Ignore these to keep lint output actionable.
      "no-unused-vars": [
        "warn",
        {
          // Ignore any var/arg starting with underscore, and common error placeholders
          argsIgnorePattern: "^(_|e|err|error|evt|event)|^_",
          varsIgnorePattern: "^(_|e|err|error|evt|event)|^_",
          caughtErrorsIgnorePattern: "^(_|e|err|error)|^_", 
        },
      ],
      "no-console": "off",
      "prefer-const": "warn",
      "no-undef": "error",
    },
  },
];
