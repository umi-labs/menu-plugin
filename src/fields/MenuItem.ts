import type { CollectionSlug, Field, Validate } from 'payload'

import type { DynamicSource } from '../types.js'

export type MenuItemFieldOptions = {
  baseUrl?: string
  disabled?: boolean
  dynamicSources?: DynamicSource[]
  maxDepth?: number
  mediaCollection?: CollectionSlug
  relationTo?: CollectionSlug | CollectionSlug[]
}

const validateUrl: Validate = (value, { siblingData }) => {
  const type = (siblingData as any)?.type
  if (!value) {
    if (['anchor', 'custom', 'external', 'internal', 'mailto', 'tel'].includes(type)) {
      return 'URL is required for this link type'
    }
    return true
  }

  switch (type) {
    case 'anchor': {
      if (!/^#[\w-]+$/.test(value as string)) {
        return 'Please enter a valid anchor (e.g. #section-name)'
      }
      break
    }
    case 'external': {
      try {
        new URL(value as string)
      } catch {
        return 'Please enter a valid URL (e.g. https://example.co.uk)'
      }
      break
    }
    case 'internal': {
      const path = (value as string).replace(/^https?:\/\/[^/]+/, '')
      if (!path.startsWith('/')) {
        return 'Internal paths must start with /'
      }
      break
    }
    case 'mailto': {
      const email = (value as string).replace(/^mailto:/, '')
      const [local, domain] = email.split('@')
      if (!local || !domain || domain.indexOf('.') < 1 || email.split('@').length !== 2) {
        return 'Please enter a valid email address'
      }
      break
    }
    case 'tel': {
      const raw = (value as string).replace(/^tel:/, '')
      if (!/^\+?\d[\d\s\-()]{4,}$/.test(raw)) {
        return 'Please enter a valid phone number'
      }
      break
    }
  }

  return true
}

const LINK_TYPE_OPTIONS = [
  { label: 'Internal', value: 'internal' },
  { label: 'External', value: 'external' },
  { label: 'Reference', value: 'reference' },
  { label: 'Anchor', value: 'anchor' },
  { label: 'Mail To', value: 'mailto' },
  { label: 'TEL', value: 'tel' },
  { label: 'Custom', value: 'custom' },
]

const buildFeaturedFields = (options?: MenuItemFieldOptions): Field[] => {
  const baseUrl = options?.baseUrl ?? ''
  const relationTo = options?.relationTo ?? ('pages' as CollectionSlug)
  const fields: Field[] = [
    {
      name: 'heading',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'ctaType',
      type: 'select',
      defaultValue: 'reference',
      label: 'CTA Link Type',
      options: LINK_TYPE_OPTIONS,
    },
    {
      name: 'ctaLabel',
      type: 'text',
      label: 'CTA Label',
    },
    {
      name: 'ctaUrl',
      type: 'text',
      admin: {
        ...(options?.disabled
          ? {}
          : {
              components: {
                Field: '@foundrykit/menu-plugin/client#UrlField',
              },
            }),
        condition: (_data, siblingData) => siblingData?.ctaType !== 'reference',
        custom: { baseUrl },
      },
      label: 'CTA URL',
      validate: validateUrl,
    },
    {
      name: 'ctaReference',
      type: 'relationship',
      admin: {
        condition: (_data, siblingData) => siblingData?.ctaType === 'reference',
      },
      ...(Array.isArray(relationTo) ? { hasMany: false, relationTo } : { relationTo }),
    } as Field,
    {
      name: 'ctaTarget',
      type: 'radio',
      defaultValue: '_self',
      label: 'CTA Open in',
      options: [
        { label: 'Same Tab', value: '_self' },
        { label: 'New Tab', value: '_blank' },
      ],
    },
  ]
  if (options?.mediaCollection) {
    fields.unshift({
      name: 'image',
      type: 'upload',
      relationTo: options.mediaCollection,
    } as Field)
  }
  return fields
}

/**
 * The simple-by-default link field set shared by every item that behaves like a
 * link: `label`, `type`, `reference`/`url`, plus the "Options" and "Advanced"
 * collapsible groups. No `itemType` and no nesting fields are included here.
 */
