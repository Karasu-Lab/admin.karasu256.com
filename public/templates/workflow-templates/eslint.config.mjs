import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.next/**",
            "**/.turbo/**",
            "**/coverage/**",
            "**/*.d.ts",
        ],
    },
    {
        files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
        languageOptions: {
            parser: tseslint.parser,
        },
        plugins: {
            "@typescript-eslint": tseslint.plugin,
            "@next/next": nextPlugin,
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "warn",
        },
    },
];
