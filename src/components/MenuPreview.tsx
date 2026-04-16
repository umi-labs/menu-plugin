'use client'

import { useAllFormFields, useWatchForm } from '@payloadcms/ui'
import React, { useMemo } from 'react'

type MenuItem = {
  children?: MenuItem[]
  itemType?: string
  label?: string
  type?: string
  url?: string
}

const TreeItem: React.FC<{ depth?: number; item: MenuItem }> = ({ depth = 0, item }) => {
  const indent = depth * 16
  const isDropdown = item.itemType === 'dropdown'

  return (
    <div style={{ paddingLeft: `${indent}px` }}>
      <div
        style={{
          alignItems: 'center',
          borderBottom: '1px solid var(--theme-elevation-100)',
          display: 'flex',
          gap: '6px',
          padding: '4px 0',
        }}
      >
        <span style={{ fontSize: '12px', opacity: 0.5 }}>{isDropdown ? '\u25BC' : '\u2192'}</span>
        <span style={{ fontSize: '13px', fontWeight: isDropdown ? 600 : 400 }}>
          {item.label || 'Untitled'}
        </span>
        {!isDropdown && item.type && (
          <span
            style={{
              background: 'var(--theme-elevation-100)',
              borderRadius: '3px',
              fontSize: '10px',
              padding: '1px 5px',
            }}
          >
            {item.type}
          </span>
        )}
      </div>
      {isDropdown &&
        Array.isArray(item.children) &&
        item.children.map((child, i) => <TreeItem depth={depth + 1} item={child} key={i} />)}
    </div>
  )
}

export const MenuPreview: React.FC = () => {
  const { getData } = useWatchForm()
  // Subscribe to all form fields so the component re-renders on any change
  const [fields] = useAllFormFields()

  const items = useMemo(() => {
    const data = getData()
    return (data?.items as MenuItem[]) || []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getData, fields])

  if (!items.length) {
    return (
      <div
        style={{
          color: 'var(--theme-elevation-500)',
          fontSize: '13px',
          padding: '12px 0',
        }}
      >
        Add items to see a preview.
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div
        style={{
          borderBottom: '1px solid var(--theme-elevation-150)',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '8px',
          paddingBottom: '6px',
        }}
      >
        Menu Structure
      </div>
      {items.map((item, i) => (
        <TreeItem item={item} key={i} />
      ))}
    </div>
  )
}
