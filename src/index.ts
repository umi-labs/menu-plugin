import type { CollectionSlug, Config } from 'payload'

import { createMenusCollection } from './collections/Menus.js'
import { exportMenusHandler } from './endpoints/exportMenusHandler.js'
import { getMenuHandler } from './endpoints/getMenuHandler.js'
import { importMenusHandler } from './endpoints/importMenusHandler.js'

export type MenuPluginConfig = {
  baseUrl?: string
  disabled?: boolean
  maxDepth?: number
  relationTo?: CollectionSlug | CollectionSlug[]
}

export const menuPlugin =
  (pluginOptions: MenuPluginConfig) =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    config.collections.push(
      createMenusCollection({
        baseUrl: pluginOptions.baseUrl,
        maxDepth: pluginOptions.maxDepth,
        relationTo: pluginOptions.relationTo,
      }),
    )

    if (pluginOptions.disabled) {
      return config
    }

    if (!config.endpoints) {
      config.endpoints = []
    }

    config.endpoints.push({
      handler: getMenuHandler,
      method: 'get',
      path: '/api/menus/:slug',
    })

    config.endpoints.push({
      handler: exportMenusHandler,
      method: 'get',
      path: '/api/menus-export',
    })

    config.endpoints.push({
      handler: importMenusHandler,
      method: 'post',
      path: '/api/menus-import',
    })

    return config
  }
