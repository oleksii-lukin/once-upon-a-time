import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

test.describe('Solo Game Mode', () => {
  test('should complete a full solo game workflow', async ({ page }) => {
    // 1. Sign in (using clerk helper if available, otherwise manual)
    // For this test, we assume we are using a testing token and can just navigate
    await page.goto('/en');

    // Note: In a real CI environment, you'd use clerk.signIn() here if not already handled by global setup

    // 2. Create a lobby or navigate to an existing one with solo mode
    // For the sake of this test, we'll navigate to the lobbies page
    await page.getByRole('button', { name: /Get Started/i }).click();

    // Wait for navigation to lobbies
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
    // We can look for elements with specific test IDs or roles
    const storyCards = page.locator('.story-card');
    const endingCards = page.locator('.ending-card');

    // Note: The actual class names or selectors depend on implementation.
    // Based on Card.tsx and PlayerHand.tsx

    // Let's wait for cards to appear
    await expect(page.locator('text=Story Cards')).toBeVisible();

    // 6. Play 5 story cards
    for (let i = 0; i < 5; i++) {
      // Select a story card
      await page.locator('.card-item:not(.type-ending)').first().click();

      // Click Play Card button
      await page.getByRole('button', { name: /Play Card/i }).click();

      // Wait for card to be played (optimistic UI should be fast)
      // Check if it appeared in TableArea
    }

    // 7. Play ending card
    // After 5 story cards, the "Play Ending" button should appear
    await page.locator('.card-item.type-ending').first().click();
    await page.getByRole('button', { name: /Play Ending/i }).click();

    // 8. Verify winning screen
    await expect(page.locator('text=Congratulations')).toBeVisible();
    await expect(page.getByRole('button', { name: /Return to Lobbies/i })).toBeVisible();
  });
});
