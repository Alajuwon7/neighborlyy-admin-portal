import { getCommunityWithAuth } from "@/lib/queries";
import { EventFormDialog } from "@/components/community/EventFormDialog";
import { EventCardActions } from "@/components/community/EventCardActions";
import { Calendar, MapPin, Users } from "lucide-react";

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
    .select("id, title, description, location, event_date, max_attendees, image_url, created_at")
    .eq("community_code", community.community_code)
    .order("event_date", { ascending: true });

  const events =
    (eventsRaw as {
      id: string;
      title: string;
      description: string | null;
      location: string | null;
      event_date: string;
      max_attendees: number | null;
      image_url: string | null;
      created_at: string;
    }[]) ?? [];

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.event_date) >= now);
  const past = events.filter((e) => new Date(e.event_date) < now);

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl">
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
          className="rounded-2xl border p-12 text-center space-y-3"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <p className="text-3xl">📅</p>
          <p className="text-sm font-medium" style={{ color: "var(--nly-text-primary)" }}>
            No events yet
          </p>
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Create one to engage your community. Events show up in the resident app immediately.
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
                  <EventCard key={e.id} event={e} communityId={id} />
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
                  <EventCard key={e.id} event={e} communityId={id} />
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
  communityId,
}: {
  event: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    event_date: string;
    max_attendees: number | null;
    image_url: string | null;
  };
  communityId: string;
}) {
  const eventDate = new Date(event.event_date);

  return (
    <div
      className="nly-card-hover rounded-2xl border p-4 space-y-3 group relative"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      {/* Edit/Delete actions */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <EventCardActions event={event} communityId={communityId} />
      </div>

      {event.image_url && (
        <img
          src={event.image_url}
          alt={event.title}
          className="w-full h-32 object-cover rounded-xl"
        />
      )}
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
            {eventDate.toLocaleDateString()} at{" "}
            {eventDate.toLocaleTimeString([], {
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
        {event.max_attendees && (
          <div className="flex items-center gap-1.5">
            <Users size={12} style={{ color: "var(--nly-text-tertiary)" }} />
            <span
              className="text-xs"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              Max {event.max_attendees}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
