import type { CollectionSlug, Config } from 'payload'

import { menuCache } from './cache.js'
import { createMenusCollection } from './collections/Menus.js'
import { createExportMenusHandler } from './endpoints/exportMenusHandler.js'
import { createGetMenuHandler } from './endpoints/getMenuHandler.js'
import { createImportMenusHandler } from './endpoints/importMenusHandler.js'

export type MenuPluginConfig = {
  baseUrl?: string
  cacheTTL?: number
  disabled?: boolean
  enableImportExport?: boolean
  maxDepth?: number
  mediaCollection?: CollectionSlug
  relationTo?: CollectionSlug | CollectionSlug[]
  requireAdminForImportExport?: boolean
}

export const menuPlugin =
  (pluginOptions: MenuPluginConfig) =>
  (config: Config): Config => {
    const cacheTTL = pluginOptions.cacheTTL ?? 60_000
    const enableImportExport = pluginOptions.enableImportExport ?? true
    const requireAdminForImportExport = pluginOptions.requireAdminForImportExport ?? true

    menuCache.configure(cacheTTL)

    config.collections = [
      ...(config.collections || []),
      createMenusCollection({
        baseUrl: pluginOptions.baseUrl,
        disabled: pluginOptions.disabled,
        maxDepth: pluginOptions.maxDepth,
        mediaCollection: pluginOptions.mediaCollection,
        relationTo: pluginOptions.relationTo,
      }),
    ]

    if (pluginOptions.disabled) {
      return config
    }

    config.endpoints = [
      ...(config.endpoints || []),
      {
        handler: createGetMenuHandler(),
        method: 'get',
        path: '/api/menus/:slug',
      },
      ...(enableImportExport
        ? [
            {
              handler: createExportMenusHandler({ requireAdmin: requireAdminForImportExport }),
              method: 'get' as const,
              path: '/api/menus-export',
            },
            {
              handler: createImportMenusHandler({ requireAdmin: requireAdminForImportExport }),
              method: 'post' as const,
              path: '/api/menus-import',
            },
          ]
        : []),
    ]

    return config
  }
