'use client'

import { useRowLabel } from '@payloadcms/ui'

export const MegaColumnRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ columnTitle?: string }>()

  return <div>{`Column: ${data.columnTitle || String(rowNumber).padStart(2, '0')}`}</div>
}
