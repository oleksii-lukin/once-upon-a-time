# Clerk JWT Template Configuration - Quick Reference

## Step-by-Step Setup

### 1. Access Clerk Dashboard
- URL: https://dashboard.clerk.com
- Select your application from the list

### 2. Navigate to JWT Templates
- In the left sidebar, find **"JWT Templates"**
- Click on it to view existing templates

### 3. Create New Template
- Click **"New template"** button
- Select **"Supabase"** from the template options
  - If you don't see Supabase, select "Blank" and configure manually

### 4. Configure Template Settings

#### Basic Settings:
- **Name**: `supabase` (MUST be exactly this, lowercase)
- **Token Lifetime**: 60 seconds (default is fine)

#### Supabase Integration Settings:

You'll need two values from your Supabase project:

##### A. Supabase Project URL
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL** (looks like: `https://xxxxx.supabase.co`)

##### B. Supabase JWT Secret
1. In the same **Settings** → **API** page
2. Scroll down to **JWT Settings**
3. Copy the **JWT Secret** value (a long string)
   - ⚠️ Keep this secret! Don't commit it to version control

### 5. Enter Values in Clerk

In the Clerk JWT template configuration:
- **Supabase Project Reference ID**: Enter your Supabase project URL
- **Supabase JWT Secret**: Paste the JWT Secret from Supabase

### 6. Claims Configuration (if using Blank template)

If you're configuring manually, ensure these claims are set:

```json
{
  "aud": "authenticated",
  "exp": {{token.exp}},
  "iat": {{token.iat}},
  "iss": "https://your-supabase-project.supabase.co/auth/v1",
  "sub": "{{user.id}}",
  "email": "{{user.primary_email_address}}",
  "role": "authenticated"
}
```

### 7. Save and Test

- Click **"Save"** or **"Apply Changes"**
- The template is now active
- Test it using the testing guide in `TESTING_GUIDE.md`

## Verification Checklist

Before testing your application, verify:

- [ ] Template name is exactly `supabase` (lowercase, no spaces)
- [ ] Supabase Project URL is correct
- [ ] JWT Secret matches your Supabase project's JWT Secret
- [ ] Template is saved and active
- [ ] You've signed out and back in to your application (to get a fresh token)

## Common Mistakes

❌ **Template name is "Supabase" (capitalized)** → Must be lowercase `supabase`
❌ **Using Supabase Anon Key instead of JWT Secret** → Use the JWT Secret, not the anon key
❌ **Wrong Supabase project** → Make sure the URL matches your actual project
❌ **Template not saved** → Click the save button after configuration

## Testing the Configuration

After setup, test using the browser console:

```javascript
// Run this in your browser console while signed in
const token = await window.Clerk.session.getToken({ template: 'supabase' });
console.log('Token:', token ? '✅ Received' : '❌ Not received');
```

If you get a token, the configuration is correct!

## Need Help?

If you're stuck:
1. Double-check the template name is exactly `supabase`
2. Verify the JWT Secret is copied correctly (no extra spaces)
3. Try creating a new template from scratch
4. Sign out and back in to refresh your session
5. Check the Clerk dashboard for any error messages

## Reference Links

- Clerk JWT Templates: https://clerk.com/docs/backend-requests/making/jwt-templates
- Supabase Auth with Clerk: https://supabase.com/docs/guides/auth/social-login/auth-clerk
- Clerk Dashboard: https://dashboard.clerk.com
- Supabase Dashboard: https://supabase.com/dashboard
