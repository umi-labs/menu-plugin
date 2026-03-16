# @foundrykit/menu-plugin

A [Payload CMS](https://payloadcms.com) v3 plugin that adds a configurable menu management system to the admin panel. It lets you model nested navigation, fetch menus by slug, and consume them from regular frontend code without depending on Payload admin UI context.

## Features

- Multiple item types: internal, external, reference, anchor, mailto, tel, custom
- Nested dropdown menus with configurable depth
- Admin URL field UI for internal paths, phone numbers, anchors, and email links
- Public `GET /api/menus/:slug` endpoint with locale and depth support
- Optional import/export endpoints with admin-only access by default
- Server-side menu caching with automatic invalidation
- Frontend-safe `fetchMenu` helper plus a `useMenu` hook built on top of it
- Per-item visibility, target, rel, roles, and custom attributes
- Localized menu identity using `slug + locale`

## Installation

```bash
pnpm add @foundrykit/menu-plugin
```

## Quick Start

```ts
import { buildConfig } from 'payload'
import { menuPlugin } from '@foundrykit/menu-plugin'

export default buildConfig({
  plugins: [
    menuPlugin({
      baseUrl: 'https://example.com',
      relationTo: ['pages', 'posts'],
    }),
  ],
})
```

This registers a `menus` collection in Payload.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `''` | Base URL prefix shown for internal links in the admin |
| `cacheTTL` | `number` | `60000` | Server cache TTL in milliseconds |
| `disabled` | `boolean` | `false` | Keep the collection schema, but disable plugin runtime endpoints, hooks, and admin helper UI |
| `enableImportExport` | `boolean` | `true` | Register the import/export endpoints |
| `maxDepth` | `number` | `2` | Maximum nesting depth for dropdown items |
| `relationTo` | `string \| string[]` | `'pages'` | Collection(s) available for reference links |
| `requireAdminForImportExport` | `boolean` | `true` | Require an authenticated admin user for import/export endpoints |

Example:

```ts
menuPlugin({
  baseUrl: 'https://mysite.com',
  cacheTTL: 300_000,
  maxDepth: 3,
  relationTo: ['pages', 'posts', 'products'],
})
```

## Menu Identity and Locales

Menus are uniquely identified by `slug + locale`.

- `slug: "main-menu", locale: "en"` and `slug: "main-menu", locale: "fr"` can coexist
- locale values are normalized to lowercase
- a menu with no locale is treated as a separate default variant

## REST API

### Get a menu by slug

```http
GET /api/menus/:slug
```

Query parameters:

- `locale`: optional locale variant
- `depth`: Payload relationship depth, default `0`

Example:

```bash
curl 'https://example.com/api/menus/main-menu?locale=en&depth=1'
```

### Export menus

```http
GET /api/menus-export
```

By default this requires an authenticated admin user.

### Import menus

```http
POST /api/menus-import
Content-Type: application/json
```

Accepts either a JSON array of menu documents or `{ "menus": [...] }`.

Imports upsert by `slug + locale`.

Example response:

```json
{
  "created": 1,
  "updated": 2,
  "errors": []
}
```

## Frontend Usage

### `fetchMenu`

Use `fetchMenu` anywhere you have a fetch implementation, including server components and non-Payload frontend code.

```ts
import { fetchMenu } from '@foundrykit/menu-plugin/rsc'

const menu = await fetchMenu({
  slug: 'main-menu',
  locale: 'en',
  depth: 1,
  baseURL: 'https://example.com',
})
```

### `useMenu`

```tsx
'use client'

import { useMenu } from '@foundrykit/menu-plugin/client'

export function Navigation() {
  const { error, isLoading, menu } = useMenu({
    slug: 'main-menu',
    locale: 'en',
    depth: 1,
    baseURL: 'https://example.com',
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>{error}</div>
  if (!menu) return null

  return <pre>{JSON.stringify(menu, null, 2)}</pre>
}
```

`useMenu` includes a 30 second client-side cache and aborts in-flight requests on unmount.

## Caching

- Menus are cached after the first GET request
- cache keys include `slug`, `locale`, and `depth`
- cache entries are invalidated on create, update, and delete
- default server TTL is 60 seconds and is configurable via `cacheTTL`

## Requirements

- Payload CMS v3
- Node.js 18.20.2+ or 20.9.0+

## License

MIT
