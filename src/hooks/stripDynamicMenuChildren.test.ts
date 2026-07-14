import { describe, expect, test } from 'vitest'

import { stripDynamicMenuChildren } from './stripDynamicMenuChildren.js'

describe('stripDynamicMenuChildren', () => {
  test('removes resolved children from a dynamic mega entry', () => {
    const data = {
      items: [
        {
          itemType: 'mega',
          megaEntries: [
            {
              source: 'dynamic',
              // Injected at read time with the related doc's id — this is what
              // fails the array-row id validation on write.
              children: [
                { id: 12, label: 'Kenya', type: 'custom', url: '/local-regions/kenya' },
                { id: 34, label: 'Tanzania', type: 'custom', url: '/local-regions/tanzania' },
              ],
            },
          ],
        },
      ],
    }

    stripDynamicMenuChildren(data)

    expect(data.items[0].megaEntries[0]).not.toHaveProperty('children')
  })

  test('leaves manual mega entries untouched', () => {
    const children = [{ id: 'abc', label: 'Manual', type: 'custom', url: '/x' }]
    const data = {
      items: [{ itemType: 'mega', megaEntries: [{ children, source: 'manual' }] }],
    }

    stripDynamicMenuChildren(data)

    expect(data.items[0].megaEntries[0].children).toBe(children)
  })

  test('reduces a dynamically-derived featured panel to just its mode', () => {
    const data = {
      items: [
        {
          itemType: 'mega',
          megaEntries: [
            {
              children: [{ id: 1 }],
              featured: { heading: 'Resolved', image: { id: 9 }, mode: 'dynamic' },
              source: 'dynamic',
            },
          ],
        },
      ],
    }

    stripDynamicMenuChildren(data)

    expect(data.items[0].megaEntries[0].featured).toEqual({ mode: 'dynamic' })
  })

  test('recurses into dropdown children that contain mega items', () => {
    const data = {
      items: [
        {
          children: [
            { itemType: 'mega', megaEntries: [{ children: [{ id: 7 }], source: 'dynamic' }] },
          ],
          itemType: 'dropdown',
        },
      ],
    }

    stripDynamicMenuChildren(data)

    expect(data.items[0].children[0].megaEntries[0]).not.toHaveProperty('children')
  })

  test('is a no-op for data without items', () => {
    expect(stripDynamicMenuChildren(undefined)).toBeUndefined()
    expect(stripDynamicMenuChildren(null)).toBeNull()
    expect(stripDynamicMenuChildren({ title: 'x' })).toEqual({ title: 'x' })
  })
})
