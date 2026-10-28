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
      "component/Share/**/*.{ts,tsx}",
      "component/JoinTest/**/*.{ts,tsx}",
      "component/Tests/{CreateTestActionButton,TestsNameSection,TestList,ExamDetails,StudentExamResults,ShareTestModal,CreateTestForm}.tsx",
      "component/Tests/Create/**/*.{ts,tsx}",
      "component/Tests/exam/**/*.{ts,tsx}",
      "component/Tests/ExamCountdown.tsx",
      "app/test/**/*.{ts,tsx}",
      "app/tests/page.tsx",
      "app/tests/create/**/*.{ts,tsx}",
      "app/tests/[[]id]/**/*.{ts,tsx}",
      "component/grading/**/*.{ts,tsx}",
      "app/grading/**/*.{ts,tsx}",
      "hooks/grading/**/*.{ts,tsx}",
      "utils/grading/**/*.{ts,tsx}",
      "component/Account/**/*.{ts,tsx}",
      "component/Payment/**/*.{ts,tsx}",
      "app/account/**/*.{ts,tsx}",
      "app/billing/**/*.{ts,tsx}",
      "app/payment/**/*.{ts,tsx}",
      "app/auth/**/*.{ts,tsx}",
      "component/Auth/**/*.{ts,tsx}",
      "app/login/**/*.{ts,tsx}",
      "app/signup/**/*.{ts,tsx}",
      "app/forgot-password/**/*.{ts,tsx}",
      "component/Organization/**/*.{ts,tsx}",
      "app/organization/**/*.{ts,tsx}",
      "component/Admin/**/*.{ts,tsx}",
      "app/admin/**/*.{ts,tsx}",
      "app/not-found.tsx",
      // Rich-text editor chrome; the geometry, graph and chemistry boards draw with their own palettes.
      "component/RichTextEditor/{RichTextEditor,RichTextToolbar,RichTextContent}.tsx",
      "component/RichTextEditor/{node-views,modals}/**/*.{ts,tsx}",
    ],
    ignores: [
      "**/*.test.{ts,tsx}",
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
