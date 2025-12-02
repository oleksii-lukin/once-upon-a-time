# Debugging RLS Error (42501)

You are seeing `42501: new row violates row-level security policy`.
This means Supabase is rejecting your request, likely because it thinks you are **not logged in** (Anonymous).

## Step 1: Check Browser Console
1. Open your browser's developer console (F12).
2. Try to create a deck.
3. Look for a log starting with `🔌 createClient initialized with token: ...`

- **If you see "initialized WITHOUT token"**:
  - Clerk is not giving you a token. Try signing out and in again.

- **If you see "initialized WITH token"**:
  - The code is working, but Supabase is rejecting the token.
  - This is 99% caused by a **mismatched JWT Secret**.

## Step 2: Verify JWT Secret (Most Likely Cause)

The "Supabase JWT Secret" in Clerk **MUST** match the one in Supabase.

1. **Get the correct secret from Supabase:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Click **Settings** (gear icon) -> **API**
   - Scroll down to **JWT Settings**
   - Copy the **JWT Secret** (it's a long string)

2. **Update it in Clerk:**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Go to **JWT Templates**
   - Click on your `supabase` template
   - Paste the secret into the **Supabase JWT Secret** field
   - **Click Save**

## Step 3: Verify Template Name
- Ensure the template in Clerk is named exactly `supabase` (lowercase).

## Step 4: Check Debug Logs
Run this command in your terminal to see what Supabase sees:
```bash
npx tsx scripts/read_debug_logs.ts
```
- If `Role` is `anon`, your token is invalid or missing.
- If `Role` is `authenticated`, then the RLS policy itself is still wrong (unlikely, as we fixed it).
