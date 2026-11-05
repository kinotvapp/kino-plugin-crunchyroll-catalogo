// Crunchyroll Catálogo — the plugin's exports. Built into the shipped plugin.js by `npm run build`.
import { homeRows, rowPage } from "./rows.js";
import { searchItems } from "./search.js";
import { checkEpisodes, newEpisodesRow } from "./episodeWatch.js";
import { api } from "./api.js";
import { mapEpisode, parseRef } from "./map.js";
import { seasonsOf } from "./seasons.js";
import { contentLocale, homeRowsOn } from "./config.js";
import { makeScreenApp } from "./screen/index.js";

const app = makeScreenApp();

export async function home() {
  if (!homeRowsOn(kino.config)) return [];
  let episodesRow = null;
  try {
    episodesRow = newEpisodesRow();
  } catch { /* no kino.shared */ }
  const rows = await homeRows(kino.config);
  return episodesRow ? [episodesRow, ...rows] : rows;
}

export async function browse(ref, cursor) {
  return rowPage(kino.config, ref, cursor);
}

export async function search(query) {
  return searchItems(kino.config, query);
}

/** The episodes of a series, every numbered season (Kino reads 1..999: specials, season 0, stay on the title page). */
export async function episodes(ref) {
  const r = parseRef(ref);
  if (!r) throw kino.error("not_found", "Unknown ref: " + ref);
  if (r.kind === "movie") return { episodes: [] };
  const locale = contentLocale(kino.config);
  const seasons = (await seasonsOf(r.crId, locale)).filter((s) => s.number >= 1 && s.number <= 999);
  const lists = await Promise.all(seasons.map((s) => api.episodes(s.id, locale).catch(() => [])));
  const episodes = [];
  seasons.forEach((s, i) => {
    for (const ep of lists[i]) {
      const e = mapEpisode(ep);
      if (!Number.isInteger(e.number) || e.number < 1) continue;
      episodes.push({ ...e, season: s.number });
    }
  });
  return { episodes };
}

export async function screen(ctx) {
  return app.screen(ctx);
}

export async function screenEvent(ev) {
  return app.screenEvent(ev);
}

export async function job(ctx) {
  if (ctx && ctx.id === "episodes") return checkEpisodes(ctx);
  return null;
}
