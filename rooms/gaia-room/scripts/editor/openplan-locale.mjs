import { derived, writable } from "svelte/store";
import { en } from "$lib/i18n/locales/en";

/** @typedef {"en" | "tr"} Locale */
/** @typedef {keyof typeof en} Key */
/** @typedef {Record<string, string | number>} Variables */

/** @type {Partial<Record<Key, string>>} */
const tr = {
  "canvas.editorLabel": "İç plan düzenleme tuvali",
  "canvasHints.start": "Çizime başla",
  "canvasHints.draw": "Duvar çizmek için",
  "canvasHints.drag": "tuşuna bas veya sürükle",
  "canvasHints.minimap": "Küçük harita",
  "canvasHints.snapWall": "Duvar uzantısına hizala",
  "canvasHints.wall": "Duvarın başlangıcını ve bitişini seç",
  "canvasHints.furniture": "Masayı yerleştir · Dönüş {angle}°",
  "canvasStatus.roomsOne": "{count} oda",
  "canvasStatus.roomsMany": "{count} oda",
  "canvasStatus.wallsOne": "{count} duvar",
  "canvasStatus.wallsMany": "{count} duvar",
  "canvasStatus.objectsOne": "{count} nesne",
  "canvasStatus.objectsMany": "{count} nesne",
  "canvasStatus.selected": "{count} seçili",
  "canvasStatus.zoom": "Yakınlaştırma % {value}",
  "canvasZoom.out": "Uzaklaştır",
  "canvasZoom.outHint": "Uzaklaştır (−)",
  "canvasZoom.in": "Yakınlaştır",
  "canvasZoom.inHint": "Yakınlaştır (+)",
  "canvasZoom.reset": "%100 yakınlaştır",
  "canvasZoom.resetHint": "%100’e dön",
  "canvasZoom.fit": "Plana sığdır",
  "canvasZoom.fitHint": "Plana sığdır (F)",
  "canvasZoom.selection": "Seçime sığdır",
  "canvasZoom.selectionHint": "Seçime sığdır (Shift+F)",
  "canvasDisplay.fit": "Sığdır",
  "canvasDisplay.grid": "Izgara",
  "canvasDisplay.gridHint": "Izgarayı aç veya kapat (G)",
  "canvasDisplay.snap": "Hizalama {step}",
  "canvasDisplay.snapOff": "Hizalama kapalı",
  "canvasDisplay.snapHint": "Hizalama adımını değiştir (S) · Izgara {grid}, ince {fine}",
  "canvasDisplay.snapOffHint":
    "Izgaraya hizalama kapalı. S ile adımı seç · Izgara {grid}, ince {fine}, geçerli {step}",
  "canvasDisplay.furniture": "Mobilya",
  "canvasDisplay.furnitureHint": "Mobilyayı göster veya gizle",
  "canvasDisplay.rulers": "Cetveller",
  "canvasDisplay.rulersHint": "Cetvelleri göster veya gizle",
  "canvasDisplay.map": "Harita",
  "canvasDisplay.mapHint": "Küçük haritayı aç veya kapat",
  "contextMenu.duplicate": "Çoğalt",
  "contextMenu.rotate90": "90° döndür",
  "contextMenu.delete": "Sil",
  "contextMenu.deleteWall": "Duvarı sil",
  "contextMenu.paste": "Yapıştır",
  "contextMenu.selectAll": "Tümünü seç",
  "contextMenu.addWall": "Duvar ekle",
  "contextMenu.zoomToFit": "Plana sığdır",
  "layers.title": "Katmanlar",
  "layers.walls": "Duvarlar",
  "layers.doors": "Kapılar",
  "layers.windows": "Pencereler",
  "layers.furniture": "Mobilya",
  "layers.stairs": "Merdivenler",
  "layers.columns": "Sütunlar",
  "layers.guides": "Kılavuzlar",
  "layers.measurements": "Ölçüler",
  "layers.textAnnotations": "Notlar",
  "layerVisibility.title": "Katman görünürlüğü",
  "layerVisibility.dimensions": "Boyutlar",
  "layerVisibility.automaticDimensions": "Otomatik ölçüler",
  "layerVisibility.below": "Alt kat",
  "layerVisibility.belowNamed": "Alt kat ({name})",
  "layerVisibility.roomLabels": "Oda etiketleri",
};

/** @type {import("svelte/store").Writable<Locale>} */
const preference = writable("en");
export const locale = { subscribe: preference.subscribe };
export const setEditorLocale = preference.set;

/** @param {Locale} language @param {Key} key @param {Variables} variables */
export function translate(language, key, variables = {}) {
  const message = (language === "tr" ? tr[key] : undefined) ?? en[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (token, name) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : token
  );
}

export const t = derived(
  locale,
  (language) => (/** @type {Key} */ key, /** @type {Variables} */ variables) =>
    translate(language, key, variables)
);
