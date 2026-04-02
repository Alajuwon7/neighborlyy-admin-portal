# Neighborlyy Admin Web Portal - Development Plan

## 📋 Project Overview

Build a Next.js admin web portal for Neighborlyy that enables property managers to onboard communities, manage subscriptions, and oversee operations. This portal shares the same Supabase database as the mobile app and maintains consistent visual design.

**Repository:** `neighborlyy-admin-portal`  
**Tech Stack:** Next.js 14 (App Router) + Supabase + Stripe + Tailwind CSS  
**Design System:** Aligned with Neighborlyy mobile app (React Native)  
**Database:** Shared Supabase instance with mobile app

---

## 🎨 Design System Alignment

### Color Palette (Matching Mobile App)
```typescript
// tailwind.config.ts
const colors = {
  // Backgrounds
  background: '#0B1520',        // Main background
  surface: '#1A2433',           // Card/elevated surfaces
  surfaceHover: '#233044',      // Hover states
  
  // Text (validated WCAG AA)
  textPrimary: '#E9EEF4',       // 14.2:1 contrast
  textSecondary: 'rgba(233, 238, 244, 0.82)', 11.6:1
  textTertiary: 'rgba(233, 238, 244, 0.7)',    // 9.9:1
  textPlaceholder: 'rgba(233, 238, 244, 0.44)', // ~6:1
  
  // Brand Colors
  primary: '#E65C4F',           // 5.2:1 - Coral (primary actions)
  primaryHover: '#D84A3D',
  primaryActive: '#C93C2F',
  
  secondary: '#78A6C8',         // 5.8:1 - Blue (links, focus)
  secondaryHover: '#6A98BA',
  
  // Status Colors (WCAG AA validated)
  success: '#10B981',           // 5.1:1
  successBg: 'rgba(16, 185, 129, 0.1)',
  warning: '#F59E0B',           // 6.2:1
  warningBg: 'rgba(245, 158, 11, 0.1)',
  error: '#EF4444',             // 4.9:1
  errorBg: 'rgba(239, 68, 68, 0.1)',
  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.1)',
  
  // Alert Priority Colors (from PRD)
  alertUrgent: '#EF4444',       // Coral/Red
  alertHigh: '#F97316',         // Orange
  alertMedium: '#F59E0B',       // Amber
  alertLow: '#06B6D4',          // Cyan
  
  // UI Elements
  border: 'rgba(233, 238, 244, 0.12)',
  borderHover: 'rgba(233, 238, 244, 0.2)',
  divider: 'rgba(233, 238, 244, 0.08)',
  overlay: 'rgba(11, 21, 32, 0.85)',
  
  // Input States
  inputBg: '#1A2433',
  inputBorder: 'rgba(233, 238, 244, 0.12)',
  inputBorderFocus: '#78A6C8',
  inputBorderError: '#EF4444',
}
```

### Typography
```typescript
// From mobile app specs
const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  },
  fontSize: {
    xs: '12px',      // Captions, metadata
    sm: '14px',      // Secondary text
    base: '16px',    // Body text
    lg: '18px',      // Emphasized body
    xl: '20px',      // Small headings
    '2xl': '24px',   // Section headings
    '3xl': '30px',   // Page headings
    '4xl': '36px',   // Hero headings
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.75',
  },
}
```

### Spacing Scale
```typescript
const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
}
```

### Border Radius
```typescript
const borderRadius = {
  sm: '6px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '9999px',
}
```

### Shadows
```typescript
const boxShadow = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.2)',
  md: '0 4px 6px rgba(0, 0, 0, 0.3)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.4)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.5)',
}
```

---

