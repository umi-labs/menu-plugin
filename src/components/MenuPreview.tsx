'use client'

import { useAllFormFields, useWatchForm } from '@payloadcms/ui'
import React, { useMemo } from 'react'

type MegaColumn = {
  columnTitle?: string
  columnLinks?: Array<{ label?: string; subLinks?: unknown[] }>
  featured?: { heading?: string }
}

type MenuItem = {
  [key: string]: unknown
  children?: MenuItem[]
  displaySurface?: string
  itemType?: string
  label?: string
  megaColumns?: MegaColumn[]
  type?: string
  url?: string
}

const getNestedChildren = (item: MenuItem): MenuItem[] | null => {
  if (Array.isArray(item.children)) return item.children as MenuItem[]
  for (let d = 2; d <= 10; d++) {
    const val = item[`children_${d}`]
    if (Array.isArray(val)) return val as MenuItem[]
  }
  return null
}

const TreeItem: React.FC<{ depth?: number; item: MenuItem }> = ({ depth = 0, item }) => {
  const indent = depth * 16
  const isDropdown = item.itemType === 'dropdown'
  const isMega = item.itemType === 'mega'

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
        <span style={{ fontSize: '12px', opacity: 0.5 }}>
          {isMega ? '\u25A6' : isDropdown ? '\u25BC' : '\u2192'}
        </span>
        <span style={{ fontSize: '13px', fontWeight: isDropdown || isMega ? 600 : 400 }}>
          {item.label || 'Untitled'}
        </span>
        {!isDropdown && !isMega && item.type && (
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
        {item.displaySurface && item.displaySurface !== 'both' && (
          <span
            style={{
              background: 'var(--theme-elevation-150)',
              borderRadius: '3px',
              fontSize: '10px',
              padding: '1px 5px',
            }}
          >
            {item.displaySurface}
          </span>
        )}
      </div>
      {isDropdown &&
        getNestedChildren(item)?.map((child, i) => <TreeItem depth={depth + 1} item={child} key={i} />)}
      {isMega &&
        Array.isArray(item.megaColumns) &&
        item.megaColumns.map((col, i) => (
          <div
            key={i}
            style={{
              borderBottom: '1px solid var(--theme-elevation-100)',
              paddingLeft: `${indent + 16}px`,
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                opacity: 0.6,
                padding: '3px 0',
              }}
            >
              {col.columnTitle || `Column ${i + 1}`}
            </div>
            {Array.isArray(col.columnLinks) &&
              col.columnLinks.map((link, j) => (
                <div key={j} style={{ fontSize: '12px', padding: '2px 0 2px 12px' }}>
                  {'\u2192'} {link.label || 'Untitled'}
                  {Array.isArray(link.subLinks) && link.subLinks.length > 0 && (
                    <span style={{ fontSize: '11px', opacity: 0.5 }}>
                      {' '}
                      ({link.subLinks.length} sub-links)
                    </span>
                  )}
                </div>
              ))}
            {col.featured?.heading && (
              <div style={{ fontSize: '11px', opacity: 0.5, padding: '2px 0 2px 12px' }}>
                {'\u2605'} Featured: {col.featured.heading}
              </div>
            )}
          </div>
        ))}
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
