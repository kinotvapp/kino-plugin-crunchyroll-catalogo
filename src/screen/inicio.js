import { homeRows } from "../rows.js";
import { newEpisodesRow } from "../episodeWatch.js";
import { tw } from "../i18n.js";
import { railNode } from "./rails.js";

/** The Inicio tab: the new-episodes row of the followed series, then Crunchyroll's own rows. */
export async function inicioBody() {
  const rows = [];
  try {
    const epRow = newEpisodesRow();
    if (epRow) rows.push(epRow);
  } catch { /* kino.shared may not be ready */ }
  let failed = false;
  try {
    rows.push(...(await homeRows(kino.config)));
  } catch {
    failed = true;
  }
  const rails = rows.map((row) => railNode(row.id, row.title, row.items)).filter(Boolean);
  if (!rails.length) {
    return failed
      ? { type: "errorState", key: "homeFailed", icon: "refresh", ...tw("failedTitle", "title"), ...tw("failedText") }
      : { type: "emptyState", key: "homeNothing", icon: "movie", ...tw("nothingTitle", "title") };
  }
  return { type: "Column", key: "inicio", gap: 24, children: rails };
}
