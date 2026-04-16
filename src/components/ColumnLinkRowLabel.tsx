'use client'

import { useRowLabel } from '@payloadcms/ui'

export const ColumnLinkRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ label?: string }>()

  return <div>{`Link: ${data.label || String(rowNumber).padStart(2, '0')}`}</div>
}
