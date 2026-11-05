// The screen app. Kino keeps the state; `screen(ctx)` draws the route and `screenEvent(ev)` answers through a handler map.
// Routes: the tabs (home, following, with search and settings as buttons of the bar) live in `state.route`; the title page
// is a route Kino pushes (`{ push: "title", params: { ref } }`), so Back returns to where the person came from. A card on
// Kino's own Home, or a notice, opens it with `open.screen` / `go.screen` and the same args.
import { tw } from "../i18n.js";
import { parseRef } from "../map.js";
import { acknowledge, follow, unfollow } from "../follows.js";
import { shell } from "./shell.js";
import { ajustesBody } from "./ajustes.js";
import { inicioBody } from "./inicio.js";
import { buscarBody } from "./buscar.js";
import { siguiendoBody } from "./siguiendo.js";
import { fichaBody } from "./ficha.js";

export const TAB_ROUTES = ["home", "search", "following", "settings"];

const plain = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : null);

/** The ref a title route carries in its params or args, when it is one of ours. */
export function titleRefOf(route) {
  const a = plain(route?.params) ?? plain(route?.args);
  return parseRef(a?.ref) ? a.ref : null;
}

/** `{ name, ref? }` to draw from Kino's route and the screen's state. */
export function resolveRoute(ctx = {}) {
  const route = plain(ctx.route) ?? {};
  const state = plain(ctx.state) ?? {};
  if (route.name === "title") return { name: "title", ref: titleRefOf(route) };
  if (TAB_ROUTES.includes(state.route)) return { name: state.route };
  if (TAB_ROUTES.includes(route.name)) return { name: route.name };
  return { name: "home" };
}

const toast = (key, role, ...args) => ({ toast: { ...tw(key, "text", ...args), ...(role ? { role } : {}) } });
const nextRev = (state) => (Number.isInteger(state?.rev) ? state.rev + 1 : 1);
const argOf = (ev) => (typeof ev?.arg === "string" ? ev.arg : typeof ev?.value === "string" ? ev.value : undefined);
const jsonArg = (ev) => {
  try {
    return typeof ev?.arg === "string" ? JSON.parse(ev.arg) : plain(ev?.arg);
  } catch {
    return null;
  }
};

export function makeScreenApp() {
  async function screen(ctx = {}) {
    const state = plain(ctx.state) ?? {};
    const r = resolveRoute(ctx);
    switch (r.name) {
      case "title":
        return shell({ route: "title", body: await fichaBody({ ref: r.ref, state }) });
      case "search":
        return shell({ route: "search", body: await buscarBody({ state }) });
      case "following":
        return shell({ route: "following", body: siguiendoBody() });
      case "settings":
        return shell({ route: "settings", body: ajustesBody() });
      default:
        return shell({ route: "home", body: await inicioBody() });
    }
  }

  const handlers = {
    open({ route, state }) {
      if (plain(route)?.name === "title") return null; // Kino's pushed route holds it
      const name = plain(route)?.name;
      if (TAB_ROUTES.includes(name)) return { state: { route: name } };
      return TAB_ROUTES.includes(state?.route) ? null : { state: { route: "home" } };
    },
    tab(ev) {
      const to = argOf(ev);
      return TAB_ROUTES.includes(to) ? { state: { route: to } } : null;
    },
    back() {
      return { route: { pop: true } };
    },
    openTitle(ev) {
      const ref = argOf(ev);
      return parseRef(ref) ? { route: { push: "title", params: { ref } } } : null;
    },

    // Buscar
    searchSubmit(ev) {
      const raw = typeof ev?.value === "string" ? ev.value : ev?.state?.inputs?.q;
      const q = typeof raw === "string" ? raw.trim().slice(0, 200) : "";
      return { state: { q, genre: null } };
    },
    openGenre(ev) {
      const id = argOf(ev);
      return id ? { state: { route: "search", genre: id.slice(0, 64), q: "" } } : null;
    },
    clearGenre() {
      return { state: { genre: null } };
    },

    // Siguiendo
    followUnfollow(ev) {
      const crId = argOf(ev);
      if (crId) unfollow(crId);
      return { state: { rev: nextRev(ev.state) } };
    },
    followMarkSeen(ev) {
      const crId = argOf(ev);
      if (crId) acknowledge(crId);
      return { state: { rev: nextRev(ev.state) } };
    },
    enableEpisodes(ev) {
      // Kino drops enableJob when the person switched the job off in its Ajustes: the redraw (rev) shows the real state.
      return { enableJob: "episodes", state: { rev: nextRev(ev.state) } };
    },
    followMarkAllSeen(ev) {
      acknowledge();
      return { state: { rev: nextRev(ev.state) } };
    },

    // the title page
    async titleFollow(ev) {
      const a = jsonArg(ev);
      if (!a?.crId) return null;
      const r = await follow({ crId: a.crId, name: a.name, poster: a.poster ?? undefined });
      if (!r.ok) return { toast: { text: r.messageEs, textEn: r.messageEn, role: "error" }, state: { rev: nextRev(ev.state) } };
      // Kino drops enableJob when the person switched the job off in its Ajustes: the redraw (rev) shows the real state.
      return { enableJob: "episodes", ...toast("followed", null, String(a.name ?? "")), state: { rev: nextRev(ev.state) } };
    },
    titleUnfollow(ev) {
      const a = jsonArg(ev);
      if (!a?.crId) return null;
      unfollow(a.crId);
      return { ...toast("unfollowed", null, String(a.name ?? "")), state: { rev: nextRev(ev.state) } };
    },
    titleSeason(ev) {
      const id = argOf(ev);
      return id ? { state: { season: id.slice(0, 64), all: false } } : null;
    },
    titleEpisodesAll() {
      return { state: { all: true } };
    },
  };

  async function screenEvent(ev = {}) {
    const h = Object.prototype.hasOwnProperty.call(handlers, ev?.name) ? handlers[ev.name] : null;
    return h ? h(ev) : null;
  }

  return { screen, screenEvent };
}