## 📁 Project Structure
```
neighborlyy-admin-portal/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── verify-email/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Main dashboard
│   │   ├── onboarding/page.tsx         # 5-step wizard
│   │   ├── communities/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── residentage.tsx
│   │   │       ├── analytics/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── team/page.tsx
│   │   ├── billing/
│   │   │   ├── page.tsx
│   │   │   ├── plans/page.tsx
│   │   │   └── history/page.tsx
│   │   └── account/page.tsx
│   ├── api/
│   │   ├── auth/callback/route.ts
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts
│   │   │   ├── webhook/route.ts
│   │   │   └── portal/route.ts
│   │   └── onboarding/complete/route.ts
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx
├── components/
│   ├── ui/                             # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── toast.tsx
│   │   ├── table.tsx
│   │   ├── StepProgress.tsx
│   │   ├── Step1PropertyInfo.tsx
│   │   ├── Step2Branding.tsx
│   │   ├── Step3Facilities.tsx
│   │   ├── Step4AdminAccess.tsx
│   │   ├── Step5Billing.tsx
│   │   └── SetupComplete.tsx
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── SummaryCard.tsx
│   │   ├── CommunityCard.tsx
│   │   └── ActivityFeed.tsx
│   ├── community/
│   │   ├── PendingUserCard.tsx
│   │   ├── ResidentTable.tsx
│   │   ├── EventForm.tsx
│   │   ├── AlertForm.tsx
│   │   └── FacilityForm.tsx
│   ├── analytics/
│   │   ├── EngagementChart.tsx
│   │   ├── ROICalculator.tsx
│   │   └── MetricCard.tsx
│   └── billing/
│       ├── PricingTable.tsx
│       ├── SubscriptionCard.tsx
│       └── PaymentMethodForm.tsx
├── lib community.ts
│   │   └── billing.ts
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useCommunity.ts
│   ├── useSubscription.ts
│   └── useOnboarding.ts
├── types/
│   ├── database.types.ts
│   ├── stripe.types.ts
│   └── index.ts
├── supabase/
│   └── migrations/
│       └── 002_add_admin_portal_tables.sql
├── middleware.ts
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🗄️ Database Strategy

### ✅ Using SAME Supabase Instance as Mobile App

**Key Principle:** Both mobile app and web portal connect to the same database. All existing tables remain unchanged. We only ADD new tables for admin portal features.

### New Tables to Create
```sql
-- supabase/migrations/002_add_admin_portal_tables.sql

-- Property Managers (separate from regular users)
CREATE TABLE property_managerUNIQUE,
  phone text,
  company_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Communities (NEW - links everything together)
CREATE TABLE communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_manager_id uuid REFERENCES property_managers NOT NULL,
  
  -- Basic Info
  name text NOT NULL,
  community_code text UNIQUE NOT NULL,  -- Links to existing profiles, events, posts
  
  -- Address
  street_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  
  -- Property Details
  unit_count integer NOT NULL,
  property_type text NOT NULL CHECK (property_type IN ('apartment', 'condo', 'student', 'senior')),
  
  -- Branding
  logo_url text,
  hero_image_url text,
  primary_color text DEFAULT '#E65C4F',
  accent_color text DEFAULT '#78A6C8',
  
  -- Admin Access
  admin_code text NOT NULL,
  
  -- Status
  status text DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
  onboarding_completed boolean DEFAULT false,
  trial_ends_at timestamptz,
  
  -- Stripe
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  subscription_tier text CHECK (subscription_tier IN ('starter', 'professional', 'enterprise', 'white_label')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Team Members
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities NOT NULL,
  property_manager_id uuid REFERENCES property_managers,
  
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'assistant_manager', 'leasing_agent')),
  
  status text DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'deactivated')),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(community_id, email)
);

-- Subscription History
CREATE TABLE subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities NOT NULL,
  
  event_type text NOT NULL CHECK (event_type IN ('created', 'upgraded', 'downgraded', 'cancelled', 'reactivated')),
  from_tier text,
  to_tier text,
  
  amount decimal(10,2),
  
  stripe_event_id text,
  metadata jsonb,
  
  created_at timestamptz DEFAULT now()
);

-- Analytics Events
CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities NOT NULL,
  
  event_type text NOT NULL,
  user_id uuid REFERENCES profiles,
  
  metadata jsonb,
  
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_communities_pm ON communities(property_manager_id);
CREATE INDEX idx_communities_code ON communities(community_code);
CREATE INDEX idx_communities_stripe ON communities(stripe_customer_id);
CREATE INDEX idx_team_members_community ON team_members(community_id);
CREATE INDEX idx_analytics_community_date ON analytics_events(community_id, created_at DESC);

-- RLS Policies
ALTER TABLE property_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Property managers see own profile
CREATE POLICY "Property managers view own profile"
  ON property_managers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Property managers update own profile"
  ON property_managers FOR UPDATE
  USING (user_id = auth.uid());

