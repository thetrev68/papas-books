# CI/CD Setup Documentation

## Overview

Papa's Books uses a comprehensive CI/CD pipeline to ensure code quality and prevent regressions. The setup includes:

1. **Pre-commit hooks** (Husky + lint-staged) - Run before every commit
2. **GitHub Actions** - Run on push to main and all pull requests
3. **Automated checks** - Linting, formatting, tests, and builds

---

## Pre-commit Hooks (Husky + lint-staged)

### What runs before each commit

- **ESLint** - Fixes linting issues automatically on staged TypeScript/React files
- **Prettier** - Formats staged files automatically

### Configuration

#### File: `.husky/pre-commit`

Executes `lint-staged` before allowing the commit.

#### File: `package.json` (lint-staged section)

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{css,md}": [
    "prettier --write"
  ]
}
```

### How it works

1. You run `git commit`
2. Husky intercepts the commit
3. lint-staged runs on only staged files
4. ESLint fixes issues, Prettier formats code
5. If all checks pass, commit proceeds
6. If checks fail, commit is blocked and you must fix errors

### Bypassing pre-commit hooks (NOT recommended)

```bash
git commit --no-verify
```

**Only use this in emergencies!** Pre-commit hooks exist to catch issues before they reach the repository.

---

## GitHub Actions CI Pipeline

### Triggers

- **Push to main branch** - Runs full CI on every push
- **Pull requests to main** - Runs full CI on every PR

### What runs in CI

1. **Install dependencies** - `npm ci` (clean install from package-lock.json)
2. **Lint** - `npm run lint` (ESLint checks all files)
3. **Format check** - `npm run format:check` (Prettier validates formatting)
4. **Tests** - `npm run test -- --run` (Vitest runs all tests)
5. **Build** - `npm run build` (TypeScript compilation + Vite build)

### Configuration1

#### File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - Checkout code
      - Setup Node.js
      - Install dependencies
      - Run linter
      - Check formatting
      - Run tests
      - Build project
```

### Environment Variables in CI

The GitHub Actions workflow requires Supabase credentials to build the project. These are stored as **GitHub Secrets**.

#### Setting up secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:
   - **VITE_SUPABASE_URL** = `https://hdoshdscvlhoqnqaftaq.supabase.co`
   - **VITE_SUPABASE_ANON_KEY** = (your Supabase anon key)

**Important:** Never commit these values to the repository! They are injected at build time via GitHub Secrets.

### Viewing CI Results

After pushing code or creating a PR:

1. Go to the **Actions** tab in your GitHub repository
2. Click on the latest workflow run
3. View logs for each step (Install, Lint, Test, Build)
4. If any step fails, the entire workflow fails (preventing broken code from merging)

---

## NPM Scripts

### Available commands

| Command                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Start development server                             |
| `npm run build`         | Build for production (TypeScript check + Vite build) |
| `npm run lint`          | Run ESLint (reports errors/warnings)                 |
| `npm run lint:fix`      | Run ESLint and fix issues automatically              |
| `npm run format`        | Format all files with Prettier                       |
| `npm run format:check`  | Check formatting without modifying files             |
| `npm run test`          | Run tests in watch mode                              |
| `npm run test -- --run` | Run tests once (used in CI)                          |
| `npm run test:ui`       | Run tests with Vitest UI                             |
| `npm run test:coverage` | Generate test coverage report                        |
| `npm run preview`       | Preview production build locally                     |

### Before committing

It's good practice to run these commands locally before committing:

```bash
# Check for linting issues
npm run lint

# Check formatting
npm run format:check

# Run tests
npm run test -- --run

# Verify build succeeds
npm run build
```

**Note:** Pre-commit hooks will run `eslint --fix` and `prettier --write` automatically, but it's still good to check manually.

---

## Prettier Configuration

### File: `.prettierrc.json`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Why these settings

- **semi: true** - Always use semicolons (prevents ASI bugs)
- **singleQuote: true** - Use single quotes for strings (except JSX)
- **printWidth: 100** - Wrap lines at 100 characters (balance readability and density)
- **tabWidth: 2** - 2-space indentation (standard for React/TS projects)
- **trailingComma: 'es5'** - Trailing commas where valid in ES5 (cleaner diffs)
- **arrowParens: 'always'** - Always wrap arrow function params in parens
- **endOfLine: 'lf'** - Unix-style line endings (consistent across platforms)

### Ignored files

See `.prettierignore` for files excluded from formatting (node_modules, dist, etc.)

---

## ESLint Configuration

### File: `eslint.config.js`

ESLint is configured with:

- **TypeScript support** - `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
- **React support** - `eslint-plugin-react` and `eslint-plugin-react-hooks`
- **Prettier integration** - `eslint-config-prettier` (disables conflicting rules)

### Key rules

- No unused variables (errors)
- React Hooks rules enforced (prevents hooks bugs)
- TypeScript strict type checking
- No console.log in production (warning)

---

## Troubleshooting

### Pre-commit hook not running

```bash
# Re-install Husky hooks
npm run prepare
```

### Lint errors blocking commit

Option 1 (recommended): Fix the errors

```bash
npm run lint:fix
```

Option 2 (temporary): Bypass the hook (NOT recommended)

```bash
git commit --no-verify
```

### CI failing on GitHub

1. Check the **Actions** tab for detailed error logs
2. Run the same commands locally to reproduce:

   ```bash
   npm ci
   npm run lint
   npm run format:check
   npm run test -- --run
   npm run build
   ```

3. Fix errors and push again

### Prettier and ESLint conflicting

This should not happen if `eslint-config-prettier` is properly configured. If it does:

```bash
# Format first
npm run format

# Then lint
npm run lint:fix
```

### GitHub Secrets not working

1. Verify secrets are set in **Settings** → **Secrets and variables** → **Actions**
2. Check that secret names match exactly: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Re-run the workflow after updating secrets

---

## Best Practices

### Before committing1

1. ✅ Write meaningful commit messages
2. ✅ Run tests locally (`npm run test -- --run`)
3. ✅ Let pre-commit hooks run (don't use `--no-verify`)
4. ✅ Review staged changes before committing

### Before merging a PR

1. ✅ Ensure CI passes (green checkmark on GitHub)
2. ✅ Review code changes
3. ✅ Test manually if UI changes are involved
4. ✅ Squash commits if necessary (keep main branch clean)

### Code quality guidelines

- Write tests for new features and bug fixes
- Keep functions small and focused
- Use TypeScript types (avoid `any`)
- Follow existing code patterns and conventions
- Document complex logic with comments

---

## Future Enhancements

Potential CI/CD improvements for future phases:

- **Test coverage thresholds** - Fail CI if coverage drops below X%
- **E2E tests** - Playwright or Cypress integration
- **Performance budgets** - Fail CI if bundle size exceeds limit
- **Visual regression tests** - Chromatic or Percy integration
- **Automated dependency updates** - Dependabot or Renovate
- **Semantic versioning** - Automated changelog generation
- **Deployment previews** - Vercel preview URLs for PRs (already enabled)

---

## Related Documentation

- [Phase-1-Foundation.md](Phase-1-Foundation.md) - DevOps & Quality Assurance section
- [Implementation-Plan.md](Implementation-Plan.md) - Testing strategy
- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
