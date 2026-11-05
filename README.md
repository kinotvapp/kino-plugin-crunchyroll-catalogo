# Crunchyroll Catálogo (Crunchyroll Catalog)

Crunchyroll's catalog inside Kino: what is new, what is popular, this season's anime, genres, search, each title's seasons and
episodes, and a notice when a series you follow gets a new episode.

## What it is and is not

- It is a catalog. `catalogOnly: true`: it never plays anything and never calls Crunchyroll's `/playback/` or `/drm/`.
- No account and no login: it uses Crunchyroll's anonymous token (`grant_type=client_id`). The app's client id and secret are
  sealed in the manifest (`kino-sealed:v1:`) for `kinotvapp/kino-plugin-crunchyroll-catalogo`; they only open when the plugin is
  installed from that repository's default branch.
- "Buscar dónde verlo" hands the title to Kino: to Kino's title page when TMDB knows it (`go.titleByIds`), else to Kino's own
  search on every source the person has (`go.search`, scope `all`). The plugin never learns what was found.
- Adult titles (`is_mature`) carry `adult: true`, so Kino's 18+ gate applies.

## Requirements

Kino 0.9.83 or later (`apiVersion` 23). Hosts: `www.crunchyroll.com` (the API) and `imgsrv.crunchyroll.com` (images).

## Where the data comes from

Everything is Crunchyroll's API. TMDB (Kino's built-in `kino.tmdb`) is used for one thing only: the TMDB id of a title, so
"Buscar dónde verlo" can open Kino's title page. If TMDB has nothing, the button falls back to Kino's search.

## The flow

- **Inicio.** "Capítulos nuevos de tus series" first (from the follows, no request), then Crunchyroll's home feed panels. When the
  feed fails or is empty: Nuevo en Crunchyroll, Lo más popular, this season and three genres, each with "Ver más" (`browse`).
- **Buscar** (a button of the bar). A search box (submit), and the genre list; a genre shows its titles.
- **Siguiendo.** "Sigues N de 10 series", one card per series (poster, name, latest episode, "Nuevo", Marcar como visto,
  Ver ficha, Dejar de seguir with a confirmation), Marcar todo como visto, and the button that turns the notices on.
- **Title page** (a pushed route, so Back returns). Backdrop, name, year and seasons, Buscar dónde verlo, Seguir (series), genres,
  synopsis, season chips (one per season number: a dub is not a season of its own; season 0 is "Especiales", left out of
  Kino's own episode list, which reads seasons 1..999), the first 30 episodes with "Ver los
  restantes" (up to 80), and similar titles. The chosen season is kept per title. Opened from outside the screen, Back goes to
  Inicio. Every card in the screen, a card on Kino's own Home (`open.screen`) and a notice
  (`go.screen`) open it.
- **Ajustes** (a button of the bar). Kino's settings form: catalog language, what to show, rows on Kino's Home.

## Settings

| Key | Default | What it does |
|---|---|---|
| `locale` | `auto` | Catalog language: automatic (Kino's language), Spanish (`es-419`), English (`en-US`), Portuguese (`pt-BR`) |
| `kinds` | `both` | Series and movies, series only, or movies only |
| `homeRows` | `true` | The plugin's rows on Kino's Home |

## Jobs

**`episodes`** ("Avisar de capítulos nuevos", every 360 min, options 60 / 180 / 360 / 720 / 1440, `runOn: "preferPhone"`). Off
until the person turns it on (Seguir and "Activar los avisos" ask Kino with `enableJob`). Each run checks 4 followed series
(Kino allows a job 10 requests: the token and 2 per series), rotating through all of them, on each series' newest season in its original audio; the first check of a series only takes
its baseline. A newer aired episode posts one notice in Kino's bell and shows the series in "Capítulos nuevos de tus series".

## Budgets and storage

- **Requests:** the token is asked once per runtime and shared by calls made at the same time; a refused token makes every call
  fail at once for a minute instead of asking again. `episodes()` reads at most 40 seasons.
- **kino.shared:** 1 of the 4 keys: `crFollows` (at most 10 series).
- **kino.storage:** `crEpCursor`, the job's rotation.

## Commands

Run from `plugins/crunchyroll-catalogo`:

```
npm install            # esbuild, once
npm run build          # bundles src/ into plugin.js
npm run check:built    # fails if plugin.js is not exactly what src/ builds to
npm test               # node --test test/*.test.mjs
node ../sdk/validate.mjs .
node ../sdk/run.mjs --state '{"route":"following"}' . screen
node ../sdk/run.mjs . job episodes
```

Kino installs one file: edit `src/`, then `npm run build`, and commit both.

## Not verified yet

- On a real device: Crunchyroll answers a plain Node client's token request with Cloudflare's "Just a moment…" page (HTTP 403).
  Whether Kino's own HTTP client gets through is only known on a phone. When it does not, every tab shows its error state.
- The shape of `similar_to` for the anonymous account id, and of the home feed's panels, comes from the API inventory, not from a
  live answer.
