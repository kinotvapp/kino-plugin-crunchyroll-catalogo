// Series the person follows, in kino.shared key `crFollows` (syncs between devices). At most 10 (owner limit): the 11th
// is refused with a typed result in both languages, never dropped silently. UI-facing calls answer `{ ok, ... }` instead
// of throwing.
//
// A record: { crId, name, poster?, seen, latest?, ackedAt?, tmdbId? }
//   crId    CR series ID (primary key; e.g. "G1XHJV2XK")
//   seen    { season, number, airDate } the last aired episode already told about; null when the baseline is not yet known
//           (the first check takes it without a notice, same as mega-catalogo)
//   latest  { season, number, title?, airDate } the newest aired episode the job found since the follow
//   ackedAt ISO time of "Marcar como visto"; a newer episode clears it
//   tmdbId  resolved at follow time via kino.tmdb; optional (silent on failure)
import { t } from "./i18n.js";

export const MAX_FOLLOWS = 10;
const KEY = "crFollows";
const MAX_NAME = 120;
const MAX_URL = 300;
const CR_ID_RE = /^[A-Z0-9]+$/i;
const MAX_CR_ID = 30;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isCount = (n) => Number.isInteger(n) && n >= 0 && n < 100000;

function cleanEpisode(e, withTitle) {
  if (!e || typeof e !== "object" || !isCount(e.season) || !isCount(e.number) || typeof e.airDate !== "string" || !(DAY.test(e.airDate) || (e.airDate === "" && e.season === 0))) return null;
  const out = { season: e.season, number: e.number, airDate: e.airDate };
  if (withTitle && typeof e.title === "string" && e.title) out.title = e.title.slice(0, MAX_NAME);
  return out;
}

function cleanRecord(r) {
  if (!r || typeof r !== "object" || typeof r.crId !== "string" || !r.crId || !CR_ID_RE.test(r.crId) || r.crId.length > MAX_CR_ID || typeof r.name !== "string" || !r.name.trim()) return null;
  const out = { crId: r.crId, name: r.name.trim().slice(0, MAX_NAME), seen: cleanEpisode(r.seen, false) };
  if (typeof r.poster === "string" && /^https:\/\//.test(r.poster) && r.poster.length <= MAX_URL) out.poster = r.poster;
  const latest = cleanEpisode(r.latest, true);
  if (latest && DAY.test(latest.airDate)) out.latest = latest;
  if (typeof r.ackedAt === "string" && r.ackedAt.length <= 40) out.ackedAt = r.ackedAt;
  if (Number.isInteger(r.tmdbId) && r.tmdbId > 0) out.tmdbId = r.tmdbId;
  return out;
}

const hasShared = () => typeof kino !== "undefined" && kino && kino.shared && typeof kino.shared.get === "function";

function read() {
  let raw;
  try { raw = kino.shared.get(KEY); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const byId = new Map();
  for (const r of raw) {
    const c = cleanRecord(r);
    if (c && !byId.has(c.crId)) byId.set(c.crId, c);
  }
  return [...byId.values()].slice(0, MAX_FOLLOWS);
}

function write(items) {
  try { kino.shared.set(KEY, items); return true; } catch { return false; }
}

/** The followed series, validated (at most 10). Empty when kino.shared is absent. */
export function list() {
  return hasShared() ? read() : [];
}

/**
 * Is [crId] in the follow list? Pass [follows] to avoid re-reading; defaults to list().
 * Synchronous.
 */
export function isFollowing(crId, follows = list()) {
  return follows.some((f) => f.crId === crId);
}

const fail = (code, es, en) => ({ ok: false, code, message: t(es, en), messageEs: es, messageEn: en });
const noShared = () => fail("unavailable", "No se pueden guardar las series que sigues en este aparato", "The series you follow cannot be saved on this device");
const limitReached = (count) => ({
  ...fail("limit", `Ya sigues ${MAX_FOLLOWS} series. Deja de seguir una para agregar otra`, `You already follow ${MAX_FOLLOWS} series. Unfollow one to add another`),
  max: MAX_FOLLOWS,
  count,
});

/**
 * Follow [series] `{ crId, name, poster? }`. Answers `{ ok: true, added, count }`, or `{ ok: false, code, message,
 * messageEs, messageEn }` with code "limit" (11th; also `max`), "bad_request" or "unavailable".
 * At follow time, kino.tmdb is queried for the series' TMDB id (optional; silent on error).
 * The list is re-read AFTER the tmdb call (race-safe: another device may add one while this one waits).
 */
export async function follow(series) {
  if (!series || typeof series !== "object" || typeof series.crId !== "string" || !series.crId || !CR_ID_RE.test(series.crId) || series.crId.length > MAX_CR_ID || typeof series.name !== "string" || !series.name.trim()) {
    return fail("bad_request", "No se pudo seguir esta serie", "This series could not be followed");
  }
  if (!hasShared()) return noShared();
  const current = read();
  if (current.some((f) => f.crId === series.crId)) return { ok: true, added: false, count: current.length };
  if (current.length >= MAX_FOLLOWS) return limitReached(current.length);

  // Optionally resolve TMDB id — the follow is kept even when this fails
  let tmdbId;
  try {
    const r = await kino.tmdb("/search/tv", { query: series.name });
    if (r && Array.isArray(r.results) && r.results.length > 0 && Number.isInteger(r.results[0].id)) {
      tmdbId = r.results[0].id;
    }
  } catch { /* tmdb is optional */ }

  // Re-read fresh: another device may have added a record while tmdb was answering
  const fresh = read();
  if (fresh.some((f) => f.crId === series.crId)) return { ok: true, added: false, count: fresh.length };
  if (fresh.length >= MAX_FOLLOWS) return limitReached(fresh.length);

  const rec = { crId: series.crId, name: series.name, seen: null };
  if (typeof series.poster === "string") rec.poster = series.poster;
  if (tmdbId !== undefined) rec.tmdbId = tmdbId;
  fresh.push(cleanRecord(rec) || rec);
  if (!write(fresh)) return fail("unavailable", "No se pudo guardar la serie", "The series could not be saved");
  return { ok: true, added: true, count: fresh.length };
}

/** Stop following [crId]: `{ ok: true, removed }`. Synchronous. */
export function unfollow(crId) {
  if (!hasShared()) return noShared();
  const current = read();
  const rest = current.filter((f) => f.crId !== crId);
  if (rest.length === current.length) return { ok: true, removed: false };
  write(rest);
  return { ok: true, removed: true };
}

/**
 * "Marcar como visto": [crId], or every series when it is undefined. [at] is an ISO time (default now).
 * Synchronous.
 */
export function acknowledge(crId, at = new Date().toISOString()) {
  if (!hasShared()) return noShared();
  const current = read();
  for (const f of current) if (crId === undefined || f.crId === crId) f.ackedAt = at;
  write(current);
  return { ok: true };
}

/**
 * Apply [patches] (`Map<crId, fn(record)>`, each editing the record in place) to a fresh read of the list and write
 * it once. A series unfollowed meanwhile is skipped. Synchronous.
 */
export function updateMany(patches) {
  if (!hasShared() || !patches.size) return false;
  const current = read();
  let changed = false;
  for (const f of current) {
    const fn = patches.get(f.crId);
    if (fn) { fn(f); changed = true; }
  }
  return changed ? write(current.map((f) => cleanRecord(f) || f)) : false;
}
