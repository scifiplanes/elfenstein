import { expect, test } from '@playwright/test'
import { firstPaintMs, goToVillageHub, interactiveHud } from './helpers'

test.describe('hub', () => {
  test('village cave enters dungeon and enables movement controls', async ({ page }) => {
    await goToVillageHub(page)
    const hud = interactiveHud(page)
    await hud.getByTestId('hub-hotspot-cave').click()
    await expect(hud.getByRole('button', { name: 'Step forward' })).toBeEnabled({
      timeout: firstPaintMs,
    })
  })

  test('tavern round-trip via Leave tavern', async ({ page }) => {
    await goToVillageHub(page)
    const hud = interactiveHud(page)
    await hud.getByTestId('hub-hotspot-tavern').click()
    const leave = hud.getByRole('button', { name: 'Leave tavern' })
    await expect(leave).toBeVisible({ timeout: 15_000 })
    await leave.click()
    await expect(hud.locator('img[src="/content/village.png"]')).toBeVisible({ timeout: 15_000 })
    await expect(leave).toBeHidden()
  })

  test('tavern innkeeper trade opens and closes', async ({ page }) => {
    await goToVillageHub(page)
    const hud = interactiveHud(page)
    await hud.getByTestId('hub-hotspot-tavern').click()
    await expect(hud.getByRole('button', { name: 'Leave tavern' })).toBeVisible({ timeout: 15_000 })
    await hud.getByTestId('hub-hotspot-innkeeper-trade').click()
    const tradeTitle = hud.getByText('Trade · Innkeeper')
    await expect(tradeTitle).toBeVisible({ timeout: 15_000 })
    await hud.getByRole('button', { name: 'Close' }).click()
    await expect(tradeTitle).toBeHidden({ timeout: 15_000 })
  })
})
