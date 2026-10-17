import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const EFFECT_HOOKS = "/^use(Layout|Insertion)?Effect$/";
const LAYERS = ["app", "pages", "features", "entities", "shared"];
const NO_USE_EFFECT = "Use derived state, event handlers, or an external store instead (see frontend-no-use-effect).";

export default defineConfig([
  globalIgnores([
    "**/dist",
    "apps/desktop/src-tauri",
    "apps/web/.tanstack",
    "apps/web/src/routeTree.gen.ts",
    ".agents",
    ".claude",
    ".cursor",
  ]),
  {
    files: ["**/*.{ts,tsx,js}"],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["apps/*/**/*.{ts,tsx,js}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `ImportSpecifier[imported.name=${EFFECT_HOOKS}]`, message: NO_USE_EFFECT },
        { selector: `MemberExpression[property.name=${EFFECT_HOOKS}]`, message: NO_USE_EFFECT },
      ],
    },
  },
  {
    files: ["apps/desktop/src/shared/hooks/use-mount-effect.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  ...LAYERS.slice(1).map((layer, i) => ({
    files: [`apps/*/src/${layer}/**`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: LAYERS.slice(0, i + 1).map((upper) => `**/${upper}/**`),
              message: "Import only from lower FSD layers.",
            },
          ],
        },
      ],
    },
  })),
  prettier,
]);
