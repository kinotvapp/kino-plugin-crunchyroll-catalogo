// src/api.js — anonymous token manager + all Crunchyroll catalogue endpoints
// catalogOnly: true — never calls /playback/, /drm/ or any streaming endpoint
// Hosts: www.crunchyroll.com only (images served from imgsrv.crunchyroll.com by the browser)

const BASE = "https://www.crunchyroll.com";
const UA = "Crunchyroll/3.113.2 Android/13 okhttp/5.3.2";

// Module-level token cache (shared for all calls within one runtime lifetime)
let _token = null;
let _tokenExp = 0;
let _accountId = "anonymous";
// After a refused token, every call fails at once for a minute instead of asking again (Kino counts each request).
let _tokenFailedUntil = 0;
const TOKEN_RETRY_MS = 60_000;

const unavailable = (msg) => kino.error("unavailable", msg);

let _tokenPending = null;

/** The anonymous token; calls made at the same time share one request. */
function getToken() {
  if (_token !== null && Date.now() < _tokenExp - 30_000) return Promise.resolve(_token);
  if (!_tokenPending) _tokenPending = fetchToken().finally(() => { _tokenPending = null; });
  return _tokenPending;
}

async function fetchToken() {
  if (Date.now() < _tokenFailedUntil) throw unavailable("Crunchyroll refused the anonymous token a moment ago");
  const id = kino.secret("CRUNCHYROLL_CLIENT_ID");
  const secret = kino.secret("CRUNCHYROLL_CLIENT_SECRET");
  const resp = await kino.fetch(`${BASE}/auth/v1/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: "grant_type=client_id&scope=offline_access",
  });
  let data = null;
  if (resp.ok) {
    try { data = await resp.json(); } catch { data = null; }
  }
  if (!data || typeof data.access_token !== "string" || !data.access_token) {
    _token = null;
    _tokenFailedUntil = Date.now() + TOKEN_RETRY_MS;
    throw unavailable(`Crunchyroll token: HTTP ${resp.status}`);
  }
  _token = data.access_token;
  _tokenExp = Date.now() + (Number(data.expires_in) > 0 ? Number(data.expires_in) : 300) * 1000;
  _accountId = typeof data.account_id === "string" && data.account_id ? data.account_id : "anonymous";
  return _token;
}

function authHeaders() {
  return {
    "Authorization": `Bearer ${_token}`,
    "User-Agent": UA,
    "Accept": "application/json",
  };
}

async function _get(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  await getToken();
  let resp = await kino.fetch(url.toString(), { headers: authHeaders() });
  if (resp.status === 401) {
    _token = null;
    await getToken();
    resp = await kino.fetch(url.toString(), { headers: authHeaders() });
  }
  if (resp.status === 429 || resp.status === 420) {
    await kino.sleep(2000);
    resp = await kino.fetch(url.toString(), { headers: authHeaders() });
  }
  if (resp.status === 404) throw kino.error("not_found", `Crunchyroll: ${path} not found`);
  if (!resp.ok) throw unavailable(`Crunchyroll: HTTP ${resp.status} for ${path}`);
  try {
    return await resp.json();
  } catch {
    throw unavailable(`Crunchyroll: ${path} did not answer JSON`);
  }
}

export const api = {
  /** Rows of the Crunchyroll home feed. Returns the data array of panels. */
  async homeFeed(locale) {
    const r = await _get("/content/v2/discover/home_feed", { locale });
    return Array.isArray(r?.data) ? r.data : [];
  },

  /** Flat catalogue, ordered and filtered. Returns the full response { data, total }. */
  async browse(params) {
    return _get("/content/v2/discover/browse", params);
  },

  /** Top-level genre categories. Returns the data array. */
  async categories(locale) {
    const r = await _get("/content/v2/discover/categories", { locale });
    return Array.isArray(r?.data) ? r.data : [];
  },

  /** Seasonal anime tags (winter-2026 etc.). Returns the data array. */
  async seasonalTags(locale) {
    const r = await _get("/content/v2/discover/seasonal_tags", { locale });
    return Array.isArray(r?.data) ? r.data : [];
  },

  /** Full-text search. Returns the data array of result groups. */
  async search(q, n, locale) {
    const r = await _get("/content/v2/discover/search", { q, n, locale, type: "top_results" });
    return Array.isArray(r?.data) ? r.data : [];
  },

  /** Series detail. Returns the series object (data[0] or the response itself for fixtures). */
  async series(id, locale) {
    const r = await _get(`/content/v2/cms/series/${id}`, { locale });
    return r.data?.[0] ?? r;
  },

  /** Seasons of a series. Returns the data array. */
  async seasons(seriesId, locale) {
    const r = await _get(`/content/v2/cms/series/${seriesId}/seasons`, { locale });
    return Array.isArray(r?.data) ? r.data : [];
  },

  /** Episodes of a season. Returns the data array. */
  async episodes(seasonId, locale) {
    const r = await _get(`/content/v2/cms/seasons/${seasonId}/episodes`, { locale });
    return Array.isArray(r?.data) ? r.data : [];
  },

  /** Movie listing detail. Returns the movie-listing object (data[0] or the response itself). */
  async movieListing(id, locale) {
    const r = await _get(`/content/v2/cms/movie_listings/${id}`, { locale });
    return r.data?.[0] ?? r;
  },

  /** Titles similar to objectId. Uses _accountId from the last token fetch (or "anonymous"). */
  async similarTo(objectId, locale) {
    await getToken(); // the path carries the account id the token answers with
    const r = await _get(`/content/v2/discover/${_accountId}/similar_to/${objectId}`, { n: 20, locale });
    return Array.isArray(r?.data) ? r.data : [];
  },
};
