// Crunchyroll API objects -> Kino item and episode shapes. Pure functions: no network, no kino.* calls, no user-facing text.

/**
 * The source URL of the image whose width is closest to `preferredWidth`.
 * `images` is an array of `{ width, height, source }`. Returns null when there is no usable entry.
 */
export function pickImage(images, preferredWidth = 480) {
  if (!Array.isArray(images)) return null;
  let best = null;
  let bestDiff = Infinity;
  // CR v2 nests each set one level deeper ([[{...}]]); flat lists stay as they are.
  for (const image of images.flat()) {
    if (!image || typeof image.source !== "string" || !image.source) continue;
    const diff = Math.abs((image.width ?? 0) - preferredWidth);
    if (diff < bestDiff) {
      best = image.source;
      bestDiff = diff;
    }
  }
  return best;
}

/** The ref Kino hands back to episodes() and the screen's title route: "cr:series:<id>" or "cr:movie:<id>". */
export const refOf = (kind, crId) => `cr:${kind}:${crId}`;

/** A ref's kind and CR id, or null when it is not one of ours. */
export function parseRef(ref) {
  const m = /^cr:(series|movie):([A-Za-z0-9._~-]{1,64})$/.exec(String(ref ?? ""));
  return m ? { kind: m[1], crId: m[2] } : null;
}

function itemOf(kind, cr, year) {
  const ref = refOf(kind, cr.id);
  const overview = typeof cr.description === "string" && cr.description.trim() ? cr.description.trim() : undefined;
  const genres = Array.isArray(cr.keywords) ? cr.keywords.filter((k) => typeof k === "string" && k).slice(0, 5) : [];
  const poster = pickImage(cr.images?.poster_tall, 480) ?? pickImage(cr.images?.thumbnail, 480);
  const backdrop = pickImage(cr.images?.poster_wide, 1280) ?? pickImage(cr.images?.thumbnail, 1280);
  return {
    id: `${kind}-${cr.id}`,
    ref,
    kind,
    title: cr.title,
    ...(poster ? { poster } : {}),
    ...(backdrop ? { backdrop } : {}),
    ...(year ? { year } : {}),
    ...(overview ? { overview } : {}),
    ...(genres.length ? { genres } : {}),
    ...(cr.is_mature ? { adult: true } : {}),
    open: { screen: { route: "title", args: { ref } } },
  };
}

/** CRSeries -> Kino series item. */
export function mapSeries(cr) {
  return itemOf("series", cr, cr.series_launch_year ?? null);
}

/** CRMovieListing -> Kino movie item. */
export function mapMovie(cr) {
  return itemOf("movie", cr, cr.movie_release_year ?? cr.series_launch_year ?? null);
}

/** Any CR browse/search/similar object -> a Kino item, by its own `type`; null for types Kino cannot show. */
export function mapAny(cr) {
  if (!cr || typeof cr.id !== "string" || !cr.id || typeof cr.title !== "string" || !cr.title) return null;
  if (cr.type === "series") return mapSeries({ ...cr, ...(cr.series_metadata ?? {}) });
  if (cr.type === "movie_listing") return mapMovie({ ...cr, ...(cr.movie_listing_metadata ?? {}) });
  return null;
}

/** CREpisode -> KinoEpisode (absent fields left out, never null). */
export function mapEpisode(cr) {
  const still = pickImage(cr.images?.thumbnail, 480);
  const day = typeof cr.episode_air_date === "string" ? cr.episode_air_date : cr.air_date;
  const runtime = Number(cr.duration_ms) > 0 ? Math.round(cr.duration_ms / 60000) : 0;
  const overview = typeof cr.description === "string" && cr.description.trim() ? cr.description.trim() : undefined;
  return {
    ref: "cr:episode:" + cr.id,
    number: Number.isInteger(cr.episode_number) ? cr.episode_number : Number.isInteger(cr.sequence_number) ? cr.sequence_number : null,
    ...(Number.isInteger(cr.season_number) ? { season: cr.season_number } : {}),
    ...(typeof cr.title === "string" && cr.title ? { title: cr.title } : {}),
    ...(still ? { still } : {}),
    ...(typeof day === "string" && /^\d{4}-\d{2}-\d{2}/.test(day) ? { airDate: day.slice(0, 10) } : {}),
    ...(runtime ? { runtimeMinutes: runtime } : {}),
    ...(overview ? { overview } : {}),
  };
}
