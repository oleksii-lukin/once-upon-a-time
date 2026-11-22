import { test, expect } from '@playwright/test'

test.describe('Login System', () => {
  test('should display get started button when logged out', async ({ page }) => {
    // Navigate to the home page (English version)
    await page.goto('/en')

    // Wait for the page to load
    await expect(page).toHaveTitle(/Once Upon a Time/i)

    // Check if the Get Started button is visible (it triggers sign in for signed out users)
    const getStartedButton = page.getByRole('button', { name: /Get Started/i })
    await expect(getStartedButton).toBeVisible()

    // Also check the Sign In button in the header
    const signInButton = page.getByRole('button', { name: /Sign In/i })
    await expect(signInButton).toBeVisible()
  })

  test('should open sign in modal when clicking get started button', async ({ page }) => {
    await page.goto('/en')

    const getStartedButton = page.getByRole('button', { name: /Get Started/i })
    await expect(getStartedButton).toBeVisible()

    // Clerk's JS loads from its CDN — under parallel dev load it can lag
    // behind the page render, and clicks before Clerk finishes init are
    // silent no-ops. Wait for the global to be ready, then verify the
    // modal interaction (Clerk's modal contains "Sign in" / "Continue").
    await page.waitForFunction(() => (window as any).Clerk?.loaded === true, { timeout: 20_000 })

    const clerkModal = page.locator('.cl-rootBox, .cl-card, :text("Sign in")').first()
    for (let attempt = 0; attempt < 3; attempt++) {
      await getStartedButton.click()
      if (await clerkModal.isVisible().catch(() => false)) break
      await page.waitForTimeout(1000)
    }
    await expect(clerkModal).toBeVisible()
  })
})
