import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['**/build/**', '**/public/app.js', '**/public/app.css', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },
  {
    // フロントエンドは innerHTML を禁止する。
    // JSX は自動エスケープされるが、DOM を直接触る箇所（マーカー生成など）で穴が開くため
    // lint で塞いでおく。挿入は textContent を使うこと。
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: '*', property: 'innerHTML', message: 'innerHTML は使わず textContent を使ってください' },
        { object: '*', property: 'outerHTML', message: 'outerHTML は使わず textContent を使ってください' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: 'dangerouslySetInnerHTML は使わないでください',
        },
        {
          selector: 'MemberExpression[property.name="innerHTML"]',
          message: 'innerHTML は使わず textContent を使ってください',
        },
      ],
    },
  },
)
