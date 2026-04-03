This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values. See below for details on keys that require extra care.

### `SUPABASE_SERVICE_ROLE_KEY` (Optional but Recommended)

This key allows admin operations that bypass RLS policies, needed for:
- Approving pending residents (writes to `profiles` table)
- Managing users across communities (admin-level operations)

To get this key:
1. Go to **Supabase Dashboard > Settings > API**
2. Copy the **service_role** key (secret)
3. Add to `.env.local` as `SUPABASE_SERVICE_ROLE_KEY=xxx`
4. Also add to Netlify: **Site settings > Environment variables**

> **Warning**
> NEVER commit this key to Git - it bypasses all security rules.

## Deployment Checklist

After every deployment, verify the following:

- [ ] Environment variables are set in Netlify (see `.env.example`)
- [ ] Supabase auth config matches expected values (see [`docs/SUPABASE_AUTH_CONFIG.md`](docs/SUPABASE_AUTH_CONFIG.md))

> **Warning**
> After deployment, manually restore password requirements in Supabase Dashboard -> Authentication -> Providers -> Email -> Password Requirements. Set minimum length to **8** and require **letters and digits**. See [`docs/SUPABASE_AUTH_CONFIG.md`](docs/SUPABASE_AUTH_CONFIG.md) for full details.
