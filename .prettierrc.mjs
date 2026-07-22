/** @type {import('prettier').Config} */
const config = {
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  importOrder: [
    '^(react/(.*)$)|^(react$)|^(next/(.*)$)|^(next$)',
    '<THIRD_PARTY_MODULES>',
    '^@/types/(.*)$',
    '^@/hooks/(.*)$',
    '^@/utils/(.*)$',
    '^@/lib/(.*)$',
    '^@/server/(.*)$',
    '^@/components/ui/(.*)$',
    '^@/components/forms/(.*)$',
    '^@/components/layout/(.*)$',
    '^@/components/(.*)$',
    '^@/styles/(.*)$',
    '^@/app/(.*)$',
    '^[./]',
  ],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrderTypeScriptVersion: '5.0.0',
};

export default config;