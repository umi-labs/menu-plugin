import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Strip read-time-resolved data from dynamic mega entries before write.
 *
 * `createResolveDynamicMenuHook` (afterRead) fills each dynamic entry's
 * `children` by querying the related collection, setting every child's `id` to
 * the *related* document's id. The mega-children array is admin-hidden for
 * dynamic entries (`admin.condition: source !== 'dynamic'`), but `condition`
 * only hides the UI — the resolved rows remain in the admin form state and are
 * sent back on save. Payload then validates each row's `id` against the array's
 * own id column and rejects the foreign id with "The following field is invalid:
 * id" (HTTP 400).
 *
 * This `beforeChange` hook drops that resolved data so it is never persisted.
 * Dynamic children (and any dynamically-derived featured panel) are re-resolved
 * on every read, so they must not be stored. It runs before field validation
 * (`beforeChange` – Collection precedes `beforeChange` – Fields), so the offending
 * rows are gone before Payload validates them.
 */

type AnyDoc = Record<string, unknown>

const stripEntries = (items: unknown): void => {
  if (!Array.isArray(items)) {return}

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== 'object') {continue}
    const item = rawItem as AnyDoc

    // Recurse into dropdown children, same as the resolver's walker.
    if (item.itemType === 'dropdown') {
      stripEntries(item.children)
    }

    if (item.itemType !== 'mega' || !Array.isArray(item.megaEntries)) {continue}

    for (const rawEntry of item.megaEntries) {
      if (!rawEntry || typeof rawEntry !== 'object') {continue}
      const entry = rawEntry as AnyDoc
      if (entry.source !== 'dynamic') {continue}

      // Resolved children carry the related doc's id, not a valid array-row id.
      delete entry.children

      // A dynamically-derived featured panel is also resolved on read; keep only
      // its mode so the stored value doesn't masquerade as manual data.
      const featured = entry.featured as AnyDoc | undefined
      if (featured && featured.mode === 'dynamic') {
        entry.featured = { mode: 'dynamic' }
      }
    }
  }
}

/** Pure helper: mutate and return `data`, stripping resolved dynamic-entry data. */
export const stripDynamicMenuChildren = (data: AnyDoc | null | undefined): AnyDoc | null | undefined => {
  if (!data || typeof data !== 'object') {return data}
  stripEntries((data as AnyDoc).items)
  return data
}

/**
 * `beforeChange` collection hook that removes read-time-resolved data from
 * dynamic mega entries so foreign ids never reach Payload's id validation.
 */
export const stripDynamicMenuChildrenHook: CollectionBeforeChangeHook = ({ data }) =>
  stripDynamicMenuChildren(data as AnyDoc) as never
