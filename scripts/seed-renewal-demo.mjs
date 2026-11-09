/**
 * seed-renewal-demo.mjs — demo data for the Insights "Renewal rate by
 * engagement" tile in the APLREVIEW demo community. APLREVIEW ONLY; never
 * touches TREND1 or any real resident.
 *
 *   node --env-file=.env.local scripts/seed-renewal-demo.mjs              # dry run: checks + plan, writes nothing
 *   node --env-file=.env.local scripts/seed-renewal-demo.mjs --apply      # seed history + write the demo CSV
 *   node --env-file=.env.local scripts/seed-renewal-demo.mjs --apply --backdate   # also backdate (see below)
 *   node --env-file=.env.local scripts/seed-renewal-demo.mjs --cleanup    # undo everything this script did
 *
 * Needs migrations 036 (portal) and Miyora 20261109120000_lease_renewal_summary
 * applied, and the
 * demo.neighbor### accounts from Miyora scripts/seed-demo-marketing.mjs.
 *
 * What --apply does:
 *   1. Writes one older "history" post per week (ids 5eed0020-…) authored by
 *      demo neighbours, and backdated likes on them, so ~60% of neighbours
 *      have 3–6 active weeks before their lease end and the rest have none
 *      from this script. Demo authors have no push tokens, so nothing is sent.
 *   2. Writes docs/samples/rent-roll-demo-aplreview.csv: one lease per demo
 *      neighbour (end dates spread over the last ~80 days), a few vacant units
 *      that won't match, and two pending leases. Outcomes are ILLUSTRATIVE:
 *      engaged leases renew ~80% of the time, others ~55%.
 *   You then upload that CSV on APLREVIEW's Renewals tab (the end-to-end test).
 *
 * --backdate: the tile ignores leases whose 12-week window starts before the
 * community existed or before the unit's resident joined Miyora. If APLREVIEW or the demo accounts are too new, the dry run says so;
 * --backdate then moves communities.created_at (APLREVIEW) and the demo
 * neighbours' profiles.created_at back 30 weeks. Originals are saved in
 * scripts/.renewal-demo-state.json and restored by --cleanup.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = path.join(ROOT, "scripts/.renewal-demo-state.json");
const CSV_FILE = path.join(ROOT, "docs/samples/rent-roll-demo-aplreview.csv");

const COMMUNITY = "APLREVIEW";
const EMAIL_RE = /^demo\.neighbor\d{3}@miyora-app\.com$/;
const WINDOW_WEEKS = 12; // keep in step with ENGAGED_RULE in lib/renewal.ts
const SPREAD_DAYS = 80; // lease end dates fall in the last ~80 days
const BACKDATE_WEEKS = 30;
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const historyPostId = (i) => `5eed0020-0000-4000-8000-${String(i).padStart(12, "0")}`;

const APPLY = process.argv.includes("--apply");
const BACKDATE = process.argv.includes("--backdate");
const CLEANUP = process.argv.includes("--cleanup");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Run with --env-file=.env.local (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)");
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const must = (label) => ({ data, error }) => {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
};

// Deterministic so re-runs produce the same demo.
let seed = 20261109;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const mondayOf = (ms) => {
  const d = new Date(ms);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;
};

const HISTORY_TEXT = [
  "Anyone up for a pickup game at the court this weekend?",
  "Found a set of keys by the mailroom — left them at the front desk.",
  "The new coffee spot on the corner is great, highly recommend the cold brew.",
  "Thanks to whoever helped carry my couch up yesterday!",
  "Pool's open late tonight if anyone wants to swim.",
  "Does anyone have a ladder I could borrow for an hour?",
  "Farmers market is back on Saturday mornings.",
  "Lost cat: grey tabby, answers to Miso. Please message me!",
  "Book swap shelf in the lobby is stocked again.",
  "Who's watching the game tonight? Clubhouse TV is free.",
];

async function demoNeighbors() {
  const profiles = await sb
    .from("profiles")
    .select("id, email, unit_number, created_at, role, exclude_from_leaderboard")
    .eq("community_code", COMMUNITY)
    .then(must("profiles"));
  return profiles
    .filter((p) => p.email && EMAIL_RE.test(p.email) && p.role === "resident" && !p.exclude_from_leaderboard && p.unit_number)
    .sort((a, b) => a.email.localeCompare(b.email));
}

async function plan() {
  const community = await sb
    .from("communities")
    .select("community_code, created_at, property_manager_id, organization_id")
    .eq("community_code", COMMUNITY)
    .maybeSingle()
    .then(must("community"));
  if (!community) throw new Error(`${COMMUNITY} not found`);
  for (const t of ["lease_records", "rent_roll_uploads"]) {
    const { error } = await sb.from(t).select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error(`${t} is missing — apply portal migration 036 first (${error.message})`);
  }
  const neighbors = await demoNeighbors();
  if (neighbors.length < 20) throw new Error(`Only ${neighbors.length} demo neighbours in ${COMMUNITY}; run Miyora scripts/seed-demo-marketing.mjs first`);

  const now = Date.now();
  const latestEnd = mondayOf(now) - DAY; // last Sunday: leases have ended, windows are complete weeks
  const earliestEnd = latestEnd - SPREAD_DAYS * DAY;
  const createdWeek = mondayOf(Date.parse(community.created_at));
  const newestNeighbor = Math.max(...neighbors.map((n) => Date.parse(n.created_at)));
  const tooNewCommunity = mondayOf(earliestEnd) - WINDOW_WEEKS * WEEK < createdWeek;
  // Residents must have joined before the earliest lease's window begins.
  const tooNewPeople = newestNeighbor > mondayOf(earliestEnd) - WINDOW_WEEKS * WEEK;

  const managers = await sb.from("property_managers").select("id, full_name, email, organization_id").then(must("pms"));
  const manager = managers.filter(
    (m) => m.id === community.property_manager_id || (m.organization_id && m.organization_id === community.organization_id),
  );

  console.log(`${COMMUNITY}: created ${community.created_at.slice(0, 10)}, ${neighbors.length} demo neighbours`);
  console.log(`Managed in the portal by: ${manager.map((m) => `${m.full_name} <${m.email}>`).join(", ") || "NOBODY — the upload will be refused"}`);
  console.log(`Lease ends: ${isoDay(earliestEnd)} … ${isoDay(latestEnd)}`);
  if (tooNewCommunity) console.log(`! ${COMMUNITY} is newer than ${WINDOW_WEEKS} weeks before the earliest lease end`);
  if (tooNewPeople) console.log(`! Some demo neighbours joined less than ${WINDOW_WEEKS} weeks before the earliest lease end (newest: ${new Date(newestNeighbor).toISOString().slice(0, 10)})`);
  return { community, neighbors, earliestEnd, latestEnd, needsBackdate: tooNewCommunity || tooNewPeople };
}

async function apply() {
  const p = await plan();
  if (!APPLY) {
    console.log(p.needsBackdate ? "\nDry run. Re-run with --apply --backdate." : "\nDry run. Re-run with --apply.");
    return;
  }
  if (p.needsBackdate && !BACKDATE) throw new Error("History is too short for the 12-week rule. Re-run with --apply --backdate.");
  if (existsSync(STATE_FILE)) throw new Error("Already seeded (scripts/.renewal-demo-state.json exists). Run --cleanup first.");

  const state = { community_created_at: null, profile_created_at: {}, posts: [] };
  if (p.needsBackdate) {
    const back = (iso) => new Date(Date.parse(iso) - BACKDATE_WEEKS * WEEK).toISOString();
    // Record every original date BEFORE the first update, so a crash midway
    // can still be undone by --cleanup.
    state.community_created_at = p.community.created_at;
    for (const n of p.neighbors) state.profile_created_at[n.id] = n.created_at;
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    await sb.from("communities").update({ created_at: back(p.community.created_at) }).eq("community_code", COMMUNITY).then(must("backdate community"));
    for (const n of p.neighbors) {
      await sb.from("profiles").update({ created_at: back(n.created_at) }).eq("id", n.id).eq("community_code", COMMUNITY).then(must("backdate profile"));
    }
  }
  // Save before writing activity so a crash midway can still be cleaned up.
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  // Leases: one per neighbour, end dates spread evenly; ~60% engaged.
  const leases = p.neighbors.map((n, i) => {
    const end = p.earliestEnd + Math.round(((p.latestEnd - p.earliestEnd) * i) / (p.neighbors.length - 1) / DAY) * DAY;
    return { neighbor: n, end, engaged: rand() < 0.6 };
  });

  // One history post per week covering every window.
  const firstWeek = mondayOf(p.earliestEnd) - WINDOW_WEEKS * WEEK;
  const lastWeek = mondayOf(p.latestEnd) - WEEK;
  const engagedIds = leases.filter((l) => l.engaged).map((l) => l.neighbor.id);
  const posts = [];
  for (let w = firstWeek, i = 1; w <= lastWeek; w += WEEK, i++) {
    posts.push({
      id: historyPostId(i),
      community_code: COMMUNITY,
      user_id: engagedIds[i % engagedIds.length],
      content: HISTORY_TEXT[i % HISTORY_TEXT.length],
      created_at: new Date(w + DAY + 17 * 3600_000).toISOString(), // Tuesday 17:00 UTC
    });
  }
  state.posts = posts.map((x) => x.id);
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  await sb.from("posts").insert(posts).then(must("history posts"));

  // Engaged neighbours like 3–6 history posts inside their own window.
  const likes = [];
  for (const l of leases.filter((x) => x.engaged)) {
    const endWeek = mondayOf(l.end);
    const inWindow = posts.filter((x) => {
      const t = Date.parse(x.created_at);
      return t >= endWeek - WINDOW_WEEKS * WEEK && t < endWeek && x.user_id !== l.neighbor.id;
    });
    const count = 3 + Math.floor(rand() * 4);
    for (const post of [...inWindow].sort(() => rand() - 0.5).slice(0, count)) {
      likes.push({ post_id: post.id, user_id: l.neighbor.id, created_at: new Date(Date.parse(post.created_at) + 3 * 3600_000).toISOString() });
    }
  }
  await sb.from("post_likes").insert(likes).then(must("history likes"));

  // The CSV the PM uploads.
  const rows = leases.map((l, i) => {
    const pending = i === leases.length - 1 || i === leases.length - 2;
    const renewed = rand() < (l.engaged ? 0.8 : 0.55);
    return [l.neighbor.unit_number, isoDay(l.end), pending ? "Pending" : renewed ? "Renewed" : "Moved out"];
  });
  // Vacant units with no resident on Miyora → "not matched" note.
  for (const [unit, daysAgo] of [["9901", 20], ["9902", 45], ["9903", 70]]) {
    rows.push([unit, isoDay(p.latestEnd - daysAgo * DAY), "Moved out"]);
  }
  mkdirSync(path.dirname(CSV_FILE), { recursive: true });
  writeFileSync(CSV_FILE, ["Unit,Lease End Date,Renewal Outcome", ...rows.map((r) => r.join(","))].join("\n") + "\n");

  const engaged = leases.filter((l) => l.engaged).length;
  console.log(`\nSeeded ${posts.length} history posts and ${likes.length} likes.`);
  console.log(`${engaged} leases set up as engaged, ${leases.length - engaged} as others (existing app activity can move a few).`);
  console.log(`Wrote ${path.relative(ROOT, CSV_FILE)} (${rows.length} leases).`);
  console.log(`Next: upload it on ${COMMUNITY}'s Renewals tab, then open Insights → 90 days.`);
}

async function cleanup() {
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : null;
  const postIds = state?.posts ?? [];
  if (postIds.length > 0) {
    await sb.from("notifications").delete().in("target_id", postIds).then(must("notifications"));
    await sb.from("post_likes").delete().in("post_id", postIds).then(must("likes"));
    await sb.from("posts").delete().in("id", postIds).eq("community_code", COMMUNITY).then(must("posts"));
  }
  await sb.from("lease_records").delete().eq("community_code", COMMUNITY).then(must("lease records"));
  await sb.from("rent_roll_uploads").delete().eq("community_code", COMMUNITY).then(must("uploads"));
  if (state?.community_created_at) {
    await sb.from("communities").update({ created_at: state.community_created_at }).eq("community_code", COMMUNITY).then(must("restore community"));
  }
  for (const [id, created] of Object.entries(state?.profile_created_at ?? {})) {
    await sb.from("profiles").update({ created_at: created }).eq("id", id).eq("community_code", COMMUNITY).then(must("restore profile"));
  }
  if (existsSync(STATE_FILE)) rmSync(STATE_FILE);
  console.log(`Removed ${postIds.length} history posts, their likes and notifications, and ${COMMUNITY}'s lease data${state?.community_created_at ? "; restored created_at dates" : ""}.`);
}

(CLEANUP ? cleanup : apply)().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
