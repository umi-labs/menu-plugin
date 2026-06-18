import type { Config, Payload, PayloadRequest } from 'payload'

import config from '@payload-config'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import type { DynamicSource } from '../src/types.js'

import { MenuCache } from '../src/cache.js'
import { createMenusCollection } from '../src/collections/Menus.js'
import { createExportMenusHandler } from '../src/endpoints/exportMenusHandler.js'
import { createGetMenuHandler, getMenuHandler } from '../src/endpoints/getMenuHandler.js'
import { createImportMenusHandler } from '../src/endpoints/importMenusHandler.js'
import { createMenuItemFields } from '../src/fields/MenuItem.js'
import { buildMenuRequestURL, fetchMenu } from '../src/fetchMenu.js'
import { createResolveDynamicMenuHook } from '../src/hooks/resolveDynamicMenu.js'
import { menuPlugin } from '../src/index.js'
import {
  menuDocNeedsMegaColumnsMigration,
  migrateMenuItemsMegaColumns,
} from '../src/migrations/megaColumnsToEntries.js'

let payload: Payload
let adminUser: PayloadRequest['user']

const createTestRequest = async ({
  body,
  method = 'GET',
  url,
  user,
}: {
  body?: string
  method?: string
  url: string
  user?: PayloadRequest['user']
}) => {
  const request = new Request(url, {
    body,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    method,
  })

  const payloadRequest = await createPayloadRequest({ config, request })
  if (user) {
    payloadRequest.user = user
  }

  return payloadRequest
}

afterAll(async () => {
  if (typeof payload?.db?.destroy === 'function') {
    await payload.db.destroy()
  }
})

beforeAll(async () => {
  payload = await getPayload({ config })

  const users = await payload.find({
    collection: 'users',
    limit: 1,
  })

  adminUser = {
    ...users.docs[0],
    collection: 'users',
  } as PayloadRequest['user']
})

describe('Menus collection', () => {
  let menuId: string

  test('can create a menu', async () => {
    const menu = await payload.create({
      collection: 'menus',
      data: {
        title: 'Main Menu',
        slug: 'main-menu',
        locale: 'en',
        items: [
          {
            itemType: 'link',
            label: 'Home',
            type: 'internal',
            url: 'http://localhost:3000/',
          },
          {
            itemType: 'dropdown',
            label: 'About',
            children: [
              {
                label: 'Team',
                type: 'internal',
                url: 'http://localhost:3000/team',
              },
              {
                label: 'Contact',
                type: 'mailto',
                url: 'mailto:test@example.com',
              },
            ],
          },
        ],
      },
    })

    expect(menu.id).toBeDefined()
    expect(menu.title).toBe('Main Menu')
    expect(menu.slug).toBe('main-menu')
    expect(menu.locale).toBe('en')
    expect(menu.items).toHaveLength(2)
    expect(menu.items![0].label).toBe('Home')
    expect(menu.items![1].itemType).toBe('dropdown')
    expect(menu.items![1].children).toHaveLength(2)
    menuId = menu.id as string
  })

  test('supports localized variants by slug and locale', async () => {
    const localized = await payload.create({
      collection: 'menus',
      data: {
        title: 'Main Menu FR',
        slug: 'main-menu',
        locale: 'FR',
        items: [],
      },
    })

    expect(localized.slug).toBe('main-menu')
    expect(localized.locale).toBe('fr')

    await expect(
      payload.create({
        collection: 'menus',
        data: {
          title: 'Duplicate FR',
          slug: 'main-menu',
          locale: 'fr',
          items: [],
        },
      }),
    ).rejects.toThrow()
  })

  test('can query menu by slug and locale', async () => {
    const result = await payload.find({
      collection: 'menus',
      where: {
        and: [{ slug: { equals: 'main-menu' } }, { locale: { equals: 'en' } }],
      },
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0].title).toBe('Main Menu')
  })

  test('can update a menu', async () => {
    const updated = await payload.update({
      collection: 'menus',
      id: menuId,
      data: {
        title: 'Updated Main Menu',
      },
    })

    expect(updated.title).toBe('Updated Main Menu')
  })

  test('can delete a menu', async () => {
    const secondMenu = await payload.create({
      collection: 'menus',
      data: {
        title: 'Footer Menu',
        slug: 'footer-menu',
        items: [],
      },
    })

    await payload.delete({
      collection: 'menus',
      id: secondMenu.id as string,
    })

    const result = await payload.find({
      collection: 'menus',
      where: { slug: { equals: 'footer-menu' } },
    })

    expect(result.docs).toHaveLength(0)
  })

  test('read access is public', async () => {
    const result = await payload.find({
      collection: 'menus',
      overrideAccess: false,
    })

    expect(result.docs.length).toBeGreaterThan(0)
  })
})

