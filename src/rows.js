// src/rows.js — home feed rows and browse page loader

import { api } from "./api.js";
import { mapAny } from "./map.js";
import { tl } from "./i18n.js";
import { browseType, contentLocale, kindAllowed } from "./config.js";

const ROW_ITEMS = 20;

/** CR objects -> Kino items the "kinds" setting lets through, at most Kino's 60 per row. */
function itemsOf(config, list) {
  return (Array.isArray(list) ? list : []).map(mapAny).filter((it) => it && kindAllowed(config, it.kind)).slice(0, 60);
}

/** A row id Kino accepts (^[A-Za-z0-9._~-]{1,128}$) from any CR id or tag. */
const rowId = (prefix, raw) => `${prefix}-${String(raw ?? "").replace(/[^A-Za-z0-9._~-]/g, "_")}`.slice(0, 128);

/**
 * Home rows: the CR home feed's browse panels, or (on any error or empty feed) newest, most popular, this season and the
 * first three genres. A built row's ref loads more through browse().
 * @returns {Promise<Array<{ id: string, title: string, ref: string, items: object[] }>>}
 */
export async function homeRows(config) {
  const locale = contentLocale(config);
  const type = browseType(config);

  try {
    const panels = await api.homeFeed(locale);
    const rows = (Array.isArray(panels) ? panels : [])
      .map((panel) => {
        const items = itemsOf(config, panel?.items);
        if (!items.length) return null;
        const title = panel.localization?.title ?? panel.title ?? "";
        if (!title) return null;
        // A feed panel names no browse query, so it has no "Ver más" rather than a wrong one.
        return { id: rowId("feed", panel.id ?? panel.resource_type), title, items };
      })
      .filter(Boolean);
    if (rows.length > 0) return rows;
  } catch {
    // fall through to the built rows
  }

  const [newResp, popResp, tagsArr, catsArr] = await Promise.all([
    api.browse({ n: ROW_ITEMS, sort_by: "newly_added", type, locale }).catch(() => null),
    api.browse({ n: ROW_ITEMS, sort_by: "popularity", type, locale }).catch(() => null),
    api.seasonalTags(locale).catch(() => []),
    api.categories(locale).catch(() => []),
  ]);

  // Nothing answered at all (no token, no network): an error for the screen, not an empty Home.
  if (!newResp && !popResp && !tagsArr.length && !catsArr.length) throw kino.error("unavailable", "Crunchyroll did not answer");

  const rows = [];
  const newItems = itemsOf(config, newResp?.data);
  if (newItems.length) rows.push({ id: "newly_added", title: tl("newOnCR"), ref: "cr:browse:newly_added", items: newItems });
  const popItems = itemsOf(config, popResp?.data);
  if (popItems.length) rows.push({ id: "popular", title: tl("popularOnCR"), ref: "cr:browse:popularity", items: popItems });

  const tag = Array.isArray(tagsArr) ? tagsArr[0] : null;
  const topCats = (Array.isArray(catsArr) ? catsArr : []).slice(0, 3);
  const extra = await Promise.allSettled([
    tag?.id || tag?.tag
      ? api.browse({ n: ROW_ITEMS, sort_by: "popularity", type, seasonal_tag: tag.id ?? tag.tag, locale }).then((r) => {
        const items = itemsOf(config, r?.data);
        const id = tag.id ?? tag.tag;
        return items.length ? { id: rowId("tag", id), title: tag.localization?.title ?? id, ref: `cr:tag:${id}`, items } : null;
      })
      : Promise.resolve(null),
    ...topCats.map((cat) => api.browse({ n: ROW_ITEMS, sort_by: "popularity", type, categories: cat.id, locale }).then((r) => {
      const items = itemsOf(config, r?.data);
      return items.length ? { id: rowId("cat", cat.id), title: cat.localization?.title ?? cat.id, ref: `cr:cat:${cat.id}`, items } : null;
    })),
  ]);
  for (const r of extra) if (r.status === "fulfilled" && r.value) rows.push(r.value);
  return rows;
}

/**
 * One page of a row. Refs: cr:browse:{sort_by} (newly_added, popularity, alphabetical), cr:tag:{seasonal tag}, cr:cat:{category}.
 * @returns {Promise<{ items: object[], next: string|null }>}
 */
export async function rowPage(config, ref, cursor) {
  const locale = contentLocale(config);
  const type = browseType(config);
  const start = Math.max(0, Number.parseInt(cursor ?? "0", 10) || 0);
  const n = ROW_ITEMS;
  const r = String(ref ?? "");

  let params;
  if (r.startsWith("cr:browse:")) {
    const sort = r.slice("cr:browse:".length).split(":")[0];
    params = { sort_by: ["newly_added", "popularity", "alphabetical"].includes(sort) ? sort : "newly_added" };
  } else if (r.startsWith("cr:tag:")) {
    params = { sort_by: "popularity", seasonal_tag: r.slice("cr:tag:".length) };
  } else if (r.startsWith("cr:cat:")) {
    params = { sort_by: "popularity", categories: r.slice("cr:cat:".length) };
  } else {
    throw kino.error("not_found", `Unknown browse ref: ${r}`);
  }

  const resp = await api.browse({ n, start, type, locale, ...params });
  const items = itemsOf(config, resp?.data);
  const total = Number(resp?.total ?? 0);
  const next = total > start + n && (resp?.data?.length ?? 0) > 0 ? String(start + n) : null;
  return { items, next };
}
