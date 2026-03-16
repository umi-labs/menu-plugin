import type { CollectionConfig } from 'payload'

import { menuCache } from '../cache.js'
import { createMenuItemFields, type MenuItemFieldOptions } from '../fields/MenuItem.js'
import { buildMenuIdentityKey, normalizeMenuLocale } from '../utilities/menuIdentity.js'

export type MenusCollectionOptions = MenuItemFieldOptions & {
  disabled?: boolean
}

export const createMenusCollection = (options?: MenusCollectionOptions): CollectionConfig => ({
  slug: 'menus',
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'locale', 'items'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: {
        description: 'The name of the menu. E.g. "Main Menu", "Footer Menu", etc.',
      },
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      admin: {
        description:
          'Unique identifier for the menu, used in API requests. E.g. "main-menu", "footer-menu", etc.',
      },
      index: true,
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Optional description for the menu.',
        position: 'sidebar',
      },
    },
    {
      name: 'locale',
      type: 'text',
      admin: {
        description: 'Used for localisation. E.g. "en", "fr", etc.',
        position: 'sidebar',
      },
    },
    ...(options?.disabled
      ? []
      : [
          {
            name: 'menuPreview',
            type: 'ui',
            admin: {
              components: {
                Field: 'menu-plugin/client#MenuPreview',
              },
              position: 'sidebar',
            },
          } as const,
        ]),
    {
      name: 'slugLocaleKey',
      type: 'text',
      admin: {
        hidden: true,
      },
      index: true,
      unique: true,
    },
    {
      name: 'items',
      type: 'array',
      admin: {
        ...(options?.disabled
          ? {}
          : {
              components: {
                RowLabel: 'menu-plugin/client#MenuItemRowLabel',
              },
            }),
      },
      fields: createMenuItemFields(options),
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data

        const normalizedLocale = normalizeMenuLocale(data.locale)

        return {
          ...data,
          locale: normalizedLocale,
          slugLocaleKey: data.slug ? buildMenuIdentityKey(data.slug, normalizedLocale) : data.slugLocaleKey,
        }
      },
    ],
    ...(options?.disabled
      ? {}
      : {
          afterChange: [
            ({ doc, previousDoc }) => {
              if (previousDoc?.slug) {
                menuCache.invalidate(previousDoc.slug)
              }
              if (doc.slug) {
                menuCache.invalidate(doc.slug)
              }
              return doc
            },
          ],
          afterDelete: [
            ({ doc }) => {
              if (doc.slug) {
                menuCache.invalidate(doc.slug)
              }
              return doc
            },
          ],
        }),
  },
  labels: {
    plural: 'Menus',
    singular: 'Menu',
  },
  timestamps: true,
})
