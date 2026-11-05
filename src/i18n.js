// Language helpers. Every string the person reads exists in Spanish and English as an [ES, EN] pair. The pick follows
// `kino.lang` (Kino's own language), read at call time because Kino restarts the runtime when the person changes it.

const kinoLang = () => (typeof kino !== "undefined" && kino && typeof kino.lang === "string" ? kino.lang : "es");

/** The bare language code of the person's Kino: "es" for any Spanish tag ("es-CO", "es-MX"), else "en". */
export function langOf() {
  try {
    return kinoLang().toLowerCase().startsWith("es") ? "es" : "en";
  } catch {
    return "es";
  }
}

/** The Spanish or the English text, by the person's language. */
export function t(es, en) {
  return langOf() === "es" ? es : en;
}

/**
 * The pair of properties of a screen text: `tw("follow", "labelText")` -> `{ labelText: "Seguir", labelTextEn: "Follow" }`.
 * Extra arguments go to a text that is a function.
 */
export function tw(key, prop = "text", ...args) {
  const entry = SCREEN_TEXT[key];
  const [es, en] = typeof entry === "function" ? entry(...args) : entry;
  return { [prop]: es, [prop + "En"]: en };
}

/** A screen text in the person's language, by kino.lang (a row's title, which Kino shows as it is). */
export function tl(key, ...args) {
  const pair = tw(key, "text", ...args);
  return t(pair.text, pair.textEn);
}

/** The same text in both languages (a title's own name, a synopsis): `same("Bleach", "title")`. */
export function same(value, prop = "text") {
  const v = String(value ?? "");
  return { [prop]: v, [prop + "En"]: v };
}

/** Every screen text of the plugin: key -> [ES, EN]. */
export const SCREEN_TEXT = {
  tabHome: ["Inicio", "Home"],
  tabSearch: ["Buscar", "Search"],
  tabFollowing: ["Siguiendo", "Following"],
  tabSettings: ["Ajustes", "Settings"],
  noResults: ["Sin resultados", "No results"],
  findWhere: ["Buscar dónde verlo", "Find where to watch"],
  episodes: ["Episodios", "Episodes"],
  seasons: ["Temporadas", "Seasons"],
  similarTitles: ["Títulos similares", "Similar titles"],
  retry: ["Reintentar", "Retry"],
  back: ["Atrás", "Back"],
  close: ["Cerrar", "Close"],
  overview: ["Sinopsis", "Synopsis"],
  season: (n) => [`Temporada ${n}`, `Season ${n}`],
  episode: (n) => [`Capítulo ${n}`, `Episode ${n}`],
  episodeRuntime: (m) => [`${m} min`, `${m} min`],
  seasonsCount: (n) => [n === 1 ? "1 temporada" : `${n} temporadas`, n === 1 ? "1 season" : `${n} seasons`],
  noEpisodes: ["Esta temporada aún no tiene capítulos", "This season has no episodes yet"],
  episodesFailed: ["No se pudieron cargar los capítulos", "The episodes could not be loaded"],
  showAll: (n) => [`Ver los ${n} restantes`, `Show the other ${n}`],
  failedTitle: ["No se pudo cargar este título", "This title could not be loaded"],
  failedText: ["Revisa tu conexión e inténtalo de nuevo.", "Check your connection and try again."],
  nothingTitle: ["Sin contenido disponible", "No content available"],
  followed: (name) => [`Ahora sigues ${name}`, `You now follow ${name}`],
  unfollowed: (name) => [`Dejaste de seguir ${name}`, `You no longer follow ${name}`],
  markAllSeen: ["Marcar todo como visto", "Mark all as seen"],
  newMark: ["Nuevo", "New"],
  lastEpisode: (code, title) => [title ? `Último: ${code} · ${title}` : `Último: ${code}`, title ? `Latest: ${code} · ${title}` : `Latest: ${code}`],
  noEpisodeYet: ["Sin capítulos nuevos todavía", "No new episodes yet"],
  unfollowAsk: (name) => [`¿Dejar de seguir «${name}»?`, `Unfollow “${name}”?`],
  openTitle: ["Ver ficha", "Open page"],
  followingTitle: ["Series que sigues", "Series you follow"],
  followingCount: (n, max) => [`Sigues ${n} de ${max} series`, `You follow ${n} of ${max} series`],
  noticesText: [
    "Los avisos tienen su propio interruptor en Ajustes de Kino ▸ Crunchyroll Catálogo (Avisar de capítulos nuevos).",
    "The notices have their own switch in Kino's Settings ▸ Crunchyroll Catalog (Tell me about new episodes).",
  ],
  noticesOn: ["Están activados.", "They are on."],
  noticesEnable: ["Activar los avisos", "Turn the notices on"],
  noFollowsText: ["Abre una serie y toca Seguir para saber cuándo sale un capítulo nuevo.", "Open a series and tap Follow to know when a new episode is out."],
  searchHint: ["Nombre de una serie o película", "Name of a series or a movie"],
  newOnCR: ["Nuevo en Crunchyroll", "New on Crunchyroll"],
  popularOnCR: ["Lo más popular", "Most popular"],
  premiumBadge: ["Premium", "Premium"],
  browseByGenre: ["Explorar por género", "Browse by genre"],
  follow: ["Seguir", "Follow"],
  unfollow: ["Dejar de seguir", "Unfollow"],
  markSeen: ["Marcar como visto", "Mark as seen"],
  noFollows: ["No sigues ninguna serie todavía", "You're not following any series yet"],
  newEpisodesRow: ["Capítulos nuevos de tus series", "New episodes of your series"],
  newEpisodeOf: ["Nuevo episodio de", "New episode of"],
  isOut: ["ya salió", "is out"],
  seasonShort: ["T", "S"],
};
