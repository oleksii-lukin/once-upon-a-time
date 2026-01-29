# Playwright + Clerk Testing Setup

This project uses `@clerk/testing` for E2E tests with Playwright. Testing is handled programmatically using Testing Tokens retrieved via the Clerk Backend API.

## 1. Prerequisites (Clerk Dashboard)

Ensure the following are configured in your [Clerk Dashboard](https://dashboard.clerk.com/):

1.  **Authentication**: Enable **Email/Password** or **Username/Password** under **Authentication** -> **Sign-up, Sign-in & Profile**.
2.  **API Keys**: You will need your **Publishable Key** and **Secret Key** from the **API Keys** section.

## 2. Programmatic Setup

The integration is already configured in this repository:
- `tests/e2e/global.setup.ts` calls `clerkSetup()`, which automatically retrieves a short-lived Testing Token.
- `playwright.config.ts` is configured to run the setup before any tests.

## 3. Set Environment Variables

Provide your Clerk API keys for the test runner. These should be set in your `.env.local` or your environment.

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

For automated authenticated flows, you may also need test user credentials:

```bash
E2E_USER_EMAIL=test@example.com
E2E_USER_PASSWORD=password123
```

## 4. Reusable Authentication State (Optional)

To speed up tests by avoiding sign-in for every test:

1.  Create a storage directory:
    ```bash
    mkdir -p playwright/.clerk
    ```
2.  Follow the [Clerk Documentation on Authenticated Flows](https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows) to save and reuse session state.

## 5. Install Dependencies

Install the required dependencies and Playwright browsers:

```bash
# Install project dependencies
pnpm i

# Install Playwright system dependencies (for Linux)
pnpm exec playwright install-deps

# Install Playwright browsers
# (you may need to re-run this regularly when Playwright browsers get updated)
# (tests will fail with an error informing you about updates)
pnpm exec playwright install
```

## 6. Running Tests

To run the Playwright tests:

```bash
pnpm test:e2e
```

To run with the UI:

```bash
pnpm test:e2e:ui
```

## 7. References

- [Clerk Testing Documentation](https://clerk.com/docs/guides/development/testing/playwright/overview)
- [Test Authenticated Flows](https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows)
- [Clerk Playwright Helpers](https://clerk.com/docs/guides/development/testing/playwright/test-helpers)
