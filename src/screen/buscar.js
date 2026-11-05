import { api } from "../api.js";
import { rowPage } from "../rows.js";
import { searchItems } from "../search.js";
import { contentLocale } from "../config.js";
import { same, tw } from "../i18n.js";
import { gridNode } from "./rails.js";

const searchField = (q) => ({
  type: "TextField", key: "q", kind: "search", value: q, maxLength: 200,
  ...tw("tabSearch", "labelText"), ...tw("searchHint", "hintText"),
  onSubmitted: "searchSubmit",
  trailingIcon: "search", ...tw("tabSearch", "trailingLabel"), onTrailingTap: "searchSubmit",
});

/** The Buscar page: the search box, then the results, a genre's titles, or the genre list to pick from. */
export async function buscarBody({ state = {} } = {}) {
  const q = typeof state.q === "string" ? state.q : "";
  const genre = typeof state.genre === "string" && state.genre ? state.genre : null;
  const children = [searchField(q)];

  if (q.trim()) {
    let results = [];
    let failed = false;
    try {
      results = await searchItems(kino.config, q);
    } catch {
      failed = true;
    }
    if (failed) children.push({ type: "errorState", key: "searchFailed", icon: "refresh", ...tw("failedTitle", "title"), ...tw("failedText") });
    else if (!results.length) children.push({ type: "emptyState", key: "noResults", icon: "search", ...tw("noResults", "title") });
    else children.push(gridNode("search", results));
    return { type: "Column", key: "buscar", gap: 16, children };
  }

  if (genre) {
    children.push({ type: "TextButton", key: "allGenres", icon: "arrow_back", ...tw("browseByGenre", "labelText"), onPressed: "clearGenre" });
    try {
      const page = await rowPage(kino.config, `cr:cat:${genre}`, null);
      children.push(page.items.length ? gridNode("genre", page.items) : { type: "emptyState", key: "noResults", icon: "search", ...tw("noResults", "title") });
    } catch {
      children.push({ type: "errorState", key: "genreFailed", icon: "refresh", ...tw("failedTitle", "title"), ...tw("failedText") });
    }
    return { type: "Column", key: "buscar", gap: 16, children };
  }

  try {
    const cats = await api.categories(contentLocale(kino.config));
    const options = cats.filter((c) => typeof c?.id === "string" && c.id).slice(0, 40);
    if (options.length) {
      children.push({ type: "Text", key: "genresTitle", style: "h4", ...tw("browseByGenre") });
      children.push({
        type: "Row", key: "genres", wrap: true, gap: 8, children: options.map((c) => ({
          type: "TextButton", key: "g-" + c.id, ...same(c.localization?.title ?? c.id, "labelText"), onPressed: { event: "openGenre", arg: c.id },
        })),
      });
    }
  } catch { /* the box still searches */ }
  return { type: "Column", key: "buscar", gap: 16, children };
}
