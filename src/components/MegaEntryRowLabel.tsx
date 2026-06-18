'use client'

import { useRowLabel } from '@payloadcms/ui'

export const MegaEntryRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ label?: string; source?: string }>()

  const suffix = data.source === 'dynamic' ? ' (dynamic)' : ''

  return <div>{`Entry: ${data.label || String(rowNumber).padStart(2, '0')}${suffix}`}</div>
}
