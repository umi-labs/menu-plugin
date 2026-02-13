# AGENTS.md

This file guides agentic coding agents working on the `@foundrykit/menu-plugin` repository.

## 1. Build, Lint, and Test

### Build

- **Full Build:** `pnpm build` (Copies assets, builds types, transpiles with SWC)
- **Types Only:** `pnpm build:types`
- **Transpile Only:** `pnpm build:swc`

### Linting

- **Check:** `pnpm lint`
- **Fix:** `pnpm lint:fix`
- **Rule Source:** Uses `@payloadcms/eslint-config`.

### Testing

- **Frameworks:** Vitest (Integration), Playwright (E2E).
- **Run All Tests:** `pnpm test` (Requires Docker for E2E)
- **Integration Only:** `pnpm test:int`
- **E2E Only:** `pnpm test:e2e` (Requires Docker and `dev/.env`)

**Running Single Tests (CRITICAL for Agent Loops):**

- **Integration (Vitest):**
  ```bash
  # Syntax: pnpm vitest run -t "test name pattern"
  pnpm vitest run -t "should query custom endpoint"
  ```
- **E2E (Playwright):**
  ```bash
  # Syntax: pnpm playwright test -g "test name pattern"
  pnpm playwright test -g "should render admin panel logo"
  ```

### Development Environment

- **Start Dev Server:** `pnpm dev` (Requires `dev/.env` and Docker)
- **Database:**
  - **Tests (Integration):** Uses `mongodb-memory-server` (no Docker required).
  - **Tests (E2E) & Dev Server:** Uses local MongoDB via Docker.
  - **Start DB:** `pnpm dev:db:up`
  - **Stop DB:** `pnpm dev:db:down`
- **Entry Point:** The `dev` folder contains a minimal Payload project that consumes the plugin from `src`. Update `dev/payload.config.ts` to test config changes.

## 2. Release & Versioning

### Publish Process

To release a new version (updates changelog, git tags, and publishes to NPM):

```bash
pnpm release
# or with explicit increment:
pnpm release patch
pnpm release minor
pnpm release major
```

**Prerequisites:**

1.  **Docker must be running:** `pnpm dev:db:up`
2.  **Environment:** `dev/.env` must be configured.
3.  **Clean working directory:** Commit changes first.

The release command will automatically run `lint`, `test`, and `build` before proceeding.

## 3. Code Style & Conventions

### Imports & Modules

- **Module System:** `NodeNext` / ESM.
- **File Extensions:** **MUST** include `.js` extension for all local imports.
  ```typescript
  // CORRECT
  import { createMenusCollection } from './collections/Menus.js'
  // INCORRECT
  import { createMenusCollection } from './collections/Menus'
  ```
- **Absolute Imports:** Avoid using path aliases (`@/`) within the plugin source (`src/`) to ensure the package is portable. Use relative paths.

### Formatting

- **Indentation:** 2 spaces.
- **Quotes:** Single quotes preferred.
- **Semicolons:** No semicolons (ASI).
- **Trailing Commas:** Yes, where valid (ES5+).
- **Exports:** Prefer named exports over default exports for better tree-shaking and clarity.

### Typing (TypeScript)

- **Strictness:** `strict: true` is enabled. No implicit `any`.
- **Payload Types:** Import types like `Config`, `CollectionSlug` from `'payload'`.
- **JSDoc:** Add JSDoc comments to exported plugin options for better IDE support.

### Plugin Architecture Pattern

- **Functional Composition:** The plugin is a function returning a config transformer:
  ```typescript
  export const menuPlugin = (options: PluginOptions) => (config: Config): Config => { ... }
  ```
- **Config Extension:** ALWAYS spread existing config arrays to avoid overwriting other plugins.
  ```typescript
  config.collections = [...(config.collections || []), newCollection]
  ```
- **OnInit Chaining:** If wrapping `onInit`, await the existing one first.
- **Disabled State:** If `options.disabled` is true, **still register collections** (for DB consistency) but disable endpoints/hooks/UI.

### Directory Structure

- `src/index.ts`: Main server-side plugin entry.
- `src/exports/client.ts`: Client-side component exports.
- `src/exports/rsc.ts`: React Server Component exports.
- `dev/`: Development playground (not part of the published package).

## 3. Workflow Examples

### Adding a New Feature

1.  **Define Options:** Update `MenuPluginConfig` in `src/index.ts` if new options are needed.
2.  **Implement Logic:** Add new handlers in `src/endpoints/` or hooks in `src/hooks/`.
3.  **Register:** detailed in `src/index.ts` (add to `config.endpoints`, `config.hooks`, etc.).
4.  **Test:**
    - Add integration test in `dev/int.spec.ts` covering the new functionality.
    - Run `pnpm vitest run -t "your new test name"` to verify.

### Modifying Admin UI

1.  **Create Component:** Add client component in `src/ui/`.
2.  **Export:** Export it in `src/exports/client.ts`.
3.  **Register:** Use string reference in `src/index.ts` (e.g., `'menu-plugin/client#MyComponent'`).
4.  **Test:** Add E2E test in `dev/e2e.spec.ts` and run `pnpm playwright test`.