-- Property managers see own communities
CREATE POLICY "Property managers view own communities"
  ON communities FOR SELECT
  USING (
    property_manager_id IN (
      SELECT id FROM property_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Property managers manage own communities"
  ON communities FOR ALL
  USING (
    property_manager_id IN (
      SELECT id FROM property_managers WHERE user_id = auth.uid()
    )
  );

-- Team members policies (similar pattern)
CREATE POLICY "View team members in own communities"
  ON team_members FOR SELECT
  USING (
    community_id IN (
      SELECT id FROM communities WHERE property_manager_id IN (
        SELECT id FROM property_managers WHERE user_id = auth.uid()
      )
    )
  );

-- Subscription history (read-only for property managers)
CREATE POLICY "View own subscription history"
  ON subscription_history FOR SELECT
  USING (
    community_id IN (
      SELECT id FROM communities WHERE property_manager_id IN (
        SELECT id FROM property_managers WHERE user_id = auth.uid()
      )
    )
  );

-- Analytics events
CREATE POLICY "View own analytics"
  ON analytics_events FOR SELECT
  USING (
    community_id IN (
      SELECT id FROM communities WHERE property_manager_id IN (
        SELECT id FROM property_managers WHERE user_id = auth.uid()
      )
    )
  );
```

### Relationship to Existing Tables
```
NEW: communities.community_code
  ↓ (foreign key rationship)
EXISTING: profiles.community_code
EXISTING: events.community_code
EXISTING: posts.community_code
EXISTING: help_requests.community_code
EXISTING: marketplace_items.community_code
EXISTING: facilities.community_code
EXISTING: reservations.community_code
EXISTING: alerts.community_code

This links the new admin portal data to all existing mobile app data.
```

---

## 🚀 PHASE 1: Project Setup & Configuration

### Task 1.1: Initialize Next.js Project
```bash
# Create Next.js app with TypeScript and Tailwind
npx create-next-app@latest neighborlyy-admin-portal \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd neighborlyy-admin-portal

# Install core dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install stripe @stripe/stripe-js
npm install resend
npm install zod react-hook-form @hookform/resolvers
npm install date-fns
npm install lucide-react
npm install recharts
npm install class-variance-authority clsx tailwind-merge

# Initialize shadcn/ui
x shadcn-ui@latest init
# Select: 
# - Style: New York
# - Base color: Slate
# - CSS variables: Yes

# Add shadcn components
npx shadcn-ui@latest add button card input label select textarea
npx shadcn-ui@latest add dialog dropdown-menu tabs toast
npx shadcn-ui@latest add table progress badge avatar
npx shadcn-ui@latest add form checkbox radio-group
npx shadcn-ui@latest add separator scroll-area
npx shadcn-ui@latest add alert alert-dialog
```

### Task 1.2: Configure Tailwind CSS

**File: `tailwind.config.ts`**
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        background: '#0B1520',
        surface: '#1A2433',
        'surface-hover': '#233044',
        
        // Text
        'text-primary': '#E9EEF4',
        'text-secondary': 'rgba(233, 238, 244, 0.82)',
        'text-tertiary': 'rgba(233, 238, 244, 0.7)',
        'text-placeholder': 'rgba(233, 238, 244, 0.44)',
        
        // Brand
        primary: {
          DEFAULT: '#E65C4F',
          hover: '#D84A3D',
          active: '#C93C2F',
        },
        secondary: {
          DEFAULT: '#78A6C8',
          hover: '#6A98BA',
        },
        
        // Status
        success: {
          DEFAULT: '#10B981',
          bg: 'rgba(16, 185, 129, 0.1)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.1)',
        },
        error: {
          DEFAULT: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.1)',
        },
        info: {
          DEFAULT: '#3B82F6',
          bg: 'rgba(59, 130, 246, 0.1)',
        },
        
        // Alert priorities (from PRD)
        alert: {
          urgent: '#EF4444',
          high: '#F97316',
          medium: '#F59E0B',
          low: '#06B6D4',
        },
        
        // UI
        border: 'rgba(233, 238, 244, 0.12)',
        'border-hover': 'rgba(233, 238, 244, 0.2)',
        divider: 'rgba(233, 238, 244, 0.08)',
        overlay: 'rgba(11, 21, 32, 0.85)',
        
        // Input
        'input-bg': '#1A2433',
        'input-border': 'rgba(233, 238, 244, 0.12)',
        'input-border-focus': '#78A6C8',
        'input-border-error': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.2)',
        md: '0 4px 6px rgba(0, 0, 0, 0.3)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.4)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

### Task 1.3: Setup Environment Variables

**File: `.env.example`**
```bash
# Supabase (SAME instance as mobile app)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Stripe Price IDs
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_ANNUAL=price_xxx
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_xxx
STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_xxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxx
STRIPE_PRICE_ENTERPRISE_ANNUAL=price_xxx

# Email (Resend)
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@neighborlyy.com

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=https://neighborlyy.com

# Admin Codes
DEFAULT_ADMIN_CODE=ADMIN2025
```

### Task 1.4: Configure Next.js

**File: `next.config.js`**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
```

### Task 1.5: Setup Global Styles

**File: `app/globals.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-background text-text-primary antialiased;
  }
  
  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    @apply bg-surface;
  }
  
  ::-webkit-scrollbar-thumb {
    @apply bg-text-tertiary rounded-md;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-text-secondary;
  }
}

@layer components {
  /* Touch target minimum (accessibility) */
  .touch-target {
    @apply min-h-[44px] min-w-[44px];
  }
}
```

---

## 🔐 PHASE 2: Supabase Integration & Authentication

### Task 2.1: Setup Supabase Clients

**File: `lib/supabase/client.ts`**
```typescript
import { createowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**File: `lib/supabase/server.ts`**
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Server component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Server component
          }
        },
      },
    }
  )
}
```

### Task 2.2: Generate Database Types
```bash
# Run this command to generate TypeScript types from your Supabase schema
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.types.ts
```

### Task 2.3: Create Auth Utility Hooks

**File: `hooks/useAuth.ts`**
```typescript
'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return { user, loading, supabase }
}
```

### Task 2.4: Setup Route Protection Middleware

**File: `middleware.ts`**
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard') || 
      request.nextUrl.pathname.startsWith('/onboarding')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Auth routes (redirect if logged in)
  if (request.nextUrl.pathname.startsWith('/login') || 
      request.nextUrl.pathname.startsWith('/signup')) {
    if (user) {
      // Check onboarding status
      const { data: pmData } = await supabase
        .from('property_managers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (pmData) {
        const { data: communityData } = await supabase
          .from('communities')
          .select('onboarding_completed')
          .eq('property_manager_id', pmData.id)
          .single()

        if (communityData?.onboarding_completed) {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        } else {
          return NextResponse.redirect(new URL('/onboarding', request.url))
        }
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Task 2.5: Create Auth API Route

**File: `app/api/auth/callback/route.ts`**
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
```

---

## 🎨 PHASE 3: Authentication Screens

### Task 3.1: Create Auth Layout

**File: `components/auth/AuthLayout.tsx`**
```typescript
import Image from 'next/image'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary mb-2">NEIGHBORLYY</h1>
            <p className="text-text-secondary">Property Manager rtal</p>
          </div>
          {children}
        </div>
      </div>
      
      {/* Right side - Branding (optional) */}
      <div className="hidden lg:flex flex-1 bg-surface items-center justify-center p-12">
        <div className="max-w-lg text-center">
          <h2 className="text-3xl font-bold text-text-primary mb-4">
            Build Thriving Communities
          </h2>
          <p className="text-text-secondary text-lg">
            Manage your apartment communities with ease. Engage residents, streamline operations, and boost renewals.
          </p>
        </div>
      </div>
    </div>
  )
}
```

### Task 3.2: Create Signup Page

**File: `app/(auth)/signup/page.tsx`**
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'

export default function SignupPage() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      })
      return
    }

    if (formData.password.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (authError) throw authError

      // 2. Create property manager profile
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('property_managers')
          .insert({
            user_id: authData.user.id,
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone || null,
          })

        if (profileError) throw profileError
      }

      toast({
        title: 'Success!',
        description: 'Please check your email to verify your account.',
      })

      router.push('/verify-email')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-text-primary">Create Account</CardTitle>
          <CardDescription className="text-text-secondary">
            Start your 14-day free trial. No credit card required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-text-primary">Full Name *</Label>
              <Input
                id="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="bg-input-bg border-input-border text-text-primary focus:border-input-border-focus"
                placeholder="John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-text-primary">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-input-bg border-input-border text-text-primary focus:border-input-border-focus"
                placeholder="john@property.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-text-secondary">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-input-bg border-input-border text-text-primary focus:border-input-border-focus"
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-text-primary">Password *</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-input-bg border-input-border text-text-primary focus:border-input-border-focus"
              />
              <p className="text-xs text-text-tertiary">
                Minimum 8 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-text-primary">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="bg-input-bg border-input-border text-text-primary focus:border-input-border-focus"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary-hover text-white touch-target"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account & Continue'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="text-secondary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
```

### Task 3.3: Create Login Page

**File: `app/(auth)/login/page.tsx`**
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Check onboarding status
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: pmData } = await supabase
          .from('property_managers')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (pmData) {
          const { data: communityData } = await supabase
            .from('communities')
            .select('onboarding_completed')
            .eq('property_manager_id', pmData.id)
            .single()

          if (communityData?.onboarding_completed) {
            router.push('/dashboard')
          } else {
            router.push('/onboarding')
          }
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-text-primary">Welcome Back</CardTitle>
          <CardDescription className="text-text-secondary">
            Sign in to your property manager account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text-primary">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-input-bg border-input-border text-text-primary focus:border-input-border-focus"
                placeholder="john@property.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-text-primary">Password</Label>
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-secondary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-input-bg border-input-border text-text-primary focus:border-input-border-focus"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary-hover text-white touch-target"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Don't have an account?{' '}
            <Link href="/signup" className="text-secondary hover:underline">
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
```

---

## 🎯 PHASE 4: Onboarding Wizard

[Continue with remaining phases: Onboarding (5 steps), Dashboard, Community Management, Stripe Integration, Analytics, etc.]

---

## ✅ Development Checklist

### Phase 1: Setup ✅
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind with design system colors
- [ ] Install all dependencies
- [ ] Setup environment variables
- [ ] Configure Supabase clients

### Phase 2: Database ✅
- [ ] Run migration `002_add_admin_portal_tables.sql`
- [ ] Verify RLS policies
- [ ] Generate TypeScript types
- [ ] Test database connection

### Phase 3: Authentication ✅
- [ ] Create auth layout
- [ ] Build signup page
- [ ] Build login page
- [ ] Setup middleware for route protection
- [ ] Test auth flow end-to-end

### Phaarding
- [ ] Step 1: Property Info
- [ ] Step 2: Branding
- [ ] Step 3: Facilities
- [ ] Step 4: Admin Access
- [ ] Step 5: Billing
- [ ] Setup Complete screen

### Phase 5: Dashboard
- [ ] Dashboard layout (sidebar + header)
- [ ] Summary cards
- [ ] Activity feed
- [ ] Trial countdown badge

### Phase 6: Community Management
- [ ] Pending users screen
- [ ] Residents management
- [ ] Events management
- [ ] Alerts creation
- [ ] Facilities management

### Phase 7: Stripe Integration
- [ ] Checkout session creation
- [ ] Webhook handler
- [ ] Customer portal
- [ ] Subscription management

### Phase 8: Analytics
- [ ] KPI cards
- [ ] Engagement charts
- [ ] ROI calculator
- [ ] Export reports

### Phase 9: Polish & Testing
- [ ] Loading states
- [ ] Error boundaries
- [ ] Toast notifications
- [ ] Accessibility audit
- [ ] Mobile responsiveness
- [ ] E2E testing

### Phase 10: Deployment
- [ ] Deploy to Vercel
- [ ] Configure environment variables
- [ ] Setup custom domain
- [ ] Configure Stripe webhook URL
- [ ] Test production build

---

## 🎨 Component Guidelines

### Button Variants
```tsx
// Primary action
<Button className="bg-primary hover:bg-primary-hover">
  Primary Action
</Button>

// Secondary action
<Button variant="outline" className="border-border text-text-primary hover:bg-surface-hover">
  Secondary
</Button>

// Destructive
<Button variant="destructive" className="bg-error hover:bg-error/90">
  Delete
</Button>
```

### Input States
```tsx
// Default
<Input className="bg-input-bg border-input-border focus:border-input-border-focus" />

// Error
<Input className="bg-input-bg border-input-border-error focus:border-input-border-error" />

// Disabled
<Input disabled className="bg-surface opacity-50" />
```

### Card Styling
```tsx
<Card className="bg-surface border-border shadow-md">
  <CardHeader>
    <CardTitle className="text-text-primary">Title</CardTitle>
    <CardDescription className="text-text-secondary">Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */  </CardContent>
</Card>
```

---

## 🚀 Success Criteria

This admin portal is complete when:

1. ✅ Property managers can signup and complete onboarding in <10 minutes
2. ✅ Stripe subscriptions are created and managed automatically
3. ✅ Community data is properly isolated (RLS working)
4. ✅ Dashboard displays real-time metrics from mobile app activity
5. ✅ Trial countdown is visible and accurate
6. ✅ Webhooks handle all Stripe events correctly
7. ✅ UI matches mobile app design system (dark theme, colors, typography)
8. ✅ All interactive elements meet 44px touch target minimum
9. ✅ Text contrast meets WCAG AA (4.5:1)
10. ✅ Mobile responsive (works on tablet)
11. ✅ Both mobile app and web portal can query same database
12. ✅ Residents approved in web portal immediately get access in mobile app

---

## 📚 Resources

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [shadcn/ui Compo)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)
- [Recharts](https://recharts.org)

---

## 💡 Development Notes

- Use `@/` import alias for all imports
- All colors must use CSS variables from design system
- Keep components small and focused
- Use TypeScript strictly (no `any` types)
- Handle loading and error states
- Add proper accessibility labels
- Test with keyboard navigation
- Validate all forms with Zod
- Use React Query/SWR for data fetching (optional)
- Log errors with Sentry (production)

---

**Start with Phase 1 and work through systematically. Let Claude Code handle the implementation details while you focus on business logic and user experience.** 🚀
