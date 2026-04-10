import { expect, test } from '@playwright/test'
import { firstPaintMs, interactiveHud, interactiveSettingsDialog } from './helpers'

test.describe('smoke', () => {
  test('boot: root mounts without page error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => {
      errors.push(err.message)
    })
    await page.goto('/')
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: firstPaintMs })
    expect(errors, errors.join('; ')).toEqual([])
  })

  test('title screen dialog is visible', async ({ page }) => {
    await page.goto('/')
    await expect(
      interactiveHud(page).getByRole('dialog', { name: 'Title screen' }),
    ).toBeVisible({
      timeout: firstPaintMs,
    })
  })

  test('settings open and close via Escape and Resume', async ({ page }) => {
    await page.goto('/')
    await expect(
      interactiveHud(page).getByRole('dialog', { name: 'Title screen' }),
    ).toBeVisible({
      timeout: firstPaintMs,
    })
    await page.keyboard.press('Escape')
    const settings = interactiveSettingsDialog(page)
    await expect(settings).toBeVisible()
    await settings.getByRole('button', { name: 'Resume' }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0)
  })

  test('graphics quality select changes tier', async ({ page }) => {
    await page.goto('/')
    await expect(
      interactiveHud(page).getByRole('dialog', { name: 'Title screen' }),
    ).toBeVisible({
      timeout: firstPaintMs,
    })
    await page.keyboard.press('Escape')
    const settings = interactiveSettingsDialog(page)
    await expect(settings).toBeVisible()
    const quality = settings.getByLabel('Graphics quality')
    await quality.selectOption('low')
    await expect(quality).toHaveValue('low')
    await quality.selectOption('balanced')
    await expect(quality).toHaveValue('balanced')
  })
})

test.describe('title to hub', () => {
  test('Start skips Bobr intro and leaves title screen', async ({ page }) => {
    await page.goto('/')
    await expect(
      interactiveHud(page).getByRole('dialog', { name: 'Title screen' }),
    ).toBeVisible({
      timeout: firstPaintMs,
    })
    await interactiveHud(page).getByRole('button', { name: 'Start' }).click()
    const bobr = page.locator('img[src*="npc_bobr"]')
    await expect(bobr).toBeVisible({ timeout: 10_000 })
    await bobr.click()
    await expect(page.getByRole('dialog', { name: 'Title screen' })).toHaveCount(0, {
      timeout: 20_000,
    })
  })
})
