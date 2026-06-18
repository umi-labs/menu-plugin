# @foundrykit/menu-plugin

A [Payload CMS](https://payloadcms.com) v3 plugin that adds a configurable menu management system to the admin panel. It lets you model nested navigation, fetch menus by slug, and consume them from regular frontend code without depending on Payload admin UI context.

## Features

- Multiple item types: internal, external, reference, anchor, mailto, tel, custom
- Three item kinds: simple link, nested dropdown, and mega menu
- Mega menus with a flat rows-with-reveal model (`reveal` layout) or classic
  multi-column layout (`columns`), each with a featured panel
- Dynamic mega entries that auto-populate their children (and featured content)
  from a related collection, resolved server-side via an `afterRead` hook
- Nested dropdown menus with configurable depth
- Admin URL field UI for internal paths, phone numbers, anchors, and email links
- Public `GET /api/menus/:slug` endpoint with locale and depth support
- Optional import/export endpoints with admin-only access by default
- Server-side menu caching with automatic invalidation
- Frontend-safe `fetchMenu` helper plus a `useMenu` hook built on top of it
- Per-item display surface (navbar / drawer / both), visibility, target, rel,
  roles, and custom attributes
- Localized menu identity using `slug + locale`
- Migration helper to convert legacy `megaColumns` data to the new `megaEntries`
  shape

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
| `childrenDepth` | `number` | `1` | Relationship `depth` used when resolving dynamic mega entry children |
| `disabled` | `boolean` | `false` | Keep the collection schema, but disable plugin runtime endpoints, hooks, and admin helper UI |
| `dynamicSources` | `DynamicSource[]` | `[]` | Sources used to auto-populate dynamic mega entries from related collections (see below) |
| `enableImportExport` | `boolean` | `true` | Register the import/export endpoints |
| `maxDepth` | `number` | `1` | Maximum nesting depth for dropdown items |
| `mediaCollection` | `string` | `undefined` | Upload collection used for mega menu featured images |
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

## Mega Menus

Each menu item has a kind (`itemType`): `link`, `dropdown`, or `mega`. A mega item
exposes:

- `megaLayout`: `reveal` (default — a flat list of rows that reveal their
  children in a second panel) or `columns` (classic multi-column layout)
- `defaultFeatured`: a fallback featured panel (image, heading, description, CTA)
- `megaEntries`: a flat list of entries. Each entry is itself a link and can
  reveal `children` in a secondary panel, plus an optional per-entry `featured`
  panel whose `mode` is `inherit` (use `defaultFeatured`), `manual`, or `dynamic`.

Featured images use the `mediaCollection` option as their upload `relationTo`.

### Dynamic mega entries

An entry's `source` can be `manual` (children typed by hand) or `dynamic`
(children pulled from a related collection). Dynamic entries are resolved
server-side by an `afterRead` hook on the `menus` collection, so they work
through every read path — the `/api/menus/:slug` endpoint, `payload.find`, and
`menus` populated as a relationship on another global/collection — with no extra
wiring. Resolution is read-only, idempotent, locale-aware, and degrades to empty
children on misconfiguration (never throws).

Configure the available sources via `dynamicSources`:

```ts
import { menuPlugin, type DynamicSource } from '@foundrykit/menu-plugin'

const destinations: DynamicSource = {
  name: 'destinations',
  label: 'Destinations',
  collection: 'destinations',     // queried for children
  parentCollection: 'regions',    // editor picks a parent from here
  parentField: 'region',          // field on a child relating it to its parent
  labelField: 'title',            // child field used as the label
  hrefBuilder: (doc) => `/destinations/${doc.slug as string}`,
  sort: 'title',
  limit: 0,                       // optional; defaults to 0 (return all)
  featured: {
    imageField: 'heroImage',      // dot-path to an upload/media field
    headingField: 'title',
    descriptionField: 'excerpt',
    ctaHrefBuilder: (doc) => `/destinations/${doc.slug as string}`,
    ctaLabel: 'Explore',
  },
}

menuPlugin({
  relationTo: ['pages'],
  mediaCollection: 'media',
  dynamicSources: [destinations],
})
```

When exactly one source is configured, the entry's `dynamicSource` select is
hidden and auto-set, and the `parent` relationship collapses to that single
collection. With multiple sources, the editor chooses a source and the `parent`
relationship spans the union of all configured `parentCollection`s.

### Migrating legacy `megaColumns` data

Earlier versions modelled mega menus as `megaColumns`. Convert existing data to
the new `megaEntries` shape with the exported helper. It is safe to run multiple
times — already-migrated documents are skipped.

```ts
import { migrateMegaColumnsToEntries } from '@foundrykit/menu-plugin'

// `payload` is an initialised Payload instance
const { migrated, scanned } = await migrateMegaColumnsToEntries(payload)
console.log(`Migrated ${migrated} of ${scanned} menus`)
```

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
