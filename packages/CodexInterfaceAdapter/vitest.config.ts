import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["Tests/**/*.test.ts", "Tests/**/*.integration.test.ts"],
    exclude: ["**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["Source/**/*.ts"],
      exclude: [
        "**/dist/**",
        "**/Tests/**",
        "**/*.test.ts",
        "**/*.integration.test.ts",
        "vitest.config.ts"
      ],
      thresholds: {
        branches: 55,
        functions: 50,
        lines: 45,
        statements: 45
      }
    }
  }
});
