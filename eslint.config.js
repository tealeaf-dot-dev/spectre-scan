import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylisticTs from '@stylistic/eslint-plugin-ts';

export default [
    ...tseslint.config(
        eslint.configs.recommended,
        tseslint.configs.strictTypeChecked,
    ),
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parserOptions: {
                projectService: true,   // enables type-aware linting.
                ecmaVersion: 2023,      // latest ECMAScript syntax support.
                sourceType: 'module',   // use ES modules.
            },
            globals: {
                node: 'readonly',       // Node.js global variables.
                es2023: 'readonly',     // ES2023 globals.
            },
        },
        plugins: {
            '@stylistic/ts': stylisticTs,
        },
        rules: {
            '@stylistic/ts/indent': ['error', 4],
            '@stylistic/ts/semi': ['error', 'always'],
        },
    },
];