describe('GET /api/menus/:slug endpoint', () => {
  test('returns menu by slug', async () => {
    const payloadRequest = await createTestRequest({
      url: 'http://localhost:3000/api/menus/main-menu',
    })

    payloadRequest.routeParams = { slug: 'main-menu' }
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.slug).toBe('main-menu')
    expect(data.items).toBeDefined()
    expect(data.slugLocaleKey).toBeUndefined()
  })

  test('returns 404 for non-existent menu', async () => {
    const payloadRequest = await createTestRequest({
      url: 'http://localhost:3000/api/menus/does-not-exist',
    })

    payloadRequest.routeParams = { slug: 'does-not-exist' }
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(404)
  })

  test('returns 400 when slug is missing', async () => {
    const payloadRequest = await createTestRequest({
      url: 'http://localhost:3000/api/menus/',
    })

    payloadRequest.routeParams = {}
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(400)
  })

  test('supports locale filtering', async () => {
    const payloadRequest = await createTestRequest({
      url: 'http://localhost:3000/api/menus/main-menu?locale=en',
    })

    payloadRequest.routeParams = { slug: 'main-menu' }
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.locale).toBe('en')
  })

  test('returns localized variants independently', async () => {
    const payloadRequest = await createTestRequest({
      url: 'http://localhost:3000/api/menus/main-menu?locale=fr',
    })

    payloadRequest.routeParams = { slug: 'main-menu' }
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.locale).toBe('fr')
    expect(data.title).toBe('Main Menu FR')
  })

  test('isolates cache entries by depth', async () => {
    const cache = new MenuCache()
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ slug: 'depth-menu', marker: 'depth-0' }] })
      .mockResolvedValueOnce({ docs: [{ slug: 'depth-menu', marker: 'depth-1' }] })

    const handler = createGetMenuHandler({
      cache,
    })

    const req0 = {
      payload: { find },
      routeParams: { slug: 'depth-menu' },
      url: 'http://localhost:3000/api/menus/depth-menu?depth=0',
    } as any

    const req1 = {
      payload: { find },
      routeParams: { slug: 'depth-menu' },
      url: 'http://localhost:3000/api/menus/depth-menu?depth=1',
    } as any

    const first = await handler(req0)
    const second = await handler(req1)
    const third = await handler(req0)

    expect((await first.json()).marker).toBe('depth-0')
    expect((await second.json()).marker).toBe('depth-1')
    expect((await third.json()).marker).toBe('depth-0')
    expect(find).toHaveBeenCalledTimes(2)
  })
})

