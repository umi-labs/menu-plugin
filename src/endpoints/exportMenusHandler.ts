import type { PayloadHandler } from 'payload'

import { requireAdminUser } from '../utilities/requireAdminUser.js'
import { sanitizeMenuDocument } from '../utilities/sanitizeMenuDocument.js'

type ExportMenusHandlerOptions = {
  requireAdmin?: boolean
}

export const createExportMenusHandler =
  ({ requireAdmin = true }: ExportMenusHandlerOptions = {}): PayloadHandler =>
  async (req) => {
    const { payload } = req

    if (requireAdmin) {
      const authError = requireAdminUser(req)
      if (authError) return authError
    }

    const result = await payload.find({
      collection: 'menus',
      limit: 0,
      pagination: false,
    })

    return new Response(
      JSON.stringify(result.docs.map((doc) => sanitizeMenuDocument(doc as Record<string, unknown>)), null, 2),
      {
        headers: {
          'Content-Disposition': 'attachment; filename="menus-export.json"',
          'Content-Type': 'application/json',
        },
      },
    )
  }

export const exportMenusHandler = createExportMenusHandler()
