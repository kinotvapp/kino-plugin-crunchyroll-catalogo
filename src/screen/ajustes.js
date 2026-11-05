export function ajustesBody() {
  return {
    type: "settings",
    key: "crSettings",
    autoSave: true,
    keys: ["locale", "kinds", "homeRows"],
  };
}
