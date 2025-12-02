# Deck Creation RLS Fix - Summary

## Problem
When trying to create a new deck, you received these errors:

### Error 1: RLS Policy Violation
```json
{
    "code": "42501",
    "details": null,
    "hint": null,
    "message": "new row violates row-level security policy for table \"decks\""
}
```

### Error 2: UUID Type Mismatch
```json
{
    "code": "22P02",
    "details": null,
    "hint": null,
    "message": "invalid input syntax for type uuid: \"user_35y1FHxwT0DFzZgUaf3jciAl6VE\""
}
```

## Root Causes
1. **RLS Policy Issue**: Supabase's Row-Level Security (RLS) policies weren't properly integrated with Clerk authentication
2. **Type Mismatch**: Clerk user IDs are strings (e.g., `user_35y1FHxwT0DFzZgUaf3jciAl6VE`), but the database was expecting UUID format
3. **JWT Integration**: The Clerk JWT wasn't being passed to Supabase for authentication

## Changes Made

### 1. Database Migration (`20251125000004_fix_decks_rls.sql`)
- Updated the RLS policy to check for `auth.uid() is not null` instead of `auth.role() = 'authenticated'`
- Added a trigger to automatically set `created_by` field from `auth.uid()` when creating decks
- This ensures proper ownership tracking without requiring manual field setting

### 2. Database Migration (`20251125000005_fix_clerk_user_ids.sql`) 
- **Fixed the trigger function** to properly extract Clerk user IDs from JWT using `(auth.jwt() -> 'sub')::text`
- This handles Clerk's string-based user IDs (e.g., `user_35y1FHxwT0DFzZgUaf3jciAl6VE`)
- Updated RLS policies to use the same JWT extraction method
- The `created_by` column was already changed to `text` type in migration `20251125000002_fix_auth_ids.sql`

### 3. Database Migration (`20251125000006_replace_auth_uid.sql`)
- **CRITICAL FIX**: Replaced ALL usages of `auth.uid()` with `(auth.jwt() ->> 'sub')`
- **Reason**: The built-in `auth.uid()` function tries to cast the user ID to a UUID. Since Clerk IDs are strings (not UUIDs), calling `auth.uid()` causes an immediate "invalid input syntax for type uuid" error, even if you're just checking for null.
- This migration updates all policies for decks, cards, lobbies, and players to use the safe text-based ID extraction.

### 4. Client-Side Supabase Integration (`utils/supabase/client.ts`)
- Updated `createClient()` to accept an optional `supabaseAccessToken` parameter
- When a token is provided, it's included in the Authorization header for all requests
- This allows client components to authenticate with Supabase using Clerk tokens

### 3. Server-Side Supabase Integration (`utils/supabase/server.ts`)
- Integrated Clerk's `auth()` function to fetch the Supabase JWT template token
- Automatically includes the token in the Authorization header for server-side requests
- Ensures all server components are authenticated with Supabase

### 4. NewDeckButton Component (`components/admin/NewDeckButton.tsx`)
- Added `useAuth` hook from Clerk to get authentication token
- Fetches the Supabase token using `getToken({ template: 'supabase' })`
- Passes the token to `createClient()` for authenticated requests

## Required Clerk Configuration

**IMPORTANT**: For this to work, you need to configure a Clerk JWT template for Supabase:

1. Go to your Clerk Dashboard: https://dashboard.clerk.com
2. Navigate to **JWT Templates** in the sidebar
3. Click **New template** and select **Supabase**
4. Configure the template with your Supabase project details:
   - **Name**: `supabase`
   - **Supabase Project URL**: Your Supabase project URL
   - **Supabase JWT Secret**: Found in your Supabase project settings under API > JWT Settings > JWT Secret
5. Save the template

### How to Find Your Supabase JWT Secret:
1. Go to your Supabase Dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Scroll down to **JWT Settings**
5. Copy the **JWT Secret** value

## Testing
After configuring the Clerk JWT template:
1. Make sure you're signed in to your application
2. Navigate to `/admin/decks`
3. Click the "New Deck" button
4. You should be redirected to the new deck's edit page without errors

## Additional Notes
- The migration has already been applied to your database
- All Supabase client instances (both client and server) now support Clerk authentication
- The `created_by` field is automatically populated, so you don't need to set it manually
- Guest users (without authentication) won't be able to create decks, which is the intended behavior for admin functionality
