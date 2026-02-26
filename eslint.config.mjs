import js from "@eslint/js";
import functional from "eslint-plugin-functional";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const typescriptSourcePatterns = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];
const typescriptProjectRootDirectory = new URL(".", import.meta.url).pathname;
const noInternalIndexBarrelImportPattern = {
  group: ["**/Index", "**/Index.ts", "**/Index.tsx"],
  message: "Import concrete internal modules directly instead of internal Index barrels."
};
const webTransportBoundaryImportPattern = {
  group: ["@/Shared/Transport", "@/Shared/Transport/*"],
  message: "Only data-access boundary modules may import shared transport request utilities."
};
const webDataAccessBoundaryImportPatterns = [
  {
    group: ["@/Features/*/DataAccess/*"],
    message: "User-interface modules must consume owner/state APIs instead of feature data-access modules."
  },
  {
    group: ["@/Application/DataAccess/*"],
    message: "User-interface modules must consume owner/state APIs instead of application data-access modules."
  }
];

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
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSUnknownKeyword",
          message: "Do not use unknown. Parse untrusted data at boundaries and use explicit contracts."
        },
        {
          selector: "TSTypeReference[typeName.name='Parameters']",
          message: "Do not use Parameters<>. Declare explicit contract types."
        },
        {
          selector: "TSTypeReference[typeName.name='ReturnType']",
          message: "Do not use ReturnType<>. Declare explicit contract types."
        },
        {
          selector: "TSTypeReference[typeName.name='ConstructorParameters']",
          message: "Do not use ConstructorParameters<>. Declare explicit contract types."
        },
        {
          selector: "TSTypeReference[typeName.name='InstanceType']",
          message: "Do not use InstanceType<>. Declare explicit contract types."
        }
      ],
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
            noInternalIndexBarrelImportPattern
          ]
        }
      ],
      "no-useless-escape": "off"
    }
  },
  {
    files: [
      "apps/ServerApplication/Source/**/*.ts",
      "apps/WebApplication/Source/**/*.ts",
      "apps/WebApplication/Source/**/*.tsx",
      "packages/CodexInterfaceAdapter/Source/**/*.ts",
      "packages/CodexProtocol/Source/**/*.ts",
      "packages/OpenCodeInterfaceAdapter/Source/**/*.ts"
    ],
    ignores: [
      "packages/CodexProtocol/Source/Generated/**/*.ts",
      "packages/CodexProtocol/vendor/**/*.ts"
    ],
    rules: {
      "no-param-reassign": [
        "error",
        {
          props: true
        }
      ]
    }
  },
  {
    files: [
      "apps/ServerApplication/Source/**/*.ts",
      "apps/WebApplication/Source/**/*.ts",
      "apps/WebApplication/Source/**/*.tsx",
      "apps/WebApplication/Tests/**/*.ts",
      "apps/WebApplication/Tests/**/*.tsx",
      "packages/CodexInterfaceAdapter/Source/**/*.ts",
      "packages/CodexProtocol/Source/**/*.ts",
      "packages/OpenCodeInterfaceAdapter/Source/**/*.ts"
    ],
    ignores: ["packages/CodexProtocol/Source/Generated/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: typescriptProjectRootDirectory
      }
    },
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowAny: false,
          allowNullableBoolean: false,
          allowNullableNumber: false,
          allowNullableObject: true,
          allowNullableString: false,
          allowNumber: false,
          allowString: false
        }
      ]
    }
  },
  {
    files: [
      "apps/WebApplication/Source/Application/**/*.ts",
      "apps/WebApplication/Source/Application/**/*.tsx",
      "apps/WebApplication/Source/Features/**/*.ts",
      "apps/WebApplication/Source/Features/**/*.tsx",
      "apps/WebApplication/Source/Components/**/*.ts",
      "apps/WebApplication/Source/Components/**/*.tsx"
    ],
    ignores: [
      "apps/WebApplication/Source/Application/DataAccess/**/*.ts",
      "apps/WebApplication/Source/Application/DataAccess/**/*.tsx",
      "apps/WebApplication/Source/Features/**/DataAccess/**/*.ts",
      "apps/WebApplication/Source/Features/**/DataAccess/**/*.tsx",
      "apps/WebApplication/Source/Shared/Transport/**/*.ts",
      "apps/WebApplication/Source/Shared/Transport/**/*.tsx"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noInternalIndexBarrelImportPattern,
            webTransportBoundaryImportPattern
          ]
        }
      ]
    }
  },
  {
    files: [
      "apps/WebApplication/Source/Application/UserInterface/**/*.ts",
      "apps/WebApplication/Source/Application/UserInterface/**/*.tsx",
      "apps/WebApplication/Source/Features/**/UserInterface/**/*.ts",
      "apps/WebApplication/Source/Features/**/UserInterface/**/*.tsx",
      "apps/WebApplication/Source/Components/**/*.ts",
      "apps/WebApplication/Source/Components/**/*.tsx"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noInternalIndexBarrelImportPattern,
            webTransportBoundaryImportPattern,
            ...webDataAccessBoundaryImportPatterns
          ]
        }
      ]
    }
  },
  {
    files: [
      "apps/WebApplication/Source/Shared/Contracts/**/*.ts",
      "apps/WebApplication/Source/Application/Configuration/**/*.ts",
      "apps/ServerApplication/Source/Application/Configuration/**/*.ts",
      "packages/CodexProtocol/Source/Contracts/**/*.ts"
    ],
    plugins: {
      functional
    },
    rules: {
      "functional/immutable-data": [
        "error",
        {
          ignoreClasses: "fieldsOnly",
          ignoreImmediateMutation: false,
          ignoreMapsAndSets: false,
          ignoreNonConstDeclarations: {
            treatParametersAsConst: true
          },
          ignoreAccessorPattern: ["^this\\."]
        }
      ]
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
