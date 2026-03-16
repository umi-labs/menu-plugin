import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const login = async (page: Page) => {
  await page.goto('/admin')
  await page.fill('#field-email', 'dev@payloadcms.com')
  await page.fill('#field-password', 'test')
  await page.click('.form-submit button')
  await expect(page).toHaveTitle(/Dashboard/)
}

test('shows the menu plugin collection create screen', async ({ page }) => {
  await login(page)

  await page.goto('/admin/collections/menus/create')

  await expect(page.getByLabel('Title')).toBeVisible()
  await expect(page.getByLabel('Slug')).toBeVisible()
  await expect(page.getByText('Menu Structure')).toBeVisible()
  await expect(page.getByText('Add items to see a preview.')).toBeVisible()
})

test('renders menu metadata fields on the create screen', async ({ page }) => {
  await login(page)

  await page.goto('/admin/collections/menus/create')

  await expect(page.getByLabel('Description')).toBeVisible()
  await expect(page.getByLabel('Locale')).toBeVisible()
})
