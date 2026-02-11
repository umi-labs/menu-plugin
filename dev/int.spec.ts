import type { Payload } from 'payload'

import config from '@payload-config'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { getMenuHandler } from '../src/endpoints/getMenuHandler.js'
import { exportMenusHandler } from '../src/endpoints/exportMenusHandler.js'
import { importMenusHandler } from '../src/endpoints/importMenusHandler.js'

let payload: Payload

afterAll(async () => {
  if (typeof payload?.db?.destroy === 'function') {
    await payload.db.destroy()
  }
})

beforeAll(async () => {
  payload = await getPayload({ config })
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
    expect(menu.items).toHaveLength(2)
    expect(menu.items![0].label).toBe('Home')
    expect(menu.items![1].itemType).toBe('dropdown')
    expect(menu.items![1].children).toHaveLength(2)
    menuId = menu.id as string
  })

  test('can query menu by slug', async () => {
    const result = await payload.find({
      collection: 'menus',
      where: { slug: { equals: 'main-menu' } },
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0].title).toBe('Main Menu')
  })

  test('enforces unique slugs', async () => {
    await expect(
      payload.create({
        collection: 'menus',
        data: {
          title: 'Duplicate',
          slug: 'main-menu',
          items: [],
        },
      }),
    ).rejects.toThrow()
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
    const request = new Request('http://localhost:3000/api/menus/main-menu', {
      method: 'GET',
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    payloadRequest.routeParams = { slug: 'main-menu' }
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.slug).toBe('main-menu')
    expect(data.items).toBeDefined()
  })

  test('returns 404 for non-existent menu', async () => {
    const request = new Request('http://localhost:3000/api/menus/does-not-exist', {
      method: 'GET',
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    payloadRequest.routeParams = { slug: 'does-not-exist' }
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(404)
  })

  test('returns 400 when slug is missing', async () => {
    const request = new Request('http://localhost:3000/api/menus/', {
      method: 'GET',
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    payloadRequest.routeParams = {}
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(400)
  })

  test('supports locale filtering', async () => {
    const request = new Request('http://localhost:3000/api/menus/main-menu?locale=en', {
      method: 'GET',
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    payloadRequest.routeParams = { slug: 'main-menu' }
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.locale).toBe('en')
  })

  test('returns 404 for wrong locale', async () => {
    const request = new Request('http://localhost:3000/api/menus/main-menu?locale=fr', {
      method: 'GET',
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    payloadRequest.routeParams = { slug: 'main-menu' }
    const response = await getMenuHandler(payloadRequest)

    expect(response.status).toBe(404)
  })
})

describe('Export/Import endpoints', () => {
  test('export returns all menus as JSON', async () => {
    const request = new Request('http://localhost:3000/api/menus-export', {
      method: 'GET',
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    const response = await exportMenusHandler(payloadRequest)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = JSON.parse(await response.text())
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data[0].slug).toBeDefined()
  })

  test('import creates new menus', async () => {
    const menus = [
      {
        title: 'Imported Menu',
        slug: 'imported-menu',
        items: [{ itemType: 'link', label: 'Test', type: 'external', url: 'https://example.com' }],
      },
    ]

    const request = new Request('http://localhost:3000/api/menus-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(menus),
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    const response = await importMenusHandler(payloadRequest)

    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(0)

    // Verify it was created
    const found = await payload.find({
      collection: 'menus',
      where: { slug: { equals: 'imported-menu' } },
    })
    expect(found.docs).toHaveLength(1)
  })

  test('import updates existing menus by slug', async () => {
    const menus = [
      {
        title: 'Imported Menu Updated',
        slug: 'imported-menu',
        items: [],
      },
    ]

    const request = new Request('http://localhost:3000/api/menus-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(menus),
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    const response = await importMenusHandler(payloadRequest)

    const result = await response.json()
    expect(result.updated).toBe(1)
    expect(result.created).toBe(0)
  })

  test('import rejects invalid body', async () => {
    const request = new Request('http://localhost:3000/api/menus-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notMenus: true }),
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    const response = await importMenusHandler(payloadRequest)

    expect(response.status).toBe(400)
  })
})
