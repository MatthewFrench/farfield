import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const typescriptSourcePatterns = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.runtime/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "**/*.d.ts",
      "traces/**",
      "public/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: typescriptSourcePatterns,
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-unsafe-function-type": "off",
      "no-control-regex": "off",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/Index", "**/Index.ts", "**/Index.tsx"],
              message: "Import concrete internal modules directly instead of internal Index barrels."
            }
          ]
        }
      ],
      "no-useless-escape": "off"
    }
  },
  {
    files: [
      "apps/WebApplication/Source/**/*.ts",
      "apps/WebApplication/Source/**/*.tsx",
      "apps/WebApplication/Tests/**/*.ts",
      "apps/WebApplication/Tests/**/*.tsx",
      "apps/WebApplication/vite.config.ts"
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      "react-hooks": reactHooks
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off"
    }
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/Tests/**/*.ts", "**/Tests/**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/no-empty-function": "off"
    }
  }
);
