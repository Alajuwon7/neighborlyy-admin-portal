import { getCommunityWithAuth } from "@/lib/queries";
import { EventFormDialog } from "@/components/community/EventFormDialog";
import { Calendar, MapPin, Users, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);

  const { data: eventsRaw } = await supabase
    .from("events")
    .select("*")
    .eq("community_code", community.community_code)
    .order("start_time", { ascending: true });

  const events =
    (eventsRaw as {
      id: string;
      title: string;
      description: string | null;
      location: string | null;
      start_time: string;
      end_time: string | null;
      rsvp_count: number;
      created_at: string;
    }[]) ?? [];

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.start_time) >= now);
  const past = events.filter((e) => new Date(e.start_time) < now);

  return (
    <main className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-sm font-medium"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            Events
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            {upcoming.length} upcoming, {past.length} past
          </p>
        </div>
        <EventFormDialog
          communityCode={community.community_code}
          communityId={id}
        />
      </div>

      {events.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            No events yet. Create one to engage your community.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h3
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                Upcoming
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcoming.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <h3
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                Past
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
                {past.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function EventCard({
  event,
}: {
  event: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    start_time: string;
    end_time: string | null;
    rsvp_count: number;
  };
}) {
  const startDate = new Date(event.start_time);

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <h4
        className="text-sm font-semibold"
        style={{ color: "var(--nly-text-primary)" }}
      >
        {event.title}
      </h4>
      {event.description && (
        <p
          className="text-xs line-clamp-2"
          style={{ color: "var(--nly-text-tertiary)" }}
        >
          {event.description}
        </p>
      )}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} style={{ color: "var(--nly-accent)" }} />
          <span className="text-xs" style={{ color: "var(--nly-text-secondary)" }}>
            {startDate.toLocaleDateString()} at{" "}
            {startDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-1.5">
            <MapPin size={12} style={{ color: "var(--nly-text-tertiary)" }} />
            <span
              className="text-xs"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              {event.location}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Users size={12} style={{ color: "var(--nly-text-tertiary)" }} />
          <span
            className="text-xs"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            {event.rsvp_count} RSVPs
          </span>
        </div>
      </div>
    </div>
  );
}