const buildLeafLinkFields = (options?: MenuItemFieldOptions): Field[] => {
  const baseUrl = options?.baseUrl ?? ''
  const relationTo = options?.relationTo ?? ('pages' as CollectionSlug)

  return [
    {
      name: 'type',
      type: 'select',
      admin: {
        description: 'Select the type of link for this menu item.',
      },
      defaultValue: 'reference',
      options: LINK_TYPE_OPTIONS,
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'label',
          type: 'text',
          admin: {
            width: '50%',
          },
          required: true,
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            ...(options?.disabled
              ? {}
              : {
                  components: {
                    Field: '@foundrykit/menu-plugin/client#UrlField',
                  },
                }),
            condition: (_data, siblingData) => {
              return siblingData?.type !== 'reference'
            },
            custom: { baseUrl },
            width: '50%',
          },
          label: 'URL',
          validate: validateUrl,
        },
        {
          name: 'reference',
          type: 'relationship',
          admin: {
            condition: (_data, siblingData) => {
              return siblingData?.type === 'reference'
            },
            width: '50%',
          },
          ...(Array.isArray(relationTo) ? { hasMany: false, relationTo } : { relationTo }),
        } as Field,
      ],
    },
    {
      type: 'collapsible',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'target',
          type: 'radio',
          defaultValue: '_self',
          label: 'Open in new tab',
          options: [
            { label: 'Same Tab', value: '_self' },
            { label: 'New Tab', value: '_blank' },
          ],
        },
        {
          name: 'displaySurface',
          type: 'select',
          admin: {
            description: 'Controls which navigation surfaces render this item.',
          },
          defaultValue: 'both',
          label: 'Display Surface',
          options: [
            { label: 'Navbar + Drawer (default)', value: 'both' },
            { label: 'Navbar Only', value: 'navbar' },
            { label: 'Drawer Only', value: 'drawer' },
          ],
        },
      ],
      label: 'Options',
    },
    {
      type: 'collapsible',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'visibility',
          type: 'radio',
          defaultValue: 'visible',
          options: [
            { label: 'Visible', value: 'visible' },
            { label: 'Invisible', value: 'invisible' },
          ],
        },
        {
          name: 'rel',
          type: 'text',
        },
        {
          name: 'roles',
          type: 'array',
          fields: [{ name: 'role', type: 'text' }],
        },
        {
          name: 'attrs',
          type: 'textarea',
        },
      ],
      label: 'Advanced',
    },
  ]
}

const isLink = (_data: any, siblingData: any) =>
  siblingData?.itemType !== 'dropdown' && siblingData?.itemType !== 'mega'

/**
 * Recursively gate a leaf link field so it only renders when the item behaves
 * like a link (i.e. `itemType` is not `dropdown`/`mega`). `label` always shows
 * (a dropdown/mega still needs a label) and `displaySurface` is always visible
 * regardless of `itemType`. Where there is no `itemType` sibling (e.g. mega
 * entries / children) `isLink` resolves to `true`, so gating is a no-op.
 */
const gateLinkField = (field: Field): Field => {
  if ('fields' in field && (field.type === 'row' || field.type === 'collapsible')) {
    return { ...field, fields: field.fields.map(gateLinkField) } as Field
  }

  if ('name' in field) {
    if (field.name === 'label' || field.name === 'displaySurface') {return field}
    const existingCondition = (field as any).admin?.condition
    return {
      ...field,
      admin: {
        ...(field as any).admin,
        condition: (_data: any, siblingData: any, extra: any) => {
          if (!isLink(_data, siblingData)) {return false}
          return existingCondition ? existingCondition(_data, siblingData, extra) : true
        },
      },
    } as Field
  }

  return field
}

