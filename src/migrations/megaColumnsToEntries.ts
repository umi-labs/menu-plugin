import type { Payload } from 'payload'

type AnyRecord = Record<string, unknown>

const toLeafChild = (link: AnyRecord): AnyRecord => {
  // Drop nesting-only fields; remaining leaf link fields are preserved as-is.
  const { children: _c, megaColumns: _mc, megaEntries: _me, subLinks: _sl, ...leaf } = link
  return leaf
}

const columnLinkToEntry = (link: AnyRecord): AnyRecord => {
  const { children: _c, megaColumns: _mc, megaEntries: _me, subLinks, ...leaf } = link
  const childSource = Array.isArray(subLinks) ? subLinks : []
  return {
    ...leaf,
    children: childSource.map((sub) => toLeafChild(sub as AnyRecord)),
    featured: { mode: 'inherit' },
    source: 'manual',
  }
}

/**
 * Transform a single mega item from the legacy `megaColumns` shape into the new
 * `megaEntries` shape. Idempotent: an item that already has `megaEntries` (or no
 * `megaColumns`) is returned unchanged.
 */
const migrateMegaItem = (item: AnyRecord, logger?: Payload['logger']): AnyRecord => {
  if (Array.isArray(item.megaEntries) || !Array.isArray(item.megaColumns)) {
    return item
  }

  const columns = item.megaColumns as AnyRecord[]
  const [primary, ...rest] = columns
  const entries: AnyRecord[] = []

  const pushColumnLinks = (column: AnyRecord | undefined) => {
    if (!column) {return}
    const links = Array.isArray(column.columnLinks) ? (column.columnLinks as AnyRecord[]) : []
    for (const link of links) {
      entries.push(columnLinkToEntry(link))
    }
  }

  pushColumnLinks(primary)
  for (const column of rest) {
    pushColumnLinks(column)
    if (column?.featured) {
      logger?.info?.(
        '[menu-plugin] Migration: dropping featured panel from a non-primary mega column (only the primary column maps to defaultFeatured).',
      )
    }
  }

  const { megaColumns: _mc, ...itemWithoutColumns } = item

  return {
    ...itemWithoutColumns,
    defaultFeatured: (primary?.featured as AnyRecord | undefined) ?? undefined,
    megaEntries: entries,
    megaLayout: 'reveal',
  }
}

const migrateItems = (items: unknown, logger?: Payload['logger']): { changed: boolean; items: unknown } => {
  if (!Array.isArray(items)) {return { changed: false, items }}

  let changed = false
  const migrated = items.map((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object') {return rawItem}
    const item = rawItem as AnyRecord

    if (item.itemType === 'dropdown') {
      const result = migrateItems(item.children, logger)
      if (result.changed) {
        changed = true
        return { ...item, children: result.items }
      }
      return item
    }

    if (item.itemType === 'mega' && Array.isArray(item.megaColumns) && !Array.isArray(item.megaEntries)) {
      changed = true
      return migrateMegaItem(item, logger)
    }

    return item
  })

  return { changed, items: migrated }
}

/**
 * Determine whether a menu document still contains legacy `megaColumns` data.
 */
const docNeedsMigration = (items: unknown): boolean => {
  if (!Array.isArray(items)) {return false}
  return items.some((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object') {return false}
    const item = rawItem as AnyRecord
    if (item.itemType === 'mega' && Array.isArray(item.megaColumns) && !Array.isArray(item.megaEntries)) {
      return true
    }
    if (item.itemType === 'dropdown') {return docNeedsMigration(item.children)}
    return false
  })
}

export { docNeedsMigration as menuDocNeedsMegaColumnsMigration, migrateItems as migrateMenuItemsMegaColumns }

/**
 * Migrate every `menus` document from the legacy `megaColumns` mega structure to
 * the new `megaEntries` shape. Safe to run multiple times — already-migrated
 * documents are skipped.
 */
export const migrateMegaColumnsToEntries = async (payload: Payload): Promise<{
  migrated: number
  scanned: number
}> => {
  const { docs } = await payload.find({
    collection: 'menus',
    depth: 0,
    limit: 0,
    pagination: false,
  })

  let migrated = 0

  for (const doc of docs) {
    const record = doc as AnyRecord
    if (!docNeedsMigration(record.items)) {continue}

    const { items } = migrateItems(record.items, payload.logger)

    await payload.update({
      id: record.id as string,
      collection: 'menus',
      data: { items } as never,
    })
    migrated += 1
  }

  return { migrated, scanned: docs.length }
}
