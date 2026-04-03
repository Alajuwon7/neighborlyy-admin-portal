import { getAuthenticatedPM } from "@/lib/queries";
import { Header } from "@/components/dashboard/Header";
import { AccountForm } from "@/components/dashboard/AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { pm } = await getAuthenticatedPM();

  return (
    <div className="flex flex-col flex-1">
      <Header title="Account" subtitle="Manage your profile and settings" />

      <main className="flex-1 p-6">
        <AccountForm pm={pm} />
      </main>
    </div>
  );
}
