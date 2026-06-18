import type { CollectionAfterReadHook, Payload, PayloadRequest } from 'payload'

import type { DynamicSource } from '../types.js'

export type ResolveDynamicMenuOptions = {
  /** depth used when querying children (kept low to bound relationship population) */
  childrenDepth?: number
  dynamicSources?: DynamicSource[]
}

const getByPath = (doc: Record<string, unknown> | undefined, path?: string): unknown => {
  if (!doc || !path) {return undefined}
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, doc)
}

const extractParentId = (parent: unknown): string | undefined => {
  if (!parent) {return undefined}
  if (typeof parent === 'string' || typeof parent === 'number') {return String(parent)}
  if (typeof parent === 'object') {
    // Polymorphic relationship: { relationTo, value }
    if ('value' in parent) {
      const value = (parent as { value: unknown }).value
      if (value && typeof value === 'object' && 'id' in value) {
        return String((value as { id: unknown }).id)
      }
      return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : undefined
    }
    if ('id' in parent) {return String((parent as { id: unknown }).id)}
  }
  return undefined
}

const resolveFeaturedFromDoc = (
  doc: Record<string, unknown> | undefined,
  featured?: DynamicSource['featured'],
): Record<string, unknown> | undefined => {
  if (!doc || !featured) {return undefined}

  const image = getByPath(doc, featured.imageField)
  const heading = getByPath(doc, featured.headingField)
  const description = getByPath(doc, featured.descriptionField)

  // Omit the featured object entirely when none of the meaningful fields resolve.
  if (image === undefined && heading === undefined && description === undefined) {
    return undefined
  }

  const resolved: Record<string, unknown> = {}
  if (image !== undefined) {resolved.image = image}
  if (heading !== undefined) {resolved.heading = heading}
  if (description !== undefined) {resolved.description = description}
  if (featured.ctaHrefBuilder) {
    try {
      resolved.ctaUrl = featured.ctaHrefBuilder(doc)
    } catch {
      // ignore CTA build failures
    }
  }
  if (featured.ctaLabel) {resolved.ctaLabel = featured.ctaLabel}

  return resolved
}

const resolveEntry = async ({
  childrenDepth,
  entry,
  locale,
  payload,
  req,
  source,
}: {
  childrenDepth: number
  entry: Record<string, unknown>
  locale: string | undefined
  payload: Payload
  req: PayloadRequest
  source: DynamicSource
}): Promise<void> => {
  const parentId = extractParentId(entry.parent)

  if (!parentId) {
    entry.children = []
    return
  }

  const result = await payload.find({
    collection: source.collection,
    depth: childrenDepth,
    // Default to unlimited (Payload treats `0` as "return all") so menus are
    // never silently truncated to Payload's default page size of 10.
    limit: source.limit ?? 0,
    locale: locale as never,
    req,
    sort: source.sort,
    where: {
      [source.parentField]: { equals: parentId },
    },
  })

  entry.children = result.docs.map((doc) => {
    const record = doc as Record<string, unknown>
    const child: Record<string, unknown> = {
      id: record.id,
      type: 'custom',
      label: getByPath(record, source.labelField),
      source: 'manual',
      url: source.hrefBuilder(record),
    }
    if (source.featured) {
      const childFeatured = resolveFeaturedFromDoc(record, source.featured)
      if (childFeatured) {child.featured = { ...childFeatured, mode: 'manual' }}
    }
    return child
  })

  // Resolve the entry-level featured panel from the parent doc (or first child)
  // when the entry is configured to derive it dynamically.
  const featuredMode = (entry.featured as Record<string, unknown> | undefined)?.mode
  if (featuredMode === 'dynamic' && source.featured) {
    let parentDoc = entry.parent as Record<string, unknown> | undefined
    if (!parentDoc || typeof parentDoc !== 'object' || !('id' in parentDoc)) {
      try {
        parentDoc = (await payload.findByID({
          id: parentId,
          collection: source.parentCollection,
          depth: childrenDepth,
          locale: locale as never,
          req,
        })) as Record<string, unknown>
      } catch {
        parentDoc = undefined
      }
    }
    const resolvedFeatured =
      resolveFeaturedFromDoc(parentDoc, source.featured) ??
      resolveFeaturedFromDoc(result.docs[0] as Record<string, unknown>, source.featured)
    if (resolvedFeatured) {
      entry.featured = { ...resolvedFeatured, mode: 'dynamic' }
    }
  }
}

const walkItems = async ({
  childrenDepth,
  items,
  locale,
  payload,
  req,
  soleSource,
  sourcesByName,
}: {
  childrenDepth: number
  items: unknown
  locale: string | undefined
  payload: Payload
  req: PayloadRequest
  soleSource?: DynamicSource
  sourcesByName: Map<string, DynamicSource>
}): Promise<void> => {
  if (!Array.isArray(items)) {return}

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== 'object') {continue}
    const item = rawItem as Record<string, unknown>

    // Recurse into dropdown children.
    if (item.itemType === 'dropdown') {
      await walkItems({
        childrenDepth,
        items: item.children,
        locale,
        payload,
        req,
        soleSource,
        sourcesByName,
      })
    }

    if (item.itemType !== 'mega' || !Array.isArray(item.megaEntries)) {continue}

    for (const rawEntry of item.megaEntries) {
      if (!rawEntry || typeof rawEntry !== 'object') {continue}
      const entry = rawEntry as Record<string, unknown>
      if (entry.source !== 'dynamic') {continue}

      const source =
        (typeof entry.dynamicSource === 'string'
          ? sourcesByName.get(entry.dynamicSource)
          : undefined) ?? soleSource

      if (!source) {
        payload.logger?.warn?.(
          `[menu-plugin] Unknown dynamic source "${String(entry.dynamicSource)}"; resolving to empty children.`,
        )
        entry.children = []
        continue
      }

      try {
        await resolveEntry({ childrenDepth, entry, locale, payload, req, source })
      } catch (error) {
        payload.logger?.error?.(
          `[menu-plugin] Failed to resolve dynamic menu entry from source "${source.name}": ${String(error)}`,
        )
        entry.children = []
      }
    }
  }
}

/**
 * Build an `afterRead` collection hook that expands dynamic mega entries by
 * querying their configured related collection. Read-only, idempotent, locale
 * aware, and degrades to empty children on any misconfiguration or error.
 */
export const createResolveDynamicMenuHook = (
  options?: ResolveDynamicMenuOptions,
): CollectionAfterReadHook => {
  const dynamicSources = options?.dynamicSources ?? []
  const childrenDepth = options?.childrenDepth ?? 1
  const sourcesByName = new Map(dynamicSources.map((source) => [source.name, source]))
  const soleSource = dynamicSources.length === 1 ? dynamicSources[0] : undefined

  return async ({ doc, req }) => {
    if (!doc || typeof doc !== 'object') {return doc}
    if (dynamicSources.length === 0) {return doc}

    await walkItems({
      childrenDepth,
      items: (doc as Record<string, unknown>).items,
      locale: req?.locale ?? undefined,
      payload: req.payload,
      req,
      soleSource,
      sourcesByName,
    })

    return doc
  }
}
