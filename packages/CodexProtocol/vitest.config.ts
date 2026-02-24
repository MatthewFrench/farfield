import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/dist/**",
        "**/Tests/**",
        "**/*.test.ts",
        "**/*.integration.test.ts",
        "vitest.config.ts",
        "scripts/**",
        "Source/generated/**",
        "Source/external/**"
      ],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 60,
        statements: 60
      }
    }
  }
});
