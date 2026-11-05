// The person's settings as the plugin reads them: Kino's kino.config ({ get, all }) or, in tests, a plain { key: value }.

/** One setting's value, or undefined. */
export function setting(config, key) {
  try {
    if (typeof config?.get === "function") return config.get(key);
    return config?.[key];
  } catch {
    return undefined;
  }
}

/** Crunchyroll's content locale: the setting, or Kino's language when it is "auto" (or unset). */
export function contentLocale(config) {
  const l = setting(config, "locale");
  if (l === "es-419" || l === "en-US" || l === "pt-BR") return l;
  let lang = "es";
  try {
    if (typeof kino !== "undefined" && typeof kino?.lang === "string") lang = kino.lang.toLowerCase();
  } catch { /* no kino */ }
  if (lang.startsWith("pt")) return "pt-BR";
  return lang.startsWith("es") ? "es-419" : "en-US";
}

/** "both", "series" or "movie". */
export function kindsOf(config) {
  const k = setting(config, "kinds");
  return k === "series" || k === "movie" ? k : "both";
}

/** Crunchyroll's browse `type` for the "kinds" setting; undefined asks for both. */
export function browseType(config) {
  const k = kindsOf(config);
  return k === "series" ? "series" : k === "movie" ? "movie_listing" : undefined;
}

/** Whether an item's kind passes the "kinds" setting. */
export function kindAllowed(config, kind) {
  const k = kindsOf(config);
  return k === "both" || k === kind;
}

/** Whether the plugin adds its rows to Kino's Home. */
export function homeRowsOn(config) {
  const v = setting(config, "homeRows");
  return v !== false && v !== "false";
}
