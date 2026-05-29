import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthToggleTabs } from "@/components/auth/AuthToggleTabs";

/**
 * Shared layout for the Sign In / Sign Up routes.
 *
 * Because this layout segment is preserved across navigation between its child
 * pages, toggling between /login and /signup no longer remounts the auth shell
 * (background image, hero stats) or replays their entrance animation — only the
 * form swaps. The tabs live here so they stay mounted and stable across the toggle.
 */
export default function TabbedAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthLayout>
      <AuthToggleTabs />
      {children}
    </AuthLayout>
  );
}
