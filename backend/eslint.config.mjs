// ESLint for the NestJS backend: recommended JavaScript + TypeScript rules.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "uploads/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // A leading underscore marks a value as deliberately unused (e.g. fields stripped by destructuring).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // One tenancy model (P2-01, design §8.1): every class and exam belongs to an organisation
    // (a teacher's own workspace is a SOLO one). Scope by organisation, never by "no organisation".
    files: ["src/classes/**/*.ts", "src/exams/**/*.ts", "src/organizations/**/*.ts", "src/dashboard/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...["Literal[value=/organization_id IS NULL/i]", "TemplateElement[value.raw=/organization_id IS NULL/i]"].map((selector) => ({
          selector,
          message: "Personal data lives in a SOLO organisation now: scope with tenantScoped() or organization_id = :orgId.",
        })),
        {
          selector: "Property[key.name='organization_id'] > CallExpression[callee.name='IsNull']",
          message: "Personal data lives in a SOLO organisation now: scope with tenantScoped() or organization_id = :orgId.",
        },
      ],
    },
  },
);
