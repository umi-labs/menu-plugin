'use client'

import type { TextFieldClientComponent } from 'payload'

import {
  FieldDescription,
  FieldError,
  FieldLabel,
  TextInput,
  useField,
  useFormFields,
} from '@payloadcms/ui'
import React, { useCallback, useEffect, useRef } from 'react'

import { COUNTRY_CODES } from './countryCodes.js'

const parseTelValue = (val: string): { code: string; number: string } => {
  if (!val || !val.startsWith('tel:')) return { code: '+1', number: '' }
  const raw = val.slice(4) // strip "tel:"
  const match = COUNTRY_CODES.find((c) => raw.startsWith(c.code))
  if (match) {
    return { code: match.code, number: raw.slice(match.code.length) }
  }
  return { code: '+1', number: raw }
}

export const UrlField: TextFieldClientComponent = ({ field, path: pathFromProps }) => {
  const fieldPath = pathFromProps ?? field.name
  const { setValue, showError, value } = useField<string>({ path: fieldPath })

  const baseUrl = (field.admin?.custom?.baseUrl as string) || ''

  // Compute sibling path for the 'type' field
  const pathParts = fieldPath.split('.')
  pathParts[pathParts.length - 1] = 'type'
  const typePath = pathParts.join('.')

  const menuItemType = useFormFields(([fields]) => {
    return (fields[typePath]?.value as string) ?? 'custom'
  })

  const prevTypeRef = useRef(menuItemType)

  // Clear value when type changes
  useEffect(() => {
    if (prevTypeRef.current !== menuItemType) {
      prevTypeRef.current = menuItemType
      setValue('')
    }
  }, [menuItemType, setValue])

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value)
    },
    [setValue],
  )

  const handleInternalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const path = e.target.value
      setValue(baseUrl + path)
    },
    [setValue, baseUrl],
  )

  const handleAnchorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const anchor = e.target.value.replace(/^#/, '')
      setValue(`#${anchor}`)
    },
    [setValue],
  )

  const handleMailtoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const email = e.target.value.replace(/^mailto:/, '')
      setValue(`mailto:${email}`)
    },
    [setValue],
  )

  const handleTelCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { number } = parseTelValue(value || '')
      setValue(`tel:${e.target.value}${number}`)
    },
    [setValue, value],
  )

  const handleTelNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { code } = parseTelValue(value || '')
      setValue(`tel:${code}${e.target.value}`)
    },
    [setValue, value],
  )

  // Parse display values from stored value
  const getInternalPath = (): string => {
    if (!value) return ''
    if (baseUrl && value.startsWith(baseUrl)) return value.slice(baseUrl.length)
    return value
  }

  const getAnchorValue = (): string => {
    if (!value) return ''
    return value.replace(/^#/, '')
  }

  const getMailtoValue = (): string => {
    if (!value) return ''
    return value.replace(/^mailto:/, '')
  }

  const renderInput = () => {
    switch (menuItemType) {
      case 'anchor':
        return (
          <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
            <span
              style={{
                alignItems: 'center',
                background: 'var(--theme-elevation-100)',
                borderRadius: '4px',
                display: 'flex',
                fontSize: '13px',
                padding: '0 8px',
                whiteSpace: 'nowrap',
              }}
            >
              #
            </span>
            <div style={{ flex: 1 }}>
              <TextInput
                onChange={handleAnchorChange}
                path={fieldPath}
                placeholder="section-name"
                value={getAnchorValue()}
              />
            </div>
          </div>
        )

      case 'external':
        return (
          <TextInput
            onChange={handleTextChange}
            path={fieldPath}
            placeholder="https://example.com"
            value={value || ''}
          />
        )

      case 'internal':
        return (
          <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
            <span
              style={{
                alignItems: 'center',
                background: 'var(--theme-elevation-100)',
                borderRadius: '4px',
                display: 'flex',
                fontSize: '13px',
                padding: '0 8px',
                whiteSpace: 'nowrap',
              }}
            >
              {baseUrl || '/'}
            </span>
            <div style={{ flex: 1 }}>
              <TextInput
                onChange={handleInternalChange}
                path={fieldPath}
                placeholder="/page-path"
                value={getInternalPath()}
              />
            </div>
          </div>
        )

      case 'mailto':
        return (
          <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
            <span
              style={{
                alignItems: 'center',
                background: 'var(--theme-elevation-100)',
                borderRadius: '4px',
                display: 'flex',
                fontSize: '13px',
                padding: '0 8px',
                whiteSpace: 'nowrap',
              }}
            >
              mailto:
            </span>
            <div style={{ flex: 1 }}>
              <TextInput
                onChange={handleMailtoChange}
                path={fieldPath}
                placeholder="user@example.com"
                value={getMailtoValue()}
              />
            </div>
          </div>
        )

      case 'reference':
        return null

      case 'tel': {
        const { code, number } = parseTelValue(value || '')
        return (
          <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
            <select
              onChange={handleTelCodeChange}
              style={{
                background: 'var(--theme-input-bg)',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '4px',
                color: 'var(--theme-text)',
                fontSize: '13px',
                padding: '8px',
              }}
              value={code}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <div style={{ flex: 1 }}>
              <TextInput
                onChange={handleTelNumberChange}
                path={fieldPath}
                placeholder="555-1234"
                value={number}
              />
            </div>
          </div>
        )
      }

      default:
        return (
          <TextInput
            onChange={handleTextChange}
            path={fieldPath}
            placeholder="Enter URL"
            value={value || ''}
          />
        )
    }
  }

  if (menuItemType === 'reference') {
    return null
  }

  return (
    <div
      style={
        {
          ...(field.admin?.width ? { '--field-width': field.admin.width } : { flex: '1 1 auto' }),
        } as React.CSSProperties
      }
    >
      <FieldLabel label={field.label || 'URL'} />
      {showError && <FieldError />}
      {renderInput()}
      {field.admin?.description && (
        <FieldDescription description={field.admin.description} path={fieldPath} />
      )}
    </div>
  )
}
