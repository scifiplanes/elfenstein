import { expect, type Page } from '@playwright/test'

export const firstPaintMs = 60_000

/** Live HUD (`HudLayout` interactive); excludes `captureForPostprocess` duplicate (`data-capture="true"`). */
export const interactiveHud = (page: Page) => page.locator('[data-hud-root][data-capture="false"]')

/** Interactive settings modal; `SettingsMenu` is also mounted for HUD capture (second in DOM). */
export const interactiveSettingsDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Settings' }).first()

/** New run from title through Bobr skip to starting village hub (`/content/village.png`). */
export async function goToVillageHub(page: Page) {
  await page.goto('/')
  const hud = interactiveHud(page)
  await expect(hud.getByRole('dialog', { name: 'Title screen' })).toBeVisible({ timeout: firstPaintMs })
  await hud.getByRole('button', { name: 'Start' }).click()
  const bobr = page.locator('img[src*="npc_bobr"]')
  await expect(bobr).toBeVisible({ timeout: 10_000 })
  await bobr.click()
  await expect(page.getByRole('dialog', { name: 'Title screen' })).toHaveCount(0, { timeout: 20_000 })
  await expect(hud.locator('img[src="/content/village.png"]')).toBeVisible({ timeout: 15_000 })
}
