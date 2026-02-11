'use client'

import { useRowLabel } from '@payloadcms/ui'

export const MenuItemRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ label?: string }>()

  const customLabel = `Menu Item: ${data.label || String(rowNumber).padStart(2, '0')}`

  return <div>{customLabel}</div>
}
