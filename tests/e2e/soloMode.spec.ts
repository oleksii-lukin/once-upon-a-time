import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

test.describe('Solo Game Mode', () => {
  test('should complete a full solo game workflow', async ({ page }) => {
    // 1. Sign in using Clerk testing helper
    await page.goto('/en');
    await clerk.signIn({
      page,
      signInParams: {
        strategy: 'password',
        identifier: process.env.E2E_USER_EMAIL!,
        password: process.env.E2E_USER_PASSWORD!,
      },
    });

    // 2. Navigate to lobbies
    await page.goto('/en/lobbies');
    await expect(page).toHaveURL(/\/lobbies/);

    // 3. Create a new lobby with Solo mode
    await page.getByRole('button', { name: /Create Lobby/i }).click();

    // Select Solo mode in settings
    const modeSelect = page.getByLabel(/Game Mode/i);
    await modeSelect.selectOption('solo');

    // Turn off pacing delay and turn timer as requested
    const pacingCheckbox = page.getByLabel(/Enable Pacing Delay/i);
    if (await pacingCheckbox.isChecked()) {
      await pacingCheckbox.uncheck();
    }

    // Start Game
    await page.getByRole('button', { name: /Start Game/i }).click();

    // 4. Verify Game started
    await expect(page).toHaveURL(/\/game\//);

    // 5. Verify initial hand: 5 story cards + 1 ending card
    await expect(page.locator('text=Story Cards')).toBeVisible();

    // 6. Play 5 story cards
    for (let i = 0; i < 5; i++) {
      // Select a story card
      await page.locator('.card-item:not(.type-ending)').first().click();

      // Click Play Card button
      await page.getByRole('button', { name: /Play Card/i }).click();
    }

    // 7. Play ending card
    await page.locator('.card-item.type-ending').first().click();
    await page.getByRole('button', { name: /Play Ending/i }).click();

    // 8. Verify winning screen
    await expect(page.locator('text=Congratulations')).toBeVisible();
    await expect(page.getByRole('button', { name: /Return to Lobbies/i })).toBeVisible();
  });
});
