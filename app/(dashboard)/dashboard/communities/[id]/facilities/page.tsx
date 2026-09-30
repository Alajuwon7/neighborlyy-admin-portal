import { getCommunityWithAuth } from "@/lib/queries";
import { FacilityFormDialog } from "@/components/community/FacilityFormDialog";
import { FacilityRowActions } from "@/components/community/FacilityRowActions";
import { getFacilityIcon } from "@/lib/facilities";
import { CheckCircle, XCircle, Users, Clock } from "lucide-react";

function formatTime(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

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
      capacity: number | null;
      open_time: string | null;
      close_time: string | null;
      available: boolean;
    }[]) ?? [];

  // Upcoming reservation counts per facility. reservation_status is
  // ('active','cancelled','pending','approved','denied') — there is no
  // 'confirmed'; filtering on it made Postgres reject the query, so every
  // facility showed zero. New app bookings start 'pending' until an admin
  // approves them, so those are counted (and surfaced) too.
  const facilityIds = facilities.map((f) => f.id);
  const { data: reservationsRaw, error: reservationsError } = facilityIds.length
    ? await supabase
        .from("reservations")
        .select("facility_id, status")
        .in("facility_id", facilityIds)
        .in("status", ["pending", "approved", "active"])
        .gte("start_time", new Date().toISOString())
    : { data: [], error: null };
  if (reservationsError) console.error("facility reservations read failed:", reservationsError);

  const reservationCounts = new Map<string, { total: number; pending: number }>();
  ((reservationsRaw as { facility_id: string; status: string }[]) ?? []).forEach((r) => {
    const c = reservationCounts.get(r.facility_id) ?? { total: 0, pending: 0 };
    c.total += 1;
    if (r.status === "pending") c.pending += 1;
    reservationCounts.set(r.facility_id, c);
  });

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {facilities.map((f) => {
            const { total: upcomingReservations, pending: pendingReservations } =
              reservationCounts.get(f.id) ?? { total: 0, pending: 0 };
            const openLabel = formatTime(f.open_time);
            const closeLabel = formatTime(f.close_time);
            const hoursLabel =
              openLabel && closeLabel ? `${openLabel} – ${closeLabel}` : null;

            return (
              <div
                key={f.id}
                className="rounded-2xl border p-5 space-y-3"
                style={{
                  backgroundColor: "var(--nly-surface)",
                  borderColor: "var(--nly-border)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4
                      className="text-sm font-semibold flex items-center gap-1.5"
                      style={{ color: "var(--nly-text-primary)" }}
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {getFacilityIcon(f.name)}
                      </span>
                      <span className="truncate">{f.name}</span>
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      {f.available ? (
                        <>
                          <CheckCircle
                            size={12}
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
                            size={12}
                            style={{ color: "var(--nly-error)" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--nly-error)" }}
                          >
                            Unavailable
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <FacilityRowActions facility={f} communityId={id} />
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
                  {f.capacity != null && (
                    <div className="flex items-center gap-1.5">
                      <Users
                        size={12}
                        style={{ color: "var(--nly-text-tertiary)" }}
                      />
                      <span
                        className="text-xs"
                        style={{ color: "var(--nly-text-secondary)" }}
                      >
                        Capacity {f.capacity}
                      </span>
                    </div>
                  )}
                  {hoursLabel && (
                    <div className="flex items-center gap-1.5">
                      <Clock
                        size={12}
                        style={{ color: "var(--nly-text-tertiary)" }}
                      />
                      <span
                        className="text-xs"
                        style={{ color: "var(--nly-text-secondary)" }}
                      >
                        {hoursLabel}
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
                      {pendingReservations > 0 && (
                        <span style={{ color: "var(--nly-warning)" }}>
                          {" "}
                          · {pendingReservations} awaiting approval
                        </span>
                      )}
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
