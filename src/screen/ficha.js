// The title page of a Crunchyroll series or movie, from CR's API: backdrop, name, facts, "Buscar dónde verlo", Seguir,
// genres, synopsis, the season chips with that season's episodes, and similar titles (each opens its own page). TMDB only
// adds the id "Buscar dónde verlo" opens Kino's title page with; without it the button opens Kino's search on every source.
// On a TV the D-pad walks: Back, "Buscar dónde verlo" (autofocus), Seguir, the season chips, the episodes, the similar cards.
import { api } from "../api.js";
import { mapAny, mapEpisode, mapMovie, mapSeries, parseRef } from "../map.js";
import { pickSeasons } from "../seasons.js";
import { isFollowing } from "../follows.js";
import { contentLocale } from "../config.js";
import { same, tw } from "../i18n.js";

/** Episodes drawn before "Ver los restantes" (the tree has 600 nodes), and the most it ever draws. */
export const EPISODES_SHOWN = 30;
const EPISODES_MAX = 80;
const SIMILAR_MAX = 20;

const sectionTitle = (key) => ({ type: "Text", style: "h4", ...tw(key) });

const failedPage = () => ({
  type: "Column", key: "titleFailed", gap: 12, crossAxisAlignment: "center", children: [
    { type: "errorState", icon: "refresh", ...tw("failedTitle", "title"), ...tw("failedText") },
  ],
});

