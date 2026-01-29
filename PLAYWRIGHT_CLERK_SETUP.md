# Playwright + Clerk Testing Setup

This project uses `@clerk/testing` for E2E tests with Playwright. To run these tests successfully, you need to configure your Clerk dashboard and set up the necessary environment variables.

## 1. Enable Testing Tokens in Clerk Dashboard

Testing Tokens are required for bypass bot detection during automated tests.

1.  Go to your [Clerk Dashboard](https://dashboard.clerk.com/).
2.  Select your application.
3.  Navigate to **Settings** -> **Advanced** -> **Security**.
4.  Enable **Testing tokens**.

## 2. Configure Authentication

Ensure that **Username and Password** authentication is enabled in your Clerk Dashboard under **Authentication** -> **Sign-up, Sign-in & Profile**.

## 3. Set Environment Variables

You need to provide your Clerk API keys for the test runner. These should be set in your `.env.local` or directly in your environment.

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

For the automated tests to run authenticated flows, you might also need a test user credentials:

```bash
E2E_USER_EMAIL=test@example.com
E2E_USER_PASSWORD=password123
```

## 4. Running Tests

To run the Playwright tests:

```bash
pnpm test:e2e
```

To run with the UI:

```bash
pnpm test:e2e:ui
```

## 5. References

- [Clerk Testing Documentation](https://clerk.com/docs/guides/development/testing/playwright/overview)
- [Clerk Playwright Helpers](https://clerk.com/docs/guides/development/testing/playwright/test-helpers)
