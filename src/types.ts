import type { CollectionSlug } from 'payload'

/**
 * Configuration describing how a mega menu entry can auto-populate its children
 * (and optional featured content) from a related collection.
 */
export type DynamicSource = {
  /** collection queried for children */
  collection: CollectionSlug
  /** optional featured resolution from a child (or parent) doc */
  featured?: {
    ctaHrefBuilder?: (doc: Record<string, unknown>) => string
    ctaLabel?: string
    descriptionField?: string
    headingField?: string
    /** dot-path to an upload/media field */
    imageField?: string
  }
  /** build a child's href from its doc */
  hrefBuilder: (doc: Record<string, unknown>) => string
  /** label shown in the admin select */
  label: string
  /** field on a child doc used as its label */
  labelField: string
  /** optional limit on children */
  limit?: number
  /** stable id, stored in the `dynamicSource` field */
  name: string
  /** collection the editor picks a parent from */
  parentCollection: CollectionSlug
  /** field on `collection` relating each child to its parent */
  parentField: string
  /** sort applied to the children query (Payload sort string) */
  sort?: string
}