describe('Export/Import endpoints', () => {
  test('export requires admin authentication by default', async () => {
    const payloadRequest = await createTestRequest({
      url: 'http://localhost:3000/api/menus-export',
    })

    const response = await createExportMenusHandler()(payloadRequest)

    expect(response.status).toBe(401)
  })

  test('import requires admin authentication by default', async () => {
    const payloadRequest = await createTestRequest({
      body: JSON.stringify([]),
      method: 'POST',
      url: 'http://localhost:3000/api/menus-import',
    })

    const response = await createImportMenusHandler()(payloadRequest)

    expect(response.status).toBe(401)
  })

  test('export returns all menus as JSON for admins', async () => {
    const payloadRequest = await createTestRequest({
      url: 'http://localhost:3000/api/menus-export',
      user: adminUser,
    })

    const response = await createExportMenusHandler()(payloadRequest)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = JSON.parse(await response.text())
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data[0].slug).toBeDefined()
    expect(data[0].slugLocaleKey).toBeUndefined()
  })

  test('import creates new menus for admins', async () => {
    const menus = [
      {
        title: 'Imported Menu',
        slug: 'imported-menu',
        items: [{ itemType: 'link', label: 'Test', type: 'external', url: 'https://example.com' }],
      },
    ]

    const payloadRequest = await createTestRequest({
      body: JSON.stringify(menus),
      method: 'POST',
      url: 'http://localhost:3000/api/menus-import',
      user: adminUser,
    })

    const response = await createImportMenusHandler()(payloadRequest)

    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(0)

    const found = await payload.find({
      collection: 'menus',
      where: { slug: { equals: 'imported-menu' } },
    })
    expect(found.docs).toHaveLength(1)
  })

  test('import updates existing menus by slug and locale', async () => {
    const payloadRequest = await createTestRequest({
      body: JSON.stringify([
        {
          title: 'Imported Menu EN',
          slug: 'localized-import-menu',
          locale: 'en',
          items: [],
        },
        {
          title: 'Imported Menu FR',
          slug: 'localized-import-menu',
          locale: 'fr',
          items: [],
        },
      ]),
      method: 'POST',
      url: 'http://localhost:3000/api/menus-import',
      user: adminUser,
    })

    await createImportMenusHandler()(payloadRequest)

    const updateRequest = await createTestRequest({
      body: JSON.stringify([
        {
          title: 'Imported Menu FR Updated',
          slug: 'localized-import-menu',
          locale: 'fr',
          items: [],
        },
      ]),
      method: 'POST',
      url: 'http://localhost:3000/api/menus-import',
      user: adminUser,
    })

    const response = await createImportMenusHandler()(updateRequest)
    const result = await response.json()
    expect(result.updated).toBe(1)
    expect(result.created).toBe(0)

    const found = await payload.find({
      collection: 'menus',
      where: {
        and: [{ slug: { equals: 'localized-import-menu' } }, { locale: { equals: 'fr' } }],
      },
    })
    expect(found.docs[0].title).toBe('Imported Menu FR Updated')
  })

  test('import rejects invalid body', async () => {
    const payloadRequest = await createTestRequest({
      body: JSON.stringify({ notMenus: true }),
      method: 'POST',
      url: 'http://localhost:3000/api/menus-import',
      user: adminUser,
    })

    const response = await createImportMenusHandler()(payloadRequest)

    expect(response.status).toBe(400)
  })
})

describe('Plugin configuration', () => {
  test('disabled mode keeps the collection but removes runtime hooks and admin helpers', () => {
    const collection = createMenusCollection({ disabled: true })
    const fieldNames = collection.fields?.flatMap((field) => ('name' in field ? [field.name] : [])) || []
    const itemsField = collection.fields?.find((field) => 'name' in field && field.name === 'items')

    expect(fieldNames).not.toContain('menuPreview')
    expect((itemsField as any)?.admin?.components).toBeUndefined()
    expect(collection.hooks?.afterChange).toBeUndefined()
    expect(collection.hooks?.afterDelete).toBeUndefined()
  })

  test('disabled mode does not register endpoints', () => {
    const baseConfig = {
      collections: [],
      endpoints: [],
    } as unknown as Config

    const transformed = menuPlugin({ disabled: true })(baseConfig)

    expect(transformed.collections).toHaveLength(1)
    expect(transformed.endpoints).toHaveLength(0)
  })

  test('can disable import/export while keeping public menu reads', () => {
    const baseConfig = {
      collections: [],
      endpoints: [],
    } as unknown as Config

    const transformed = menuPlugin({ enableImportExport: false })(baseConfig)

    expect(transformed.endpoints).toHaveLength(1)
    expect(transformed.endpoints?.[0].path).toBe('/api/menus/:slug')
  })
})