/** TMDB's id for [item], or null: one search, the first answer of the same kind (and year when CR has one). */
async function tmdbIdOf(item) {
  if (typeof kino.tmdb !== "function") return null;
  try {
    const path = item.kind === "movie" ? "/search/movie" : "/search/tv";
    const yearKey = item.kind === "movie" ? "year" : "first_air_date_year";
    const r = await kino.tmdb(path, { query: item.title, ...(item.year ? { [yearKey]: item.year } : {}) });
    const id = r?.results?.[0]?.id;
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** The go of "Buscar dónde verlo": Kino's title page by TMDB id, else Kino's search on every source. */
function whereGo(item, tmdbId) {
  const title = String(item.title).slice(0, 120);
  if (tmdbId) return { titleByIds: { tmdb: tmdbId, kind: item.kind, title, ...(item.year ? { year: Number(item.year) } : {}) } };
  return { search: { q: title.slice(0, 200), scope: "all" } };
}

function hero(item) {
  const children = [];
  if (item.backdrop) children.push({ type: "Image", key: "tbackdrop", url: item.backdrop, aspect: "16:9", fit: "cover", focus: "top", ...same(item.title, "alt") });
  children.push({ type: "Text", key: "ttitle", style: "h2", ...same(item.title) });
  return { type: "Column", key: "thero", gap: 12, children };
}

function facts(item, seasonCount) {
  const parts = [];
  if (item.year) parts.push([String(item.year), String(item.year)]);
  if (seasonCount) {
    const t = tw("seasonsCount", "text", seasonCount);
    parts.push([t.text, t.textEn]);
  }
  if (!parts.length) return null;
  return { type: "Text", key: "tfacts", color: "muted", text: parts.map((p) => p[0]).join(" · "), textEn: parts.map((p) => p[1]).join(" · ") };
}

function actions(item, crId, tmdbId) {
  const buttons = [{ type: "ElevatedButton", key: "twhere", icon: "search", autofocus: true, ...tw("findWhere", "labelText"), onPressed: { go: whereGo(item, tmdbId) } }];
  if (item.kind === "series") {
    const arg = JSON.stringify({ crId, name: String(item.title).slice(0, 120), ...(item.poster ? { poster: item.poster } : {}) });
    buttons.push(isFollowing(crId)
      ? { type: "Button", variant: "secondary", key: "tunfollow", icon: "check", ...tw("unfollow", "labelText"), onPressed: { event: "titleUnfollow", arg } }
      : { type: "Button", variant: "secondary", key: "tfollow", icon: "add", ...tw("follow", "labelText"), onPressed: { event: "titleFollow", arg } });
  }
  return { type: "Row", key: "tactions", wrap: true, gap: 12, children: buttons };
}

function seasonsBlock(seasons, value) {
  return {
    type: "Column", key: "tseasons", gap: 8, children: [
      sectionTitle("seasons"),
      { type: "Chips", key: "season", value, onChanged: "titleSeason", options: seasons.map((s) => ({ value: s.id, ...(s.number >= 1 ? tw("season", "label", s.number) : tw("specials", "label")) })) },
    ],
  };
}

function episodeRow(e, i) {
  const n = e.number ?? i + 1;
  const titleOf = e.title ? { title: `${n}. ${e.title}`, titleEn: `${n}. ${e.title}` } : tw("episode", "title", n);
  const parts = [];
  if (e.airDate) parts.push([e.airDate, e.airDate]);
  if (e.runtimeMinutes) {
    const r = tw("episodeRuntime", "text", e.runtimeMinutes);
    parts.push([r.text, r.textEn]);
  }
  return {
    type: "ListTile", key: "te-" + i, dense: true, ...titleOf,
    ...(parts.length ? { subtitle: parts.map((p) => p[0]).join(" · "), subtitleEn: parts.map((p) => p[1]).join(" · ") } : {}),
    ...(e.premium ? { trailing: { type: "Badge", ...tw("premiumBadge") } } : {}),
    canRequestFocus: true,
  };
}

function episodesBlock(list, { failed, all }) {
  const body = [];
  if (failed) {
    body.push({ type: "Text", color: "muted", ...tw("episodesFailed") });
  } else if (!list.length) {
    body.push({ type: "Text", color: "muted", ...tw("noEpisodes") });
  } else {
    const limit = all ? EPISODES_MAX : EPISODES_SHOWN;
    body.push(...list.slice(0, limit).map(episodeRow));
    const more = Math.min(list.length, EPISODES_MAX) - limit;
    if (more > 0) body.push({ type: "TextButton", key: "temore", icon: "expand_more", ...tw("showAll", "labelText", more), onPressed: "titleEpisodesAll" });
  }
  return { type: "Column", key: "tepisodes", gap: 4, children: [sectionTitle("episodes"), ...body] };
}

function similarBlock(items) {
  return {
    type: "Column", key: "tsimilar", gap: 8, children: [
      sectionTitle("similarTitles"),
      { type: "SingleChildScrollView", key: "tsimilar-scroll", direction: "horizontal", children: [{
        type: "Row", key: "tsimilar-row", gap: 12, children: items.map((s) => ({
          type: "titleCard", key: "ts-" + s.id, size: "small", item: s, onTap: { event: "openTitle", arg: s.ref },
        })),
      }] },
    ],
  };
}

/** The page body of [ref] (a cr:series: or cr:movie: ref); [state] holds the chosen season and "Ver los restantes". */
export async function fichaBody({ ref, state = {} } = {}) {
  const r = parseRef(ref);
  if (!r) return { type: "Column", key: "titleBody", gap: 12, children: [failedPage()] };
  const locale = contentLocale(kino.config);
  const isSeries = r.kind === "series";

  let raw;
  let seasonsRaw = [];
  let similarRaw = [];
  try {
    [raw, seasonsRaw, similarRaw] = await Promise.all([
      isSeries ? api.series(r.crId, locale) : api.movieListing(r.crId, locale),
      isSeries ? api.seasons(r.crId, locale).catch(() => []) : Promise.resolve([]),
      api.similarTo(r.crId, locale).catch(() => []),
    ]);
  } catch {
    return { type: "Column", key: "titleBody", gap: 12, children: [failedPage()] };
  }
  if (!raw || typeof raw.id !== "string" || typeof raw.title !== "string") {
    return { type: "Column", key: "titleBody", gap: 12, children: [failedPage()] };
  }
  const item = isSeries ? mapSeries(raw) : mapMovie(raw);
  const seasons = isSeries ? pickSeasons(seasonsRaw) : [];
  const mine = state.title && typeof state.title === "object" && state.title.ref === ref ? state.title : {};
  const season = seasons.find((s) => s.id === mine.season) ?? seasons.find((s) => s.number >= 1) ?? seasons[0] ?? null;

  const [tmdbId, epResult] = await Promise.all([
    tmdbIdOf(item),
    season
      ? api.episodes(season.id, locale).then((list) => ({ list }), () => ({ list: [], failed: true }))
      : Promise.resolve(null),
  ]);

  const parts = [hero(item)];
  const f = facts(item, seasons.length);
  if (f) parts.push(f);
  parts.push(actions(item, r.crId, tmdbId));
  if (item.genres?.length) parts.push({ type: "Row", key: "tgenres", wrap: true, gap: 8, children: item.genres.map((g, i) => ({ type: "Badge", key: "tg-" + i, ...same(g) })) });
  if (item.overview) parts.push({ type: "Column", key: "toverview", gap: 8, children: [sectionTitle("overview"), { type: "Text", canRequestFocus: true, ...same(item.overview.slice(0, 2000)) }] });
  if (seasons.length > 1) parts.push(seasonsBlock(seasons, season.id));
  if (epResult) {
    const list = epResult.list
      .map((ep) => ({ ...mapEpisode(ep), premium: !!ep.is_premium_only }))
      .filter((e) => Number.isInteger(e.number))
      .sort((a, b) => a.number - b.number);
    parts.push(episodesBlock(list, { failed: !!epResult.failed, all: mine.all === true }));
  }
  const similar = (Array.isArray(similarRaw) ? similarRaw : []).map(mapAny).filter((s) => s && s.ref !== item.ref).slice(0, SIMILAR_MAX);
  if (similar.length) parts.push(similarBlock(similar));
  return { type: "Column", key: "titleBody", gap: 16, children: parts };
}
