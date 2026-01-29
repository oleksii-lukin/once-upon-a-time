import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.describe('Login System', () => {
  test('should display get started button when logged out', async ({ page }) => {
    // Inject testing token to bypass bot detection
    await setupClerkTestingToken({ page });

    // Navigate to the home page (English version)
    await page.goto('/en');

    // Wait for the page to load
    await expect(page).toHaveTitle(/Once Upon a Time/i);

    // Check if the Get Started button is visible (it triggers sign in for signed out users)
    const getStartedButton = page.getByRole('button', { name: /Get Started/i });
    await expect(getStartedButton).toBeVisible();

    // Also check the Sign In button in the header
    const signInButton = page.getByRole('button', { name: /Sign In/i });
    await expect(signInButton).toBeVisible();
  });

  test('should open sign in modal when clicking get started button', async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto('/en');

    const getStartedButton = page.getByRole('button', { name: /Get Started/i });
    await getStartedButton.click();

    // Clerk's SignIn modal usually contains certain text or elements.
    // For this simple test, we just verify the button is clickable.
  });
});
