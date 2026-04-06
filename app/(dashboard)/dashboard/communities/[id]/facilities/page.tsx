import { getCommunityWithAuth } from "@/lib/queries";
import { FacilityFormDialog } from "@/components/community/FacilityFormDialog";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);

  const { data: facilitiesRaw } = await supabase
    .from("facilities")
    .select("*")
    .eq("community_code", community.community_code)
    .order("name", { ascending: true });

  const facilities =
    (facilitiesRaw as {
      id: string;
      name: string;
      description: string | null;
      type: string;
      is_available: boolean;
      hours: string | null;
      rules: string | null;
    }[]) ?? [];

  // Get reservation counts for each facility
  const facilityIds = facilities.map((f) => f.id);
  const { data: reservationsRaw } = facilityIds.length
    ? await supabase
        .from("reservations")
        .select("facility_id")
        .in("facility_id", facilityIds)
        .eq("status", "confirmed")
        .gte("start_time", new Date().toISOString())
    : { data: [] };

  const reservationCounts = new Map<string, number>();
  ((reservationsRaw as { facility_id: string }[]) ?? []).forEach((r) => {
    reservationCounts.set(
      r.facility_id,
      (reservationCounts.get(r.facility_id) ?? 0) + 1
    );
  });

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-sm font-medium"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            Facilities
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            {facilities.length}{" "}
            {facilities.length === 1 ? "facility" : "facilities"}
          </p>
        </div>
        <FacilityFormDialog
          communityCode={community.community_code}
          communityId={id}
        />
      </div>

      {facilities.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            No facilities added. Add amenities for your residents.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {facilities.map((f) => {
            const upcomingReservations = reservationCounts.get(f.id) ?? 0;

            return (
              <div
                key={f.id}
                className="rounded-2xl border p-5 space-y-3"
                style={{
                  backgroundColor: "var(--nly-surface)",
                  borderColor: "var(--nly-border)",
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4
                      className="text-sm font-semibold"
                      style={{ color: "var(--nly-text-primary)" }}
                    >
                      {f.name}
                    </h4>
                    <p
                      className="text-xs capitalize mt-0.5"
                      style={{ color: "var(--nly-text-tertiary)" }}
                    >
                      {f.type.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {f.is_available ? (
                      <>
                        <CheckCircle
                          size={14}
                          style={{ color: "var(--nly-success)" }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: "var(--nly-success)" }}
                        >
                          Open
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle
                          size={14}
                          style={{ color: "var(--nly-error)" }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: "var(--nly-error)" }}
                        >
                          Closed
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {f.description && (
                  <p
                    className="text-xs line-clamp-2"
                    style={{ color: "var(--nly-text-secondary)" }}
                  >
                    {f.description}
                  </p>
                )}

                <div
                  className="flex items-center gap-4 pt-3 border-t"
                  style={{ borderColor: "var(--nly-divider)" }}
                >
                  {f.hours && (
                    <div className="flex items-center gap-1.5">
                      <Clock
                        size={12}
                        style={{ color: "var(--nly-text-tertiary)" }}
                      />
                      <span
                        className="text-xs"
                        style={{ color: "var(--nly-text-secondary)" }}
                      >
                        {f.hours}
                      </span>
                    </div>
                  )}
                  {upcomingReservations > 0 && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--nly-accent)" }}
                    >
                      {upcomingReservations} upcoming{" "}
                      {upcomingReservations === 1
                        ? "reservation"
                        : "reservations"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
