# @foundrykit/menu-plugin

A [Payload CMS](https://payloadcms.com) v3 plugin that adds a flexible, configurable menu management system to your admin panel. Build navigation menus with support for internal links, external URLs, document references, dropdowns, phone numbers, email links, and more.

## Features

- Multiple link types: internal, external, reference, anchor, mailto, tel, custom
- Nested dropdown menus with configurable max depth
- Smart URL input that adapts its UI per link type (baseUrl prefix, country code selector, etc.)
- REST API endpoint to fetch menus by slug
- Built-in server-side caching with automatic invalidation
- `useMenu` React hook for client-side fetching
- Menu export/import endpoints for migration between environments
- Per-item visibility, target, rel, roles, and custom attributes
- Sidebar preview of the menu tree structure
- Field-level validation per link type

## Installation

```bash
pnpm add @foundrykit/menu-plugin
# or
npm install @foundrykit/menu-plugin
# or
yarn add @foundrykit/menu-plugin
```

## Quick Start

Add the plugin to your Payload config:

```ts
import { buildConfig } from 'payload'
import { menuPlugin } from '@foundrykit/menu-plugin'

export default buildConfig({
  // ...your config
  plugins: [
    menuPlugin({
      baseUrl: 'https://example.com',
      relationTo: ['pages', 'posts'],
    }),
  ],
})
```

This adds a `menus` collection to your admin panel where you can create and manage navigation menus.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `''` | Base URL shown as a prefix for internal links |
| `relationTo` | `string \| string[]` | `'pages'` | Collection(s) available for reference-type links |
| `maxDepth` | `number` | `2` | Maximum nesting depth for dropdown menus |
| `disabled` | `boolean` | `false` | Disable the plugin's endpoints and runtime behaviour while keeping the collection in the database schema |

### Example

```ts
menuPlugin({
  baseUrl: 'https://mysite.com',
  relationTo: ['pages', 'posts', 'products'],
  maxDepth: 3,
})
```

## Menu Item Types

Each menu item has a `type` that determines the URL input behaviour:

| Type | Description | Stored value |
|---|---|---|
| `reference` | Relationship to a Payload document | Relationship field (no URL) |
| `internal` | Internal path with baseUrl prefix | Full URL (e.g. `https://example.com/about`) |
| `external` | External URL | Full URL (e.g. `https://other-site.com`) |
| `anchor` | Anchor link on the current page | `#section-name` |
| `mailto` | Email link | `mailto:user@example.com` |
| `tel` | Phone link with country code selector | `tel:+441234567890` |
| `custom` | Plain text, any value | As entered |

## Dropdown Menus

Menu items can be either a **link** or a **dropdown**. Dropdowns contain a nested array of child items, which can themselves be links or dropdowns (up to `maxDepth` levels).

## Advanced Options

Each menu item has an "Advanced" toggle that reveals additional fields:

- **Target** — Open in same tab (`_self`) or new tab (`_blank`)
- **Visibility** — Show or hide the item
- **Rel** — Custom `rel` attribute (e.g. `noopener noreferrer`)
- **Roles** — Array of role strings for role-based visibility
- **Attrs** — Custom HTML attributes as text

## REST API

### Get a menu by slug

```
GET /api/menus/:slug
```

Query parameters:
- `locale` — Filter by locale field
- `depth` — Payload relationship depth (default: `0`)

Response: The full menu document as JSON.

```bash
curl https://example.com/api/menus/main-menu?depth=1&locale=en
```

### Export all menus

```
GET /api/menus-export
```

Returns all menus as a JSON file download.

### Import menus

```
POST /api/menus-import
Content-Type: application/json
```

Accepts a JSON array of menu documents (or `{ menus: [...] }`). Upserts by slug — existing menus are updated, new ones are created.

Response:
```json
{
  "created": 1,
  "updated": 2,
  "errors": []
}
```

## Client-Side Usage

### `useMenu` Hook

A React hook for fetching menus on the client:

```tsx
'use client'

import { useMenu } from '@foundrykit/menu-plugin/client'

export function Navigation() {
  const { menu, isLoading, error, refetch } = useMenu({
    slug: 'main-menu',
    locale: 'en',
    depth: 1,
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!menu) return null

  return (
    <nav>
      {menu.items?.map((item: any) => (
        <a key={item.id} href={item.url} target={item.target}>
          {item.label}
        </a>
      ))}
    </nav>
  )
}
```

The hook includes a 30-second client-side cache and supports abort on unmount.

### Options

| Option | Type | Required | Description |
|---|---|---|---|
| `slug` | `string` | Yes | The menu slug to fetch |
| `locale` | `string` | No | Locale filter |
| `depth` | `number` | No | Relationship population depth (default: `0`) |

### Return Value

| Property | Type | Description |
|---|---|---|
| `menu` | `object \| null` | The fetched menu document |
| `isLoading` | `boolean` | Whether the request is in progress |
| `error` | `string \| null` | Error message if the request failed |
| `refetch` | `() => Promise<void>` | Manually re-fetch the menu |

## Server-Side Usage

You can also query menus using the Payload Local API:

```ts
const menu = await payload.find({
  collection: 'menus',
  where: { slug: { equals: 'main-menu' } },
  depth: 1,
})
```

## Caching

The plugin includes automatic server-side caching:

- Menus are cached after the first API request
- Cache is automatically invalidated when a menu is created, updated, or deleted
- Default TTL is 5 minutes

## Requirements

- Payload CMS v3
- Node.js 18.20.2+ or 20.9.0+

## License

MIT
