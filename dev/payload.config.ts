import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { menuPlugin } from 'menu-plugin'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const buildConfigWithMemoryDB = async () => {
  if (process.env.NODE_ENV === 'test') {
    const memoryDB = await MongoMemoryReplSet.create({
      replSet: {
        count: 1,
        dbName: 'payloadmemory',
      },
    })

    process.env.DATABASE_URL = `${memoryDB.getUri()}&retryWrites=true`
  }

  return buildConfig({
    admin: {
      importMap: {
        baseDir: path.resolve(dirname),
      },
    },
    collections: [
      {
        slug: 'pages',
        fields: [],
      },
      {
        slug: 'posts',
        fields: [],
      },
      {
        slug: 'media',
        fields: [],
        upload: {
          staticDir: path.resolve(dirname, 'media'),
        },
      },
      {
        slug: 'destinations',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'slug', type: 'text' },
          { name: 'summary', type: 'textarea' },
          { name: 'image', type: 'upload', relationTo: 'media' },
        ],
      },
      {
        slug: 'locations',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'slug', type: 'text' },
          { name: 'destination', type: 'relationship', relationTo: 'destinations' },
        ],
      },
    ],
    db: mongooseAdapter({
      ensureIndexes: true,
      url: process.env.DATABASE_URL || '',
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload)
    },
    plugins: [
      menuPlugin({
        baseUrl: process.env.PRODUCTION_URL || '',
        dynamicSources: [
          {
            name: 'destinations',
            collection: 'locations',
            featured: {
              descriptionField: 'summary',
              headingField: 'title',
              imageField: 'image',
            },
            hrefBuilder: (doc) => `/locations/${(doc as { slug?: string }).slug ?? ''}`,
            label: 'Destinations',
            labelField: 'title',
            parentCollection: 'destinations',
            parentField: 'destination',
            sort: 'title',
          },
        ],
        mediaCollection: 'media',
        relationTo: ['pages', 'posts'],
      }),
    ],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}

export default buildConfigWithMemoryDB()
