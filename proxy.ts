import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected routes — require auth
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Auth routes — redirect authenticated users
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    if (user) {
      const { data: pmData } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (pmData) {
        const { data: communityData } = await supabase
          .from("communities")
          .select("onboarding_completed")
          .eq("property_manager_id", pmData.id)
          .single();

        if (communityData?.onboarding_completed) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        } else {
          return NextResponse.redirect(new URL("/onboarding", request.url));
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
