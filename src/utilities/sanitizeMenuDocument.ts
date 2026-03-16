export const sanitizeMenuDocument = <T extends Record<string, unknown>>(menu: T): T => {
  const { slugLocaleKey: _slugLocaleKey, ...sanitized } = menu
  return sanitized as T
}
