import type { CollectionConfig } from 'payload'

import { menuCache } from '../cache.js'
import { createMenuItemFields, type MenuItemFieldOptions } from '../fields/MenuItem.js'

export type MenusCollectionOptions = MenuItemFieldOptions

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
      unique: true,
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
    {
      name: 'menuPreview',
      type: 'ui',
      admin: {
        components: {
          Field: 'menu-plugin/client#MenuPreview',
        },
        position: 'sidebar',
      },
    },
    {
      name: 'items',
      type: 'array',
      admin: {
        components: {
          RowLabel: 'menu-plugin/client#MenuItemRowLabel',
        },
      },
      fields: createMenuItemFields(options),
    },
  ],
  hooks: {
    afterChange: [
      ({ doc }) => {
        if (doc.slug) {
          menuCache.invalidate(doc.slug, doc.locale)
        }
        return doc
      },
    ],
    afterDelete: [
      ({ doc }) => {
        if (doc.slug) {
          menuCache.invalidate(doc.slug, doc.locale)
        }
        return doc
      },
    ],
  },
  labels: {
    plural: 'Menus',
    singular: 'Menu',
  },
  timestamps: true,
})