describe('Frontend fetch helpers', () => {
  test('builds stable menu URLs outside the Payload admin UI', () => {
    expect(
      buildMenuRequestURL({
        apiRoute: '/api',
        baseURL: 'https://example.com',
        depth: 1,
        locale: 'EN',
        slug: 'main-menu',
      }),
    ).toBe('https://example.com/api/menus/main-menu?locale=en&depth=1')
  })

  test('fetchMenu uses plain fetch and surfaces API errors', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ slug: 'main-menu' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Missing menu' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404,
        }),
      )

    await expect(fetchMenu({ fetch: fetchImpl, slug: 'main-menu' })).resolves.toMatchObject({
      slug: 'main-menu',
    })
    await expect(fetchMenu({ fetch: fetchImpl, slug: 'missing-menu' })).rejects.toThrow('Missing menu')
    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/api/menus/main-menu')
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/api/menus/missing-menu')
  })
})

const findByName = (fields: any[], name: string): any =>
  fields.find((field) => 'name' in field && field.name === name)

const findCollapsible = (fields: any[], label: string): any =>
  fields.find((field) => field.type === 'collapsible' && field.label === label)

const collectNames = (fields: any[]): string[] =>
  fields.flatMap((field) => {
    const names: string[] = []
    if ('name' in field && field.name) names.push(field.name)
    if ('fields' in field && Array.isArray(field.fields)) names.push(...collectNames(field.fields))
    return names
  })

describe('createMenuItemFields field organisation', () => {
  test('exposes simple-by-default fields with Options/Advanced collapsibles', () => {
    const fields = createMenuItemFields()

    expect(findByName(fields, 'itemType')).toBeDefined()
    expect(findByName(fields, 'type')).toBeDefined()

    const allNames = collectNames(fields)
    expect(allNames).toContain('label')
    expect(allNames).toContain('url')
    expect(allNames).toContain('reference')

    const options = findCollapsible(fields, 'Options')
    const advanced = findCollapsible(fields, 'Advanced')
    expect(options).toBeDefined()
    expect(advanced).toBeDefined()
    expect(options.admin.initCollapsed).toBe(true)
    expect(advanced.admin.initCollapsed).toBe(true)

    expect(collectNames(options.fields)).toEqual(expect.arrayContaining(['target', 'displaySurface']))
    expect(collectNames(advanced.fields)).toEqual(
      expect.arrayContaining(['visibility', 'rel', 'roles', 'attrs']),
    )
  })

  test('removes the advancedOptions radio entirely', () => {
    const fields = createMenuItemFields()
    expect(collectNames(fields)).not.toContain('advancedOptions')
  })

  test('mega item config exposes megaLayout, defaultFeatured and megaEntries', () => {
    const fields = createMenuItemFields()

    const megaLayout = findByName(fields, 'megaLayout')
    const defaultFeatured = findByName(fields, 'defaultFeatured')
    const megaEntries = findByName(fields, 'megaEntries')

    expect(megaLayout).toBeDefined()
    expect(megaLayout.defaultValue).toBe('reveal')
    expect(defaultFeatured).toBeDefined()
    expect(collectNames(defaultFeatured.fields)).toEqual(expect.arrayContaining(['heading', 'ctaLabel']))

    expect(megaEntries).toBeDefined()
    expect(megaEntries.dbName).toBe('me0')

    const entryNames = megaEntries.fields.map((f: any) => f.name).filter(Boolean)
    expect(entryNames).toEqual(expect.arrayContaining(['source', 'children', 'dynamicSource', 'parent', 'featured']))

    const children = findByName(megaEntries.fields, 'children')
    expect(children.dbName).toBe('mc0')

    const featured = findByName(megaEntries.fields, 'featured')
    expect(findByName(featured.fields, 'mode').defaultValue).toBe('inherit')
  })

  test('single source hides dynamicSource select and collapses parent.relationTo to a string', () => {
    const source: DynamicSource = {
      name: 'a',
      collection: 'locations',
      hrefBuilder: () => '/x',
      label: 'A',
      labelField: 'title',
      parentCollection: 'destinations',
      parentField: 'destination',
    }
    const fields = createMenuItemFields({ dynamicSources: [source] })
    const megaEntries = findByName(fields, 'megaEntries')
    const parent = findByName(megaEntries.fields, 'parent')
    const dynamicSource = findByName(megaEntries.fields, 'dynamicSource')

    expect(parent.relationTo).toBe('destinations')
    expect(dynamicSource.admin.hidden).toBe(true)
    expect(dynamicSource.defaultValue).toBe('a')
  })

  test('multiple sources show dynamicSource select and union parent.relationTo', () => {
    const sources: DynamicSource[] = [
      {
        name: 'a',
        collection: 'locations',
        hrefBuilder: () => '/x',
        label: 'A',
        labelField: 'title',
        parentCollection: 'destinations',
        parentField: 'destination',
      },
      {
        name: 'b',
        collection: 'posts',
        hrefBuilder: () => '/y',
        label: 'B',
        labelField: 'title',
        parentCollection: 'pages',
        parentField: 'page',
      },
    ]
    const fields = createMenuItemFields({ dynamicSources: sources })
    const megaEntries = findByName(fields, 'megaEntries')
    const parent = findByName(megaEntries.fields, 'parent')
    const dynamicSource = findByName(megaEntries.fields, 'dynamicSource')

    expect(parent.relationTo).toEqual(['destinations', 'pages'])
    expect(dynamicSource.admin.hidden).toBe(false)
    expect(dynamicSource.options).toHaveLength(2)
  })
})

