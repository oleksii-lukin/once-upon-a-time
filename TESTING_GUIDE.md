# Testing Guide for Deck Creation Fix

## Prerequisites
Before testing, ensure you have:
1. ✅ Configured the Clerk JWT template named "supabase" in your Clerk Dashboard
2. ✅ Applied all database migrations (already done)
3. ✅ You are signed in to your application

## Test 1: Verify Clerk JWT Configuration

### Option A: Browser Console Test
1. Open your application in the browser
2. Make sure you're signed in
3. Open the browser console (F12)
4. Copy and paste the contents of `scripts/test_clerk_jwt.js` into the console
5. Press Enter

**Expected Output:**
```
✅ Token received successfully!
✅ JWT Payload: { sub: "user_...", ... }
✅ Clerk user ID format is correct
```

**If you see errors:**
- ❌ "No token received" → The JWT template is not configured correctly in Clerk
- ❌ "Clerk is not loaded" → You're not signed in or Clerk is not initialized

### Option B: Manual Check in Clerk Dashboard
1. Go to https://dashboard.clerk.com
2. Select your application
3. Navigate to **JWT Templates** in the left sidebar
4. Verify you have a template named **"supabase"**
5. Click on it to verify:
   - Template name is exactly `supabase` (lowercase)
   - Supabase Project URL is set
   - JWT Secret is configured (from your Supabase project)

## Test 2: Create a New Deck

1. Navigate to `/admin/decks` in your application
2. Click the **"New Deck"** button
3. Wait for the operation to complete

**Expected Behavior:**
- ✅ You should be redirected to `/admin/decks/[deck-id]` 
- ✅ The new deck should appear in the decks list
- ✅ No error messages should appear

**Possible Errors:**

### Error: "Authentication required. Please sign in again."
**Cause:** No JWT token was received from Clerk
**Solution:** 
- Sign out and sign back in
- Verify the JWT template is configured correctly
- Check browser console for Clerk errors

### Error: "Failed to create deck: new row violates row-level security policy"
**Cause:** The JWT is not being properly validated by Supabase
**Solution:**
- Verify the JWT Secret in Clerk matches the one in Supabase
- Check that the JWT template is named exactly "supabase"
- Verify the Supabase Project URL in the Clerk template is correct

### Error: "Failed to create deck: invalid input syntax for type uuid"
**Cause:** The database migration didn't apply correctly
**Solution:**
- Run `npx supabase db push` again to ensure all migrations are applied
- Check the database schema to ensure `created_by` is type `text`, not `uuid`

## Test 3: Add Cards to a Deck

1. After creating a deck, you should be on the deck editor page
2. Fill in the card form:
   - Card Name: "Test Card"
   - Description: "This is a test card"
3. Click **"Add Card"**

**Expected Behavior:**
- ✅ The card should appear in the cards table
- ✅ The form should clear
- ✅ No error messages

**Possible Errors:**
Same as Test 2 - authentication issues will show similar error messages

## Test 4: Update and Delete Cards

1. Click on a card in the table to select it
2. Modify the card name
3. Click **"Update Card"**
4. Click **"Delete"** on a card

**Expected Behavior:**
- ✅ Updates should save successfully
- ✅ Deletions should remove the card
- ✅ No error messages

## Test 5: Verify Database Records

You can verify the data is being saved correctly by checking your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor**
3. Select the **decks** table
4. Check that:
   - New decks have `created_by` populated with your Clerk user ID (starts with `user_`)
   - The `created_by` field is a text string, not a UUID

## Troubleshooting

### Issue: Token is null or undefined
**Symptoms:** "Authentication required" errors
**Debug Steps:**
1. Check if you're signed in (look for user profile in UI)
2. Open browser console and check for Clerk errors
3. Verify Clerk is properly initialized in your app layout
4. Try signing out and back in

### Issue: RLS policy violations
**Symptoms:** "new row violates row-level security policy"
**Debug Steps:**
1. Verify JWT template configuration in Clerk
2. Check that the JWT Secret matches between Clerk and Supabase
3. Verify the template name is exactly "supabase"
4. Check browser Network tab to see if Authorization header is being sent

### Issue: UUID type errors
**Symptoms:** "invalid input syntax for type uuid"
**Debug Steps:**
1. Check database schema: `created_by` should be `text` type
2. Re-run migrations: `npx supabase db push`
3. Check the trigger function is created correctly

## Getting Help

If you're still experiencing issues:
1. Check the browser console for detailed error messages
2. Check the Network tab to see the actual requests being sent
3. Verify your Clerk and Supabase configurations match
4. Check the database logs in Supabase for more details

## Success Criteria

All tests pass when:
- ✅ You can create decks without errors
- ✅ Decks are saved with your Clerk user ID in `created_by`
- ✅ You can add, update, and delete cards
- ✅ No authentication or RLS errors appear
- ✅ The JWT token is being generated and sent correctly
