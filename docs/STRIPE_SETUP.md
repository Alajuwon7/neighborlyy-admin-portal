# Stripe Payment Integration

## Setup

### 1. Create Stripe Account

Sign up at [dashboard.stripe.com](https://dashboard.stripe.com) and get your API keys from **Developers > API keys**.

### 2. Create Products and Prices

Create 3 products in Stripe with monthly and annual prices:

| Product | Monthly | Annual (per month) |
|---|---|---|
| Starter | $99/mo | $79/mo ($948/yr) |
| Professional | $199/mo | $159/mo ($1,908/yr) |
| Enterprise | $399/mo | $319/mo ($3,828/yr) |

For each product, create two recurring prices (monthly and annual). Copy the price IDs (`price_xxx`).

### 3. Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_ANNUAL=price_xxx
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_xxx
STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_xxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxx
STRIPE_PRICE_ENTERPRISE_ANNUAL=price_xxx
```

### 4. Run Migration

Apply the onboarding sessions table:

```sql
-- supabase/migrations/005_onboarding_sessions.sql
```

## Payment Flow

```
User selects plan → clicks "Start Free Trial"
       ↓
POST /api/stripe/checkout
  - Stores onboarding data in onboarding_sessions table
  - Creates Stripe Checkout Session (subscription mode, 14-day trial)
  - Returns checkout URL
       ↓
Redirect to Stripe Checkout (hosted page)
  - User enters payment details
  - 14-day trial starts immediately
       ↓
On success → GET /api/stripe/checkout/success?session_id=xxx
  - Verifies checkout session with Stripe
  - Retrieves onboarding data from onboarding_sessions
  - Creates community in Supabase
  - Stores stripe_customer_id and stripe_subscription_id
  - Deletes temporary onboarding session
  - Redirects to /onboarding?payment=completed
       ↓
Onboarding page shows SetupComplete with payment confirmation
       ↓
User clicks "Go to Dashboard"
```

## Cancel Flow

If the user cancels at Stripe Checkout, they're redirected to:
```
/onboarding?step=5&cancelled=true
```
A toast notification tells them they can try again.

## Skip Payment (Testing)

When `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not set:
- A "Skip Payment for Now" button appears on Step 5
- Creates a trial community with Professional tier
- No Stripe customer or subscription is created

## Testing

### Test Cards

| Card | Scenario |
|---|---|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0027 6000 3184` | Requires 3D Secure |
| `4000 0000 0000 9995` | Insufficient funds |

Use any future expiry date, any 3-digit CVC, and any ZIP code.

### Testing Locally

1. Set Stripe test keys in `.env.local`
2. Run the dev server: `npm run dev`
3. Go through onboarding steps 1-4
4. On Step 5, select a plan and click "Start Free Trial"
5. Complete checkout with a test card
6. Verify redirect back to success screen

## Troubleshooting

| Issue | Fix |
|---|---|
| "No price configured" error | Set `STRIPE_PRICE_*` env vars with valid price IDs from Stripe Dashboard |
| Redirect fails after payment | Check `NEXT_PUBLIC_APP_URL` matches your domain |
| "Session expired" after checkout | Onboarding session TTL is 1 hour — restart if too long |
| Community not created | Check Supabase RLS policies and property_managers row exists |
| Skip button not showing | Ensure `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is **not** set |

## Architecture

### Temporary Data Storage

Stripe metadata is limited to 500 chars per value, so onboarding data is stored in the `onboarding_sessions` table during checkout:

- Created when checkout session is initiated
- Contains full onboarding form data as JSONB
- Auto-expires after 1 hour
- Deleted after successful community creation
- Protected by RLS (user can only access own sessions)

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/stripe/checkout` | POST | Create Stripe Checkout session |
| `/api/stripe/checkout/success` | GET | Handle post-payment redirect |