describe('createResolveDynamicMenuHook (unit)', () => {
  const source: DynamicSource = {
    name: 'a',
    collection: 'locations',
    hrefBuilder: (doc) => `/loc/${(doc as any).slug}`,
    label: 'A',
    labelField: 'title',
    parentCollection: 'destinations',
    parentField: 'destination',
    sort: 'title',
  }
  const sourceB: DynamicSource = { ...source, name: 'b' }

  const makePayload = (docs: any[] = []) => ({
    find: vi.fn().mockResolvedValue({ docs }),
    findByID: vi.fn(),
    logger: { error: vi.fn(), warn: vi.fn() },
  })

  test('resolves dynamic children and respects locale + where filter', async () => {
    const payload = makePayload([{ id: '1', slug: 'paris', title: 'Paris' }])
    const hook = createResolveDynamicMenuHook({ dynamicSources: [source, sourceB] })
    const doc: any = {
      items: [
        {
          itemType: 'mega',
          megaEntries: [{ dynamicSource: 'a', featured: { mode: 'inherit' }, parent: 'p1', source: 'dynamic' }],
        },
      ],
    }

    await hook({ doc, req: { locale: 'fr', payload } } as any)

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'locations',
        locale: 'fr',
        sort: 'title',
        where: { destination: { equals: 'p1' } },
      }),
    )
    const children = doc.items[0].megaEntries[0].children
    expect(children).toHaveLength(1)
    expect(children[0]).toMatchObject({ label: 'Paris', url: '/loc/paris' })
  })

  test('manual entries pass through unchanged', async () => {
    const payload = makePayload()
    const hook = createResolveDynamicMenuHook({ dynamicSources: [source] })
    const manualChildren = [{ label: 'Hand-typed', type: 'custom', url: '/manual' }]
    const doc: any = {
      items: [{ itemType: 'mega', megaEntries: [{ children: manualChildren, source: 'manual' }] }],
    }

    await hook({ doc, req: { payload } } as any)

    expect(payload.find).not.toHaveBeenCalled()
    expect(doc.items[0].megaEntries[0].children).toBe(manualChildren)
  })

  test('unknown source degrades to empty children and warns', async () => {
    const payload = makePayload([{ id: '1', slug: 'x', title: 'X' }])
    const hook = createResolveDynamicMenuHook({ dynamicSources: [source, sourceB] })
    const doc: any = {
      items: [
        {
          itemType: 'mega',
          megaEntries: [{ dynamicSource: 'nope', parent: 'p1', source: 'dynamic' }],
        },
      ],
    }

    await hook({ doc, req: { payload } } as any)

    expect(payload.find).not.toHaveBeenCalled()
    expect(doc.items[0].megaEntries[0].children).toEqual([])
    expect(payload.logger.warn).toHaveBeenCalled()
  })

  test('missing parent degrades to empty children', async () => {
    const payload = makePayload([{ id: '1', slug: 'x', title: 'X' }])
    const hook = createResolveDynamicMenuHook({ dynamicSources: [source] })
    const doc: any = {
      items: [{ itemType: 'mega', megaEntries: [{ source: 'dynamic' }] }],
    }

    await hook({ doc, req: { payload } } as any)

    expect(payload.find).not.toHaveBeenCalled()
    expect(doc.items[0].megaEntries[0].children).toEqual([])
  })

  test('dynamic featured resolves from the parent doc and degrades when fields absent', async () => {
    const featuredSource: DynamicSource = {
      ...source,
      featured: { descriptionField: 'summary', headingField: 'title', imageField: 'image' },
    }
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 'c1', slug: 'paris', title: 'Paris' }] }),
      findByID: vi.fn().mockResolvedValue({ id: 'p1', summary: 'City of light', title: 'France' }),
      logger: { error: vi.fn(), warn: vi.fn() },
    }
    const hook = createResolveDynamicMenuHook({ dynamicSources: [featuredSource] })
    const doc: any = {
      items: [
        {
          itemType: 'mega',
          megaEntries: [{ featured: { mode: 'dynamic' }, parent: 'p1', source: 'dynamic' }],
        },
      ],
    }

    await hook({ doc, req: { payload } } as any)

    const entry = doc.items[0].megaEntries[0]
    expect(entry.featured).toMatchObject({ description: 'City of light', heading: 'France', mode: 'dynamic' })
    expect(entry.featured.image).toBeUndefined()
  })

  test('does nothing when no dynamic sources are configured', async () => {
    const payload = makePayload([{ id: '1' }])
    const hook = createResolveDynamicMenuHook({ dynamicSources: [] })
    const doc: any = {
      items: [{ itemType: 'mega', megaEntries: [{ parent: 'p1', source: 'dynamic' }] }],
    }

    await hook({ doc, req: { payload } } as any)
    expect(payload.find).not.toHaveBeenCalled()
    expect(doc.items[0].megaEntries[0].children).toBeUndefined()
  })
})

