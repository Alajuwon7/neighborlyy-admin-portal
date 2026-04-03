# Supabase Auth Configuration

These settings must be configured manually in the Supabase Dashboard. They cannot be set via code or migrations.

## URL Configuration

**Dashboard Location:** Authentication > URL Configuration

| Setting | Value |
|---------|-------|
| Site URL | `https://neighborlyy-admin-portal.netlify.app` |

### Redirect URLs

| URL | Purpose |
|-----|---------|
| `https://neighborlyy-admin-portal.netlify.app/api/auth/callback` | Production OAuth/magic link callback |
| `http://localhost:3000/api/auth/callback` | Local development callback |

## Password Settings

**Dashboard Location:** Authentication > Providers > Email > Password Requirements

| Setting | Required Value |
|---------|---------------|
| Minimum password length | `8` |
| Password requirements | `letters_digits` (require both letters and digits) |

## How to Restore

1. Go to the [Supabase Dashboard](https://supabase.com/dashboard)
2. Select the project
3. Navigate to **Authentication > URL Configuration**
   - Set **Site URL** to `https://neighborlyy-admin-portal.netlify.app`
   - Add both redirect URLs listed above
4. Navigate to **Authentication > Providers > Email**
   - Set **Minimum password length** to `8`
   - Set **Password requirements** to **Require both letters and digits** (`letters_digits`)
5. Click **Save**

> **Note:** These settings were accidentally changed during a deployment. If you are redeploying or setting up a new environment, verify these settings match the values above.
