import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

const tsconfigRootDir = import.meta.dirname;

const eslintConfig = defineConfig([
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
    },
  },
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    plugins: {
      sonarjs,
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          minimumDescriptionLength: 10,
          "ts-check": false,
          "ts-expect-error": true,
          "ts-ignore": true,
          "ts-nocheck": true,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports",
          prefer: "type-imports",
        },
      ],
      "sonarjs/cognitive-complexity": ["error", 25],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 700,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,mts}"],
    rules: {
      "max-lines-per-function": [
        "error",
        {
          IIFEs: true,
          max: 220,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    files: ["app/**/*.tsx"],
    rules: {
      "max-lines-per-function": [
        "error",
        {
          IIFEs: true,
          max: 350,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='describe'][callee.property.name='skip']",
          message: "skip된 테스트는 허용되지 않습니다.",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='it'][callee.property.name='skip']",
          message: "skip된 테스트는 허용되지 않습니다.",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='test'][callee.property.name='skip']",
          message: "skip된 테스트는 허용되지 않습니다.",
        },
      ],
    },
  },
  {
    // 관심사 중앙화 강제 규칙
    // - 한글 throw new Error → AppError + error catalog 사용
    // - "/api/..." 하드코딩 → app/lib/api-routes.ts 사용
    // route handler와 api-routes.ts 자체는 제외 (경로를 정의하는 곳).
    files: ["app/**/*.{ts,tsx}"],
    ignores: [
      "**/__tests__/**",
      "**/*.test.{ts,tsx}",
      "app/lib/api-routes.ts",
      "app/api/**",
      "app/server/agent/**",
      "app/i18n/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ThrowStatement > NewExpression[callee.name='Error'] > Literal[value=/[\\uAC00-\\uD7AF]/]",
          message:
            "사용자 대면 한글 에러는 app/lib/app-error.ts의 AppError와 error-catalog.ts를 사용한다.",
        },
        {
          selector: "Literal[value=/^\\/api\\//]",
          message: "API 경로는 app/lib/api-routes.ts의 API_ROUTES 또는 헬퍼 함수를 사용한다.",
        },
        {
          selector: "TemplateElement[value.raw=/^\\/api\\//]",
          message: "API 경로는 app/lib/api-routes.ts의 API_ROUTES 또는 헬퍼 함수를 사용한다.",
        },
      ],
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["**/*.{js,mjs,cjs}"],
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "coverage/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".husky/**",
    ".claude/**",
    "pilot/**",
  ]),
]);

export default eslintConfig;