const buildMegaConfigFields = (options?: MenuItemFieldOptions, currentDepth = 0): Field[] => {
  const dynamicSources = options?.dynamicSources ?? []
  const relationTo = options?.relationTo ?? ('pages' as CollectionSlug)

  const parentCollections = [...new Set(dynamicSources.map((source) => source.parentCollection))]
  const singleSource = dynamicSources.length === 1

  // Parent relationship: collapse to a single relationTo string when exactly one
  // source is configured, union when many, fall back to the link relationTo when
  // no dynamic sources are configured.
  const parentRelationTo: CollectionSlug | CollectionSlug[] =
    parentCollections.length === 1
      ? parentCollections[0]
      : parentCollections.length > 1
        ? parentCollections
        : relationTo

  const dynamicSourceOptions = dynamicSources.map((source) => ({
    label: source.label,
    value: source.name,
  }))

  const isMega = (_data: any, siblingData: any) => siblingData?.itemType === 'mega'

  return [
    {
      name: 'megaLayout',
      type: 'select',
      admin: {
        condition: isMega,
        description: 'How the mega menu is laid out. "Reveal" shows a flat list of rows that reveal their children in a second panel; "Columns" renders classic multi-column layout.',
      },
      defaultValue: 'reveal',
      label: 'Mega Menu Layout',
      options: [
        { label: 'Reveal (rows)', value: 'reveal' },
        { label: 'Columns', value: 'columns' },
      ],
    },
    {
      name: 'defaultFeatured',
      type: 'group',
      admin: {
        condition: isMega,
        description: 'Fallback featured panel shown when an entry does not provide its own.',
      },
      fields: buildFeaturedFields(options),
      label: 'Default Featured Panel',
    },
    {
      name: 'megaEntries',
      type: 'array',
      admin: {
        condition: isMega,
        description: 'A flat list of entries. Each entry is itself a link and can reveal children in a secondary panel.',
        ...(options?.disabled
          ? {}
          : {
              components: {
                RowLabel: '@foundrykit/menu-plugin/client#MegaEntryRowLabel',
              },
            }),
      },
      // Depth-aware, short dbName so the generated Postgres table/relation names
      // stay unique across nesting levels and well under the 63-char identifier
      // limit even when consumers raise `maxDepth`.
      dbName: `me${currentDepth}`,
      fields: [
        ...buildLeafLinkFields(options).map(gateLinkField),
        {
          name: 'source',
          type: 'select',
          admin: {
            description: 'Where this entry\'s children come from.',
          },
          defaultValue: 'manual',
          options: [
            { label: 'Manual', value: 'manual' },
            { label: 'Dynamic (from a related collection)', value: 'dynamic' },
          ],
          required: true,
        },
        {
          name: 'children',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.source !== 'dynamic',
            description: 'Items revealed in the secondary panel when this entry is hovered or selected.',
            ...(options?.disabled
              ? {}
              : {
                  components: {
                    RowLabel: '@foundrykit/menu-plugin/client#SubMenuItemRowLabel',
                  },
                }),
          },
          dbName: `mc${currentDepth}`,
          fields: buildLeafLinkFields(options).map(gateLinkField),
          label: 'Children',
        },
        {
          name: 'dynamicSource',
          type: 'select',
          admin: {
            condition: (_data, siblingData) => siblingData?.source === 'dynamic',
            // Hidden and auto-set when exactly one source is configured.
            hidden: singleSource,
          },
          ...(singleSource ? { defaultValue: dynamicSources[0]?.name } : {}),
          label: 'Dynamic Source',
          options: dynamicSourceOptions,
        },
        {
          name: 'parent',
          type: 'relationship',
          admin: {
            condition: (_data, siblingData) => siblingData?.source === 'dynamic',
            description: 'The parent document whose related children populate this entry.',
          },
          ...(Array.isArray(parentRelationTo)
            ? { hasMany: false, relationTo: parentRelationTo }
            : { relationTo: parentRelationTo }),
        } as Field,
        {
          name: 'featured',
          type: 'group',
          admin: {
            description: 'The featured panel shown alongside this entry\'s children.',
          },
          fields: [
            {
              name: 'mode',
              type: 'select',
              defaultValue: 'inherit',
              options: [
                { label: 'Inherit (use default featured)', value: 'inherit' },
                { label: 'Manual', value: 'manual' },
                { label: 'Dynamic (from the related source)', value: 'dynamic' },
              ],
            },
            ...buildFeaturedFields(options).map((field) => {
              if (!('name' in field)) {return field}
              const existingCondition = (field as any).admin?.condition
              return {
                ...field,
                admin: {
                  ...(field as any).admin,
                  condition: (_data: any, siblingData: any, extra: any) => {
                    if (siblingData?.mode !== 'manual') {return false}
                    return existingCondition ? existingCondition(_data, siblingData, extra) : true
                  },
                },
              } as Field
            }),
          ],
          label: 'Featured Panel',
        },
      ],
      label: 'Mega Menu Entries',
    },
  ]
}

export const createMenuItemFields = (options?: MenuItemFieldOptions, currentDepth = 0): Field[] => {
  const maxDepth = options?.maxDepth ?? 1
  const leafLinkFields = buildLeafLinkFields(options).map(gateLinkField)

  const canNest = currentDepth < maxDepth

  if (!canNest) {
    return leafLinkFields
  }

  return [
    {
      name: 'itemType',
      type: 'select',
      defaultValue: 'link',
      options: [
        { label: 'Link', value: 'link' },
        { label: 'Dropdown', value: 'dropdown' },
        { label: 'Mega Menu', value: 'mega' },
      ],
      required: true,
    },
    ...leafLinkFields,
    {
      name: currentDepth === 0 ? 'children' : `children_${currentDepth + 1}`,
      type: 'array',
      admin: {
        ...(options?.disabled
          ? {}
          : {
              components: {
                RowLabel: '@foundrykit/menu-plugin/client#SubMenuItemRowLabel',
              },
            }),
        condition: (_data, siblingData) => {
          return siblingData?.itemType === 'dropdown'
        },
      },
      fields: createMenuItemFields(options, currentDepth + 1),
      label: 'Children',
    },
    ...buildMegaConfigFields(options, currentDepth),
  ]
}

export const menuItemFields = createMenuItemFields()

export default menuItemFields
