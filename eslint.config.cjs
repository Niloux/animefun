// eslint.config.cjs
const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const tsEslint = require("@typescript-eslint/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const jsxA11y = require("eslint-plugin-jsx-a11y");

// 浏览器全局变量
const browserGlobals = {
  window: "readonly",
  document: "readonly",
  HTMLElement: "readonly",
  HTMLInputElement: "readonly",
  navigator: "readonly",
  localStorage: "readonly",
  console: "readonly",
  fetch: "readonly",
  React: "readonly",
  KeyboardEvent: "readonly",
  HTMLButtonElement: "readonly",
  HTMLDivElement: "readonly",
};

// Node 全局变量
const nodeGlobals = {
  process: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  global: "readonly",
  module: "readonly",
  require: "readonly",
};

module.exports = [
  // 基础 JS 推荐规则
  js.configs.recommended,

  // ===================== 前端 React/TS =====================
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: browserGlobals,
    },
    plugins: {
      "@typescript-eslint": tsEslint,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...tsEslint.configs?.recommended?.rules,
      ...reactPlugin.configs?.recommended?.rules,
      ...jsxA11y.configs?.recommended?.rules,
      ...reactHooksPlugin.configs?.recommended?.rules,

      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "react/prop-types": "off",
    },
    settings: { react: { version: "detect" } },
  },

  // ===================== Node 配置文件 =====================
  {
    files: ["vite.config.ts", "scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: nodeGlobals,
    },
    plugins: {
      "@typescript-eslint": tsEslint,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // ===================== 忽略文件 =====================
  {
    ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**", "src/components/ui/**"],
  },
];