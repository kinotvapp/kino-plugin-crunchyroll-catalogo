// New episodes of the followed CR series: the `episodes` job and the Home row it feeds (newEpisodesRow).
//
// The job asks CR's API for the seasons + latest-season episodes of up to 4 followed series per run (Kino allows a job 10
// requests: the token, then 2 per series)
// (a rotating cursor in kino.storage covers all follows over successive runs). A series whose last
// aired episode is newer than its `seen` gets one notice in the Home bell and a `latest`, which is
// all the Home row reads, so the row never calls the CR API.
// Nothing but an episode already aired (on or before today) counts: future air_dates are ignored.
import { api } from "./api.js";
import { list, updateMany } from "./follows.js";
import { SCREEN_TEXT, t, tl } from "./i18n.js";
import { contentLocale } from "./config.js";
import { refOf } from "./map.js";

export const MAX_PER_RUN = 4;
const CURSOR_KEY = "crEpCursor";
const DAY_MS = 86400000;
const DEFAULT_NEW_EP_DAYS = 14;

const isoToday = () => new Date().toISOString().slice(0, 10);
const dayBefore = (today, days) => new Date(Date.parse(today + "T00:00:00Z") - days * DAY_MS).toISOString().slice(0, 10);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function readCursor(n) {
  const c = Number.parseInt(kino.storage.get(CURSOR_KEY), 10);
  return Number.isInteger(c) && c >= 0 && c < n ? c : 0;
}

const localeOf = () => contentLocale(kino.config);

/** Latest aired episode in `episodes` array (air_date <= today), by max season_number then max episode_number, or null. */
function latestAired(episodes, today) {
  let best = null;
  for (const ep of episodes) {
    if (!ep || typeof ep.air_date !== "string" || ep.air_date > today) continue;
    if (
      best === null ||
      ep.season_number > best.season_number ||
      (ep.season_number === best.season_number && ep.episode_number > best.episode_number)
    ) {
      best = ep;
    }
  }
  return best;
}

/** Is [ep] (a CREpisode) newer than [seen] (a follow.seen = { season, number, airDate })? */
function isNewer(ep, seen) {
  if (!seen) return false;
  return ep.season_number > seen.season ||
    (ep.season_number === seen.season && ep.episode_number > seen.number);
}

/**
 * Is [ep] (a follow.latest / follow.seen = { season, number }) newer than [seen]? For comparing two follow records.
 * Used by newEpisodesRow – not for CRSeason objects.
 */
function isNewerRecord(a, b) {
  if (!b) return true;
  return a.season > b.season || (a.season === b.season && a.number > b.number);
}

/** Build the notification for a new episode; tapping it opens the series' page in this plugin's screen. */
function noticeOf(follow, ep) {
  const name = clip(follow.name, 60);
  const sn = ep.season_number;
  const en = ep.episode_number;
  const [seasonEs, seasonEn] = SCREEN_TEXT.seasonShort;
  const [outEs, outEn] = SCREEN_TEXT.isOut;
  const [newEs, newEn] = SCREEN_TEXT.newEpisodeOf;
  const label = (p) => `${p}${sn}·E${en}`;
  const quoted = ep.title ? clip(ep.title, 100) : "";
  const text = ep.title
    ? [`${label(seasonEs)} «${quoted}» ${outEs}`, `${label(seasonEn)} "${quoted}" ${outEn}`]
    : [`${label(seasonEs)} ${outEs}`, `${label(seasonEn)} ${outEn}`];
  const id = ("cr-ep-" + follow.crId + "-" + ep.id).replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 64);
  const notice = {
    id,
    title: `${newEs} ${name}`,
    titleEn: `${newEn} ${name}`,
    text: text[0],
    textEn: text[1],
  };
  notice.go = { screen: { route: "title", args: { ref: refOf("series", follow.crId) } } };
  return notice;
}

/** Tries to post the notice. true: posted or never will be (no bell / permission denied). false: retry next run. */
async function notify(follow, ep) {
  if (typeof kino.notifications !== "object" || !kino.notifications || typeof kino.notifications.post !== "function") {
    return { posted: false, retry: false };
  }
  try {
    await kino.notifications.post(noticeOf(follow, ep));
    return { posted: true, retry: false };
  } catch (err) {
    const denied = err && (err.code === "permission_denied" || err.code === "not_allowed");
    return { posted: false, retry: !denied };
  }
}

/**
 * The `episodes` job: `{ checked, posted, failed }`. A CR API error on one series leaves its `seen`
 * alone and the others continue; a notice that could not be posted (rate limit) keeps `seen` so the
 * next run retries, while the Home row still learns via `latest`.
 */
export async function checkEpisodes(ctx, { today = isoToday() } = {}) {
  const summary = { checked: 0, posted: 0, failed: 0 };
  const follows = list();
  if (!follows.length) return summary;

  const start = readCursor(follows.length);
  const count = Math.min(MAX_PER_RUN, follows.length);
  const locale = localeOf();

  let done = 0;
  const save = (patches) => {
    updateMany(patches);
    kino.storage.set(CURSOR_KEY, String((start + done) % follows.length));
  };

  for (let i = 0; i < count; i++) {
    const patches = new Map();
    done = i + 1;
    const follow = follows[(start + i) % follows.length];
    summary.checked++;

    // Fetch seasons
    let seasons;
    try {
      seasons = await api.seasons(follow.crId, locale);
    } catch {
      summary.failed++;
      save(patches);
      continue;
    }
    if (!Array.isArray(seasons) || seasons.length === 0) {
      save(patches);
      continue;
    }

    // Pick the latest season (highest season_number)
    const latestSeason = seasons.reduce((best, s) =>
      !best || (s.season_number ?? 0) > (best.season_number ?? 0) ? s : best, null);
    if (!latestSeason) { save(patches); continue; }

    // Fetch episodes of that season
    let episodes;
    try {
      episodes = await api.episodes(latestSeason.id, locale);
    } catch {
      summary.failed++;
      save(patches);
      continue;
    }
    if (!Array.isArray(episodes)) { save(patches); continue; }

    const latest = latestAired(episodes, today);
    if (!latest) { save(patches); continue; }

    const baseline = { season: latest.season_number, number: latest.episode_number, airDate: latest.air_date };

    // First check: take the baseline silently (no notice for what was already out)
    if (follow.seen === null) {
      patches.set(follow.crId, (f) => { if (f.seen === null) f.seen = baseline; });
      save(patches);
      continue;
    }

    // No new episode
    if (!isNewer(latest, follow.seen)) { save(patches); continue; }

    const outcome = await notify(follow, latest);
    if (outcome.posted) summary.posted++;

    patches.set(follow.crId, (f) => {
      const fresh = !f.latest || isNewerRecord(baseline, f.latest);
      f.latest = {
        season: latest.season_number,
        number: latest.episode_number,
        airDate: latest.air_date,
        ...(latest.title ? { title: latest.title } : {}),
      };
      if (fresh) delete f.ackedAt; // a new episode makes the series show again in the Home row
      if (!outcome.retry) f.seen = baseline;
    });
    save(patches);
  }

  return summary;
}

/**
 * The Home row "Capítulos nuevos de tus series", or null: the followed series whose `latest` episode
 * aired inside the last DEFAULT_NEW_EP_DAYS (14) days and that have not been marked as seen, newest first.
 * Reads kino.shared only — never calls the CR API.
 */
export function newEpisodesRow({ today = isoToday() } = {}) {
  const from = dayBefore(today, DEFAULT_NEW_EP_DAYS);
  const fresh = list()
    .filter((f) => f.latest && !f.ackedAt && f.latest.airDate >= from && f.latest.airDate <= today)
    .sort((a, b) =>
      a.latest.airDate === b.latest.airDate ? 0 : a.latest.airDate < b.latest.airDate ? 1 : -1
    );
  if (!fresh.length) return null;
  const code = (s, e) => `${t("T", "S")}${s}·E${e}`;
  return {
    id: "episodes",
    title: tl("newEpisodesRow"),
    items: fresh.map((f) => {
      const ref = refOf("series", f.crId);
      const item = {
        id: "series-" + f.crId,
        ref,
        kind: "series",
        open: { screen: { route: "title", args: { ref } } },
        title: f.name,
        badges: [t(`${code(f.latest.season, f.latest.number)} nuevo`, `${code(f.latest.season, f.latest.number)} new`)],
      };
      if (f.tmdbId) item.ids = { tmdb: f.tmdbId };
      if (f.poster) item.poster = f.poster;
      return item;
    }),
  };
}
