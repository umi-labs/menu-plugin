import type { CollectionSlug, Field, Validate } from 'payload'

export type MenuItemFieldOptions = {
  baseUrl?: string
  disabled?: boolean
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
      name: 'ctaUrl',
      type: 'text',
      label: 'CTA URL',
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

const buildMegaColumnsField = (options?: MenuItemFieldOptions): Field => {
  const maxDepth = options?.maxDepth ?? 1
  return {
    name: 'megaColumns',
    type: 'array',
    dbName: 'mcols',
    label: 'Mega Menu Columns',
    admin: {
      condition: (_data, siblingData) => siblingData?.itemType === 'mega',
      ...(options?.disabled
        ? {}
        : {
            components: {
              RowLabel: '@foundrykit/menu-plugin/client#MegaColumnRowLabel',
            },
          }),
    },
    fields: [
      {
        name: 'columnTitle',
        type: 'text',
        label: 'Column Title',
        admin: { description: 'Optional heading displayed above this column.' },
      },
      {
        name: 'columnLinks',
        type: 'array',
        dbName: 'clinks',
        label: 'Column Links',
        admin: {
          ...(options?.disabled
            ? {}
            : {
                components: {
                  RowLabel: '@foundrykit/menu-plugin/client#ColumnLinkRowLabel',
                },
              }),
        },
        fields: [
          // leaf-level basicFields (canNest = false since currentDepth === maxDepth)
          ...createMenuItemFields(options, maxDepth),
          {
            name: 'subLinks',
            type: 'array',
            dbName: 'slinks',
            label: 'Sub Links',
            admin: {
              description: 'Items revealed in the secondary panel when this link is hovered or selected.',
              ...(options?.disabled
                ? {}
                : {
                    components: {
                      RowLabel: '@foundrykit/menu-plugin/client#SubMenuItemRowLabel',
                    },
                  }),
            },
            fields: createMenuItemFields(options, maxDepth),
          },
        ],
      },
      {
        name: 'featured',
        type: 'group',
        label: 'Featured Panel',
        admin: { description: 'Optional right-hand panel with image, title, description, and CTA.' },
        fields: buildFeaturedFields(options),
      },
    ],
  }
}

export const createMenuItemFields = (options?: MenuItemFieldOptions, currentDepth = 0): Field[] => {
  const baseUrl = options?.baseUrl ?? ''
  const maxDepth = options?.maxDepth ?? 1
  const relationTo = options?.relationTo ?? ('pages' as CollectionSlug)
  const basicFields: Field[] = [
    {
      type: 'row',
      fields: [
        {
          name: 'advancedOptions',
          type: 'radio',
          admin: {
            width: '33%',
          },
          defaultValue: 'default',
          options: [
            { label: 'Default', value: 'default' },
            { label: 'Advanced', value: 'advanced' },
          ],
          required: true,
        },
        {
          name: 'target',
          type: 'radio',
          admin: {
            width: '33%',
          },
          defaultValue: '_self',
          label: 'Open in new tab',
          options: [
            { label: 'Same Tab', value: '_self' },
            { label: 'New Tab', value: '_blank' },
          ],
        },
        {
          name: 'visibility',
          type: 'radio',
          admin: {
            condition: (_data, siblingData) => {
              return siblingData?.advancedOptions !== 'default'
            },
            width: '33%',
          },
          defaultValue: 'visible',
          options: [
            { label: 'Visible', value: 'visible' },
            { label: 'Invisible', value: 'invisible' },
          ],
        },
      ],
    },
    {
      name: 'displaySurface',
      type: 'select',
      defaultValue: 'both',
      label: 'Display Surface',
      admin: {
        description: 'Controls which navigation surfaces render this item.',
      },
      options: [
        { label: 'Navbar + Drawer (default)', value: 'both' },
        { label: 'Navbar Only', value: 'navbar' },
        { label: 'Drawer Only', value: 'drawer' },
      ],
    },
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
      name: 'rel',
      type: 'text',
      admin: {
        condition: (_data, siblingData) => {
          return siblingData?.advancedOptions !== 'default'
        },
      },
    },
    {
      name: 'roles',
      type: 'array',
      admin: {
        condition: (_data, siblingData) => {
          return siblingData?.advancedOptions !== 'default'
        },
      },
      fields: [{ name: 'role', type: 'text' }],
    },
    {
      name: 'attrs',
      type: 'textarea',
      admin: {
        condition: (_data, siblingData) => {
          return siblingData?.advancedOptions !== 'default'
        },
      },
    },
  ]

  const isLink = (_data: any, siblingData: any) =>
    siblingData?.itemType !== 'dropdown' && siblingData?.itemType !== 'mega'

  const linkFields: Field[] = basicFields.map((f) => {
    if ('type' in f && f.type === 'row') {
      return {
        ...f,
        fields: f.fields.map((child) => {
          if ('name' in child && child.name === 'label') return child
          return {
            ...child,
            admin: {
              ...child.admin,
              condition: (_data: any, siblingData: any, extra: any) => {
                const existingCondition = child.admin?.condition
                const linkVisible = isLink(_data, siblingData)
                if (!linkVisible) return false
                return existingCondition ? existingCondition(_data, siblingData, extra) : true
              },
            },
          }
        }),
      } as Field
    }

    if ('admin' in f || 'name' in f) {
      // displaySurface is always visible regardless of itemType
      if ('name' in f && (f as any).name === 'displaySurface') return f
      return {
        ...f,
        admin: {
          ...(f as any).admin,
          condition: (_data: any, siblingData: any, extra: any) => {
            const existingCondition = (f as any).admin?.condition
            const linkVisible = isLink(_data, siblingData)
            if (!linkVisible) return false
            return existingCondition ? existingCondition(_data, siblingData, extra) : true
          },
        },
      } as Field
    }

    return f
  })

  const canNest = currentDepth < maxDepth

  const fields: Field[] = canNest
    ? [
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
        ...linkFields,
        {
          name: 'children',
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
        },
        buildMegaColumnsField(options),
      ]
    : basicFields

  return fields
}

export const menuItemFields = createMenuItemFields()

export default menuItemFields
