# Payload CMS Plugin Development Guide

This is a **Payload CMS v3 plugin** built to extend Payload functionality. The plugin follows Payload's plugin architecture pattern.

## Build, Test, and Lint Commands

### Build
```bash
pnpm build                # Full build: copy files + types + transpile
pnpm build:types          # TypeScript types only
pnpm build:swc            # SWC transpilation only
```

### Test
```bash
pnpm test                 # Run all tests (integration + e2e)
pnpm test:int             # Integration tests only (Vitest)
pnpm test:e2e             # E2E tests only (Playwright)
```

**Single test examples:**
```bash
# Run specific integration test
pnpm vitest run -t "should query custom endpoint"

# Run specific e2e test
pnpm playwright test -g "should render admin panel logo"
```

### Lint
```bash
pnpm lint                 # Check for issues
pnpm lint:fix             # Auto-fix issues
```

### Development Server
```bash
pnpm dev                  # Start Next.js dev server with plugin loaded
```

**Important:** Create `dev/.env` from `dev/.env.example` before running dev server.

## Architecture

### Plugin Structure

**Entry point:** `src/index.ts` exports the main plugin function:
```typescript
export const menuPlugin = (pluginOptions: MenuPluginConfig) => (config: Config): Config
```

The plugin receives the Payload config and returns a modified config. It follows a functional composition pattern where plugins transform the config object.

### Key Patterns

**Config extension with spread syntax:**
```typescript
// Always spread existing arrays/objects to preserve data from other plugins
config.collections = [...(config.collections || []), newCollection]
config.endpoints = [...(config.endpoints || []), newEndpoint]
```

**Async onInit chaining:**
```typescript
const incomingOnInit = config.onInit
config.onInit = async (payload) => {
  // MUST await existing onInit before running plugin logic
  if (incomingOnInit) await incomingOnInit(payload)
  // Plugin initialization logic here
}
```

**Multiple export paths:**
- Main export (`src/index.ts`): Server-side plugin logic
- Client export (`src/exports/client.ts`): Client-side React components
- RSC export (`src/exports/rsc.ts`): React Server Components

### Dev Environment

The `/dev` folder contains a minimal Payload project for testing the plugin. It:
- Uses in-memory MongoDB (via `mongodb-memory-server`) for tests
- Imports the plugin from the src directory as `menu-plugin`
- Contains integration tests (`int.spec.ts`) and e2e tests (`e2e.spec.ts`)

When modifying the plugin, update `dev/payload.config.ts` to reflect new options or behavior.

## Conventions

### Disabled State
Plugins should support a `disabled` option. When disabled, **keep collections/fields in the config** to maintain consistent database schema for migrations. Only skip runtime functionality (endpoints, hooks, UI components).

### Collection/Field Modification
When adding fields to existing collections via plugin options:
1. Check if collection exists in config
2. Find collection by slug
3. Push fields directly to `collection.fields` array

### Component Registration
Admin UI components are registered via string references to the plugin's export paths:
```typescript
config.admin.components.beforeDashboard.push('menu-plugin/client#ComponentName')
```

The format is `package-name/export-path#ExportedName`.

### Build Configuration
- **SWC** handles transpilation (`.swcrc` config)
- **TypeScript** emits types only (`emitDeclarationOnly: true`)
- **copyfiles** moves static assets to dist
- Published package uses `dist/` while development uses `src/` directly

### Test Organization
- **Integration tests** (`dev/int.spec.ts`): Use Vitest, test plugin logic with Payload API
- **E2E tests** (`dev/e2e.spec.ts`): Use Playwright, test admin UI behavior
- Both test suites use the same dev environment configuration

### Type Safety
- Export plugin config types with JSDoc comments for IDE autocomplete
- Use `CollectionSlug` type for collection references
- Leverage Payload's `Config` type for type-safe config modification
