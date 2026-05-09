import { getAuthenticatedPM } from "@/lib/queries";
import { Header } from "@/components/dashboard/Header";
import { AccountForm } from "@/components/dashboard/AccountForm";
import {
  getActiveDeletionRequest,
  getCorporationContactEmail,
} from "@/app/(dashboard)/dashboard/account/actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { pm } = await getAuthenticatedPM();
  const [activeDeletionRequest, corpContactEmail] = await Promise.all([
    getActiveDeletionRequest(),
    getCorporationContactEmail(),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <Header title="Account" subtitle="Manage your profile and settings" />

      <main className="flex-1 p-6">
        <AccountForm
          pm={pm}
          corpContactEmail={corpContactEmail}
          activeDeletionRequest={activeDeletionRequest}
        />
      </main>
    </div>
  );
}
