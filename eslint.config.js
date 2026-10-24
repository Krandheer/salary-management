import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * The server's module direction: reference <- employees <- insights, spreadsheet. A module may
 * not import one that sits above it (nor siblings that must stay independent).
 */
const FORBIDDEN_IMPORTS = {
  reference: ['employees', 'insights', 'spreadsheet'],
  employees: ['insights', 'spreadsheet'],
  insights: ['spreadsheet'],
  spreadsheet: ['insights'],
};

function moduleDirectionRules() {
  return Object.entries(FORBIDDEN_IMPORTS).map(([module, forbidden]) => ({
    files: [`server/src/${module}/**/*.ts`],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: forbidden.map((other) => ({
            group: [`**/${other}/**`],
            message: `server/src/${module}/ must not depend on server/src/${other}/ (see docs/architecture.md)`,
          })),
        },
      ],
    },
  }));
}

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'server/drizzle/**', 'web/src/components/ui/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  ...moduleDirectionRules(),
  {
    files: ['web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
