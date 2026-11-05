// A horizontal rail of Kino's own poster cards; each card opens this plugin's title page.

/** A card for [item] (a KinoItem with a cr: ref). */
export const cardNode = (railId, item) => ({
  type: "titleCard", key: `c-${railId}-${item.id}`, size: "medium", item, onTap: { event: "openTitle", arg: item.ref },
});

/** A heading over a horizontal row of cards; null when there are no items. */
export function railNode(id, title, items) {
  if (!Array.isArray(items) || !items.length) return null;
  return {
    type: "Column", key: "rail-" + id, gap: 8, children: [
      { type: "Text", key: "rt-" + id, style: "h4", text: title, textEn: title },
      { type: "SingleChildScrollView", key: "rs-" + id, direction: "horizontal", children: [
        { type: "Row", key: "rr-" + id, gap: 12, children: items.map((it) => cardNode(id, it)) },
      ] },
    ],
  };
}

/** A wrapping grid of cards (search and genre results). */
export function gridNode(id, items) {
  return { type: "Row", key: "grid-" + id, wrap: true, gap: 12, children: items.map((it) => cardNode(id, it)) };
}
