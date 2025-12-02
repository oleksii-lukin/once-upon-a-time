# Deck Creation Fix - Checklist

## ✅ Completed (Already Done)

- [x] Created database migration to fix RLS policies (`20251125000004_fix_decks_rls.sql`)
- [x] Created database migration to handle Clerk user IDs (`20251125000005_fix_clerk_user_ids.sql`)
- [x] Created database migration to replace unsafe auth.uid() (`20251125000006_replace_auth_uid.sql`)
- [x] Created database migration to simplify policy (`20251125000008_simplify_policy.sql`)
- [x] Applied all migrations to database
- [x] Updated `utils/supabase/client.ts` to accept auth tokens
- [x] Updated `utils/supabase/server.ts` to integrate Clerk auth
- [x] Updated `components/admin/NewDeckButton.tsx` with Clerk auth
- [x] Updated `components/admin/DeckEditor.tsx` with Clerk auth
- [x] Updated `components/lobby/CreateLobbyButton.tsx` to support both auth and guest
- [x] Added error handling and user feedback
- [x] Created documentation files

## ⏳ Required Actions (You Need to Do)

### 1. Configure Clerk JWT Template
- [ ] Go to https://dashboard.clerk.com
- [ ] Navigate to JWT Templates
- [ ] Click "New template" → Select "Supabase"
- [ ] Name it exactly: `supabase` (lowercase)
- [ ] Get Supabase Project URL from Supabase Dashboard → Settings → API
- [ ] Get Supabase JWT Secret from Supabase Dashboard → Settings → API → JWT Settings
- [ ] Enter both values in Clerk template
- [ ] Save the template

**Reference**: See `CLERK_JWT_SETUP.md` for detailed instructions

### 2. Test Deck Creation
- [ ] Sign in to your application
- [ ] Navigate to `/admin/decks`
- [ ] Click "New Deck" button
- [ ] Verify you're redirected to the deck editor (no errors)
- [ ] Check that the deck appears in the decks list

**Reference**: See `TESTING_GUIDE.md` for comprehensive testing

### 3. Test Card Operations
- [ ] On a deck editor page, add a new card
- [ ] Edit an existing card
- [ ] Delete a card
- [ ] Verify all operations work without errors

### 4. Verify Database Records (Optional)
- [ ] Go to Supabase Dashboard → Table Editor
- [ ] Open the `decks` table
- [ ] Verify `created_by` contains your Clerk user ID (starts with `user_`)
- [ ] Verify it's stored as text, not UUID

## 🔍 Verification Tests

Run these quick tests to ensure everything works:

### Test 1: JWT Token Generation
```javascript
// Run in browser console while signed in
const token = await window.Clerk.session.getToken({ template: 'supabase' });
console.log(token ? '✅ Token received' : '❌ No token');
```

### Test 2: Deck Creation
1. Click "New Deck" → Should redirect without errors
2. Check browser console → No error messages
3. Check Supabase dashboard → New deck exists with your user ID

### Test 3: Card Operations
1. Add card → Should appear in table
2. Edit card → Changes should save
3. Delete card → Should be removed

## 📋 Troubleshooting Checklist

If something doesn't work, check:

- [ ] Clerk JWT template name is exactly `supabase` (lowercase)
- [ ] JWT Secret in Clerk matches Supabase JWT Secret
- [ ] Supabase Project URL in Clerk is correct
- [ ] You're signed in to the application
- [ ] You've signed out and back in after configuring the template
- [ ] Browser console shows no Clerk errors
- [ ] All migrations have been applied (`npx supabase db push`)

## 📚 Documentation Reference

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `README_FIX.md` | Executive summary | Start here for overview |
| `CLERK_JWT_SETUP.md` | Clerk configuration | When setting up JWT template |
| `TESTING_GUIDE.md` | Testing instructions | When testing the fix |
| `DECK_CREATION_FIX.md` | Technical details | For understanding the changes |
| `scripts/test_clerk_jwt.js` | JWT test script | For debugging JWT issues |

## 🎯 Success Criteria

You're done when:

- ✅ Clerk JWT template is configured
- ✅ You can create decks without errors
- ✅ You can add/edit/delete cards without errors
- ✅ Database records show your Clerk user ID in `created_by`
- ✅ No authentication or RLS errors in console

## ⏱️ Estimated Time

- Clerk JWT setup: **5-10 minutes**
- Testing: **5 minutes**
- **Total: 10-15 minutes**

## 🆘 Need Help?

If you're stuck:
1. Check browser console for error messages
2. Review `TESTING_GUIDE.md` troubleshooting section
3. Verify Clerk and Supabase configuration match
4. Try signing out and back in
5. Check that migrations are applied

---

**Current Status**: Code complete ✅ | Configuration needed ⏳
**Next Step**: Configure Clerk JWT template (see `CLERK_JWT_SETUP.md`)
