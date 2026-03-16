import type { Config, Payload, PayloadRequest } from 'payload'

import config from '@payload-config'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { MenuCache } from '../src/cache.js'
import { createMenusCollection } from '../src/collections/Menus.js'
import { createExportMenusHandler } from '../src/endpoints/exportMenusHandler.js'
import { createGetMenuHandler, getMenuHandler } from '../src/endpoints/getMenuHandler.js'
import { createImportMenusHandler } from '../src/endpoints/importMenusHandler.js'
import { buildMenuRequestURL, fetchMenu } from '../src/fetchMenu.js'
import { menuPlugin } from '../src/index.js'

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
