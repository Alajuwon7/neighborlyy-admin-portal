import { getCommunityWithAuth } from "@/lib/queries";
import { EventFormDialog } from "@/components/community/EventFormDialog";
import { EventCardActions } from "@/components/community/EventCardActions";
import { Calendar, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { nonResidentIds } from "@/lib/residents";
import {
  HOST_FILTERS,
  loadEventHostInfo,
  parseHostFilter,
  type EventHost,
  type HostedEventInfo,
} from "@/lib/event-host";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const hostFilter = parseHostFilter((await searchParams).host);
  // Auth first: the RSVP read below uses the service role and relies on this check.
  const { supabase, community } = await getCommunityWithAuth(id);

  const { data: eventsRaw } = await supabase
    .from("events")
    .select("id, title, description, location, event_date, max_attendees, image_url, created_at, created_by, hosted_by")
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
      created_by: string | null;
      hosted_by: string | null;
    }[]) ?? [];

  // Host tag + RSVP counts. Optional: on failure the cards render without them.
  let info = new Map<string, HostedEventInfo>();
  let infoFailed = false;
  try {
    info = await loadEventHostInfo(
      createAdminClient(),
      events,
      await nonResidentIds(supabase, [community.community_code as string]),
    );
  } catch (e) {
    console.error("events host/RSVP read failed:", e);
    infoFailed = true;
  }

  const hostCounts = { management: 0, resident: 0 };
  for (const v of info.values()) hostCounts[v.host] += 1;

  const shown =
    hostFilter === "all" || infoFailed ? events : events.filter((e) => info.get(e.id)?.host === hostFilter);

  const now = new Date();
  const upcoming = shown.filter((e) => new Date(e.event_date) >= now);
  // Upcoming: soonest first (query order). Past: most recent first.
  const past = shown.filter((e) => new Date(e.event_date) < now).reverse();

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            {hostFilter !== "all" && !infoFailed ? ` · ${HOST_FILTERS.find((f) => f.value === hostFilter)!.label.toLowerCase()} only` : ""}
          </p>
        </div>
        <EventFormDialog
          communityCode={community.community_code}
          communityId={id}
        />
      </div>

      {events.length > 0 && !infoFailed && (
        <nav
          aria-label="Filter events by host"
          className="flex w-full flex-wrap rounded-xl border p-0.5 sm:w-auto sm:inline-flex"
          style={{ borderColor: "var(--nly-border)", backgroundColor: "var(--nly-surface)" }}
        >
          {HOST_FILTERS.map((f) => {
            const selected = f.value === hostFilter;
            const count =
              f.value === "all" ? events.length : hostCounts[f.value];
            return (
              <Link
                key={f.value}
                href={f.value === "all" ? "?" : `?host=${f.value}`}
                aria-current={selected ? "page" : undefined}
                className="flex-1 px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap rounded-lg transition-colors sm:flex-none"
                style={{
                  backgroundColor: selected ? "var(--nly-surface-hover)" : "transparent",
                  color: selected ? "var(--nly-text-primary)" : "var(--nly-text-tertiary)",
                }}
              >
                {f.label} <span className="tabular-nums opacity-70">{count}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {events.length > 0 && shown.length === 0 ? (
        <div
          className="rounded-2xl border p-10 text-center"
          style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
            {hostFilter === "resident"
              ? "No events hosted by residents yet."
              : "No events hosted by management yet."}
          </p>
        </div>
      ) : events.length === 0 ? (
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {upcoming.map((e) => (
                  <EventCard key={e.id} event={e} communityId={id} info={info.get(e.id)} />
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-60">
                {past.map((e) => (
                  <EventCard key={e.id} event={e} communityId={id} info={info.get(e.id)} />
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
  info,
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
  info: HostedEventInfo | undefined;
}) {
  const eventDate = new Date(event.event_date);

  return (
    <div
      className="nly-card-hover rounded-2xl border p-5 space-y-3 group relative"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      {/* Edit/Delete actions */}
      <div className="absolute top-3 right-3">
        <EventCardActions event={event} communityId={communityId} host={info?.host} />
      </div>

      {event.image_url && (
        // User-uploaded remote thumbnail; plain <img> avoids image-optimization
        // cost and remote-host config for a low-traffic admin view.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.image_url}
          alt={event.title}
          className="w-full h-32 object-cover rounded-xl"
        />
      )}
      {info && (
        <div className={event.image_url ? "" : "pr-20"}>
          <HostTag host={info.host} />
        </div>
      )}
      {/* Without an image the title sits beside the absolute edit/delete buttons — keep clear of them. */}
      <h4
        className={`text-sm font-semibold break-words ${event.image_url ? "" : "pr-20"}`}
        style={{ color: "var(--nly-text-primary)" }}
      >
        {event.title}
      </h4>
      {event.description && (
        <p
          className="text-xs line-clamp-2 break-words"
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
        {(info || event.max_attendees) && (
          <div className="flex items-center gap-1.5">
            <Users size={12} style={{ color: "var(--nly-text-tertiary)" }} />
            <span
              className="text-xs tabular-nums"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              {info
                ? `${info.going}${event.max_attendees ? ` / ${event.max_attendees}` : ""} ${new Date(event.event_date) < new Date() ? "RSVPed" : "going"}`
                : `Max ${event.max_attendees}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function HostTag({ host }: { host: EventHost }) {
  const management = host === "management";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: management ? "rgba(47, 196, 211, 0.12)" : "rgba(245, 158, 11, 0.12)",
        color: management ? "var(--nly-accent)" : "var(--nly-warning)",
      }}
    >
      {management ? "Hosted by management" : "Hosted by a resident"}
    </span>
  );
}
