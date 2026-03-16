import type { PayloadRequest } from 'payload'

export const requireAdminUser = (req: PayloadRequest): Response | undefined => {
  const adminCollection = req.payload.config.admin?.user

  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (adminCollection && req.user.collection !== adminCollection) {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  return undefined
}
