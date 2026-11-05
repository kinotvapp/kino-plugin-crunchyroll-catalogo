// src/search.js — Crunchyroll search results mapped to Kino items

import { api } from "./api.js";
import { mapAny } from "./map.js";
import { contentLocale, kindAllowed } from "./config.js";

/**
 * Search the Crunchyroll catalogue. [query] is Kino's KinoSearchQuery ({ q, type, ... }) or, from the plugin's own screen,
 * a plain string. Blank queries, and a Kino search for music or podcasts, return [] without calling the API.
 * @returns {Promise<object[]>} KinoItem[] in CR's order, without repeats
 */
export async function searchItems(config, query) {
  const raw = typeof query === "string" ? query : query?.q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 200) : "";
  const type = typeof query === "object" && query ? query.type : "any";
  if (q === "" || type === "music" || type === "podcast") return [];

  const groups = await api.search(q, 20, contentLocale(config));
  const seen = new Set();
  const items = [];
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const cr of group?.items ?? []) {
      const item = mapAny(cr);
      if (!item || seen.has(item.id)) continue;
      if (!kindAllowed(config, item.kind)) continue;
      if ((type === "movie" || type === "series") && item.kind !== type) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}
