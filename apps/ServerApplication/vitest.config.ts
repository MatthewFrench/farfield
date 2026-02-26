import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["Tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/dist/**",
        "**/Tests/**",
        "**/*.test.ts",
        "**/*.integration.test.ts",
        "vitest.config.ts"
      ],
      thresholds: {
        branches: 72,
        functions: 84,
        lines: 46,
        statements: 46
      }
    }
  }
});
