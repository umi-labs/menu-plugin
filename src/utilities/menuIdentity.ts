export const normalizeMenuLocale = (locale?: null | string): string | undefined => {
  const normalized = locale?.trim().toLowerCase()
  return normalized ? normalized : undefined
}

export const buildMenuIdentityKey = (slug: string, locale?: null | string): string => {
  return `${slug}::${normalizeMenuLocale(locale) || '__default'}`
}
