// The Siguiendo tab: how many series of the 10, one card per series (poster, name, its latest episode, Marcar como visto,
// Ver ficha, Dejar de seguir with a confirmation) and the notices block that turns the new-episode job on.
import { list, MAX_FOLLOWS } from "../follows.js";
import { refOf } from "../map.js";
import { tw } from "../i18n.js";

const ROW_SPAN = { compact: 12, expanded: 6 };

/** Whether the person has the new-episode job on: true, false, or null when this Kino cannot say. */
function jobOn() {
  try {
    return typeof kino.jobOn === "function" ? kino.jobOn("episodes") === true : null;
  } catch {
    return null;
  }
}

function posterNode(url) {
  return {
    type: "Image", width: 64, aspect: "2:3", alt: "", altEn: "", ...(url ? { url } : {}),
    fallback: { type: "Stack", color: "surface", children: [{ type: "Icon", name: "tv" }] },
  };
}

function episodeLine(f) {
  if (!f.latest) return tw("noEpisodeYet");
  const es = `T${f.latest.season}·E${f.latest.number}`;
  const en = `S${f.latest.season}·E${f.latest.number}`;
  const a = tw("lastEpisode", "text", es, f.latest.title || "");
  const b = tw("lastEpisode", "text", en, f.latest.title || "");
  return { text: a.text, textEn: b.textEn };
}

function followCard(f) {
  const id = f.crId;
  const isNew = !!(f.latest && !f.ackedAt);
  const actions = [];
  if (isNew) actions.push({ type: "Button", variant: "secondary", key: `seen-${id}`, icon: "check", ...tw("markSeen", "labelText"), onPressed: { event: "followMarkSeen", arg: id } });
  actions.push({ type: "TextButton", key: `open-${id}`, icon: "info", ...tw("openTitle", "labelText"), onPressed: { event: "openTitle", arg: refOf("series", id) } });
  actions.push({
    type: "TextButton", key: `unfollow-${id}`, icon: "close", ...tw("unfollow", "labelText"),
    ...tw("unfollowAsk", "confirm", f.name), onPressed: { event: "followUnfollow", arg: id },
  });
  return {
    type: "Row", key: `fcard-${id}`, span: ROW_SPAN, gap: 12, padding: 12, background: "surfaceVariant", borderRadius: "medium", crossAxisAlignment: "start", children: [
      posterNode(f.poster),
      { type: "Column", key: `followInfo-${id}`, flex: 1, gap: 8, children: [
        { type: "Row", key: `followHead-${id}`, gap: 8, children: [
          { type: "Text", style: "h4", flex: 1, maxLines: 2, text: f.name, textEn: f.name },
          ...(isNew ? [{ type: "Badge", key: `new-${id}`, ...tw("newMark") }] : []),
        ] },
        { type: "Text", style: "caption", color: "muted", ...episodeLine(f) },
        { type: "Row", key: `followActions-${id}`, wrap: true, gap: 8, children: actions },
      ] },
    ],
  };
}

function noticesBlock() {
  const parts = [{ type: "Text", style: "caption", color: "muted", ...tw("noticesText") }];
  if (jobOn() === true) parts.push({ type: "Text", style: "caption", color: "primary", ...tw("noticesOn") });
  else parts.push({ type: "Button", variant: "secondary", key: "enableEpisodes", icon: "notifications", ...tw("noticesEnable", "labelText"), onPressed: "enableEpisodes" });
  return { type: "Column", key: "followingNotices", gap: 8, crossAxisAlignment: "center", children: parts };
}

export function siguiendoBody() {
  const follows = list();
  if (!follows.length) {
    return { type: "Column", key: "siguiendo", gap: 16, children: [
      { type: "emptyState", key: "noFollows", icon: "add", ...tw("noFollows", "title"), ...tw("noFollowsText") },
      noticesBlock(),
    ] };
  }
  const anyNew = follows.some((f) => f.latest && !f.ackedAt);
  return {
    type: "Column", key: "siguiendo", gap: 16, children: [
      { type: "Row", key: "followingHeader", gap: 12, wrap: true, children: [
        { type: "Column", key: "followingHeadText", gap: 4, span: { compact: 12, expanded: 8 }, children: [
          { type: "Text", style: "h3", ...tw("followingTitle") },
          { type: "Text", key: "followingCount", color: "muted", ...tw("followingCount", "text", follows.length, MAX_FOLLOWS) },
        ] },
        ...(anyNew ? [{ type: "Button", variant: "secondary", key: "markAllSeen", icon: "check", span: "auto", ...tw("markAllSeen", "labelText"), onPressed: "followMarkAllSeen" }] : []),
      ] },
      { type: "Row", key: "followList", wrap: true, gap: 12, children: follows.map(followCard) },
      noticesBlock(),
    ],
  };
}