describe('Dynamic mega entries (integration via payload.find)', () => {
  test('resolves children from a seeded parent/child set through afterRead', async () => {
    const destination = await payload.create({
      collection: 'destinations',
      data: { slug: 'europe', summary: 'Old world', title: 'Europe' },
    })

    await payload.create({
      collection: 'locations',
      data: { slug: 'rome', destination: destination.id, title: 'Rome' },
    })
    await payload.create({
      collection: 'locations',
      data: { slug: 'berlin', destination: destination.id, title: 'Berlin' },
    })

    await payload.create({
      collection: 'menus',
      data: {
        title: 'Dynamic Menu',
        slug: 'dynamic-menu',
        items: [
          {
            itemType: 'mega',
            label: 'Explore',
            megaEntries: [
              {
                label: 'Destinations',
                type: 'internal',
                url: '/destinations',
                featured: { mode: 'dynamic' },
                parent: destination.id,
                source: 'dynamic',
              },
              {
                label: 'Manual Entry',
                type: 'custom',
                url: '/manual',
                children: [{ label: 'Static Child', type: 'custom', url: '/static' }],
                source: 'manual',
              },
            ],
          },
        ],
      },
    })

    const result = await payload.find({
      collection: 'menus',
      depth: 1,
      where: { slug: { equals: 'dynamic-menu' } },
    })

    const entries = (result.docs[0].items as any[])[0].megaEntries
    const dynamicEntry = entries[0]
    const manualEntry = entries[1]

    // Children sorted by title -> Berlin before Rome
    expect(dynamicEntry.children.map((c: any) => c.label)).toEqual(['Berlin', 'Rome'])
    expect(dynamicEntry.children[0].url).toBe('/locations/berlin')
    expect(dynamicEntry.featured).toMatchObject({ heading: 'Europe', mode: 'dynamic' })

    expect(manualEntry.children).toHaveLength(1)
    expect(manualEntry.children[0].label).toBe('Static Child')
  })

  test('dynamic entry without a parent resolves to empty children', async () => {
    await payload.create({
      collection: 'menus',
      data: {
        title: 'Orphan Dynamic Menu',
        slug: 'orphan-dynamic-menu',
        items: [
          {
            itemType: 'mega',
            label: 'Explore',
            megaEntries: [{ label: 'No Parent', type: 'custom', url: '/x', source: 'dynamic' }],
          },
        ],
      },
    })

    const result = await payload.find({
      collection: 'menus',
      where: { slug: { equals: 'orphan-dynamic-menu' } },
    })

    const entries = (result.docs[0].items as any[])[0].megaEntries
    expect(entries[0].children).toEqual([])
  })
})

