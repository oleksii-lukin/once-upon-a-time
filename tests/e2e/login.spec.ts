import { test, expect } from '@playwright/test';

test.describe('Login System', () => {
  test('should display get started button when logged out', async ({ page }) => {
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
    await page.goto('/en');

    const getStartedButton = page.getByRole('button', { name: /Get Started/i });
    await getStartedButton.click();

    // Verify modal interaction
    // Clerk's modal usually contains "Sign in" or "Continue" text.
    // We look for a common Clerk element or text to confirm the modal opened.
    const clerkModal = page.locator('.cl-rootBox, .cl-card, :text("Sign in")').first();
    await expect(clerkModal).toBeVisible();
  });
});
