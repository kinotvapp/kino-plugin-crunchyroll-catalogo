// A series' seasons as Kino shows them: one per season number. Crunchyroll lists each dub as a season of its own
// (same number, another audio_locale); the original audio, or the subtitled version, stands for the number.
import { api } from "./api.js";

/** Requests for one episodes() call stay well inside Kino's 60: the token, the seasons and at most this many seasons. */
export const MAX_SEASONS = 40;

const numberOf = (s, i) => (Number.isInteger(s?.season_number) && s.season_number >= 0 ? s.season_number : Number.isInteger(s?.season_sequence_number) ? s.season_sequence_number : i + 1);

const rank = (s, original) => (s?.audio_locale && s.audio_locale === original ? 0 : s?.is_subbed ? 1 : 2);

/** [raw] seasons -> one per number, ascending: `{ id, number, title }`. */
export function pickSeasons(raw, originalAudio = "ja-JP") {
  const byNumber = new Map();
  (Array.isArray(raw) ? raw : []).forEach((s, i) => {
    if (!s || typeof s.id !== "string" || !s.id) return;
    const n = numberOf(s, i);
    const prev = byNumber.get(n);
    if (!prev || rank(s, originalAudio) < rank(prev.raw, originalAudio)) byNumber.set(n, { raw: s, n });
  });
  return [...byNumber.values()]
    .sort((a, b) => a.n - b.n)
    .slice(0, MAX_SEASONS)
    .map(({ raw: s, n }) => ({ id: s.id, number: n, title: typeof s.title === "string" ? s.title : "" }));
}

/** The seasons of [seriesId] (see pickSeasons). */
export async function seasonsOf(seriesId, locale, originalAudio) {
  return pickSeasons(await api.seasons(seriesId, locale), originalAudio);
}