describe('megaColumns -> megaEntries migration', () => {
  const buildLegacyMega = ({ withSecondColumn = false } = {}) => ({
    itemType: 'mega',
    label: 'Explore',
    megaColumns: [
      {
        columnTitle: 'Primary',
        columnLinks: [
          {
            label: 'Guides',
            type: 'internal',
            url: '/guides',
            advancedOptions: 'default',
            subLinks: [{ label: 'Getting Started', type: 'internal', url: '/guides/start' }],
          },
        ],
        featured: { heading: 'Featured', description: 'Hello' },
      },
      ...(withSecondColumn
        ? [
            {
              columnTitle: 'Secondary',
              columnLinks: [{ label: 'Extra', type: 'custom', url: '/extra' }],
              featured: { heading: 'Dropped' },
            },
          ]
        : []),
    ],
  })

  test('migrates a single-column mega item with featured', () => {
    const { changed, items } = migrateMenuItemsMegaColumns([buildLegacyMega()])
    expect(changed).toBe(true)

    const migrated = items as any[]
    expect(migrated[0].megaColumns).toBeUndefined()
    expect(migrated[0].megaLayout).toBe('reveal')
    expect(migrated[0].defaultFeatured).toMatchObject({ heading: 'Featured' })

    const entries = migrated[0].megaEntries
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ label: 'Guides', source: 'manual' })
    expect(entries[0].featured).toEqual({ mode: 'inherit' })
    expect(entries[0].children).toHaveLength(1)
    expect(entries[0].children[0].label).toBe('Getting Started')
  })

  test('appends additional columns as entries and keeps only primary featured', () => {
    const { items } = migrateMenuItemsMegaColumns([buildLegacyMega({ withSecondColumn: true })])
    const migrated = items as any[]
    const entries = migrated[0].megaEntries

    expect(entries.map((e: any) => e.label)).toEqual(['Guides', 'Extra'])
    expect(migrated[0].defaultFeatured).toMatchObject({ heading: 'Featured' })
  })

  test('is idempotent when re-run against migrated data', () => {
    const first = migrateMenuItemsMegaColumns([buildLegacyMega()])
    const second = migrateMenuItemsMegaColumns(first.items)
    expect(second.changed).toBe(false)
    expect(second.items).toEqual(first.items)
  })

  test('detects whether a doc needs migration', () => {
    expect(menuDocNeedsMegaColumnsMigration([buildLegacyMega()])).toBe(true)
    const { items } = migrateMenuItemsMegaColumns([buildLegacyMega()])
    expect(menuDocNeedsMegaColumnsMigration(items)).toBe(false)
  })

  test('migrates mega items nested inside dropdowns', () => {
    const { changed, items } = migrateMenuItemsMegaColumns([
      { itemType: 'dropdown', label: 'Parent', children: [buildLegacyMega()] },
    ])
    expect(changed).toBe(true)
    const child = (items as any[])[0].children[0]
    expect(child.megaEntries).toHaveLength(1)
    expect(child.megaColumns).toBeUndefined()
  })
})
