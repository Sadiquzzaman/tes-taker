import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The component library, and each screen once P1-05 has rebuilt it, use design tokens only
  // (docs/ui/design-system.md §3.5). Add a folder here when its screens move to design/ui.
  {
    files: [
      "design/ui/**/*.{ts,tsx}",
      "component/Dashboard/**/*.{ts,tsx}",
      "component/Classes/**/*.{ts,tsx}",
      "component/JoinClass/**/*.{ts,tsx}",
      "app/classes/**/*.{ts,tsx}",
      "component/Tests/CreateTestActionButton.tsx",
    ],
    ignores: [
      "**/*.test.{ts,tsx}",
      // Rebuilt with the Tests area later in P1-05.
      "component/Classes/TestCard.tsx",
      // No longer used; deletion pending owner approval.
      "component/Classes/StudentBadges.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...["Literal[value=/#[0-9a-fA-F]{3,8}\\b/]", "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]"].map(
          (selector) => ({ selector, message: "Use a colour token (bg-primary, text-ink, …) instead of a hex colour." }),
        ),
        ...["Literal[value=/text-\\[\\d+(px|rem)\\]/]", "TemplateElement[value.raw=/text-\\[\\d+(px|rem)\\]/]"].map(
          (selector) => ({ selector, message: "Use the type scale (text-caption … text-display) instead of a pixel size." }),
        ),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
