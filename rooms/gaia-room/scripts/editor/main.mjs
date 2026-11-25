import { mount } from "svelte";
import Room from "./Room.svelte";
import "./workshop.css";

const target = globalThis.document.getElementById("app");
if (
  (import.meta.env.DEV || import.meta.env.MODE === "acceptance") &&
  new globalThis.URLSearchParams(globalThis.location.search).has("fixture")
) {
  const { mountExperiment } = await import("./experiment.mjs");
  mountExperiment(target);
} else if (import.meta.env.DEV && !globalThis.roomAPI) {
  const link = globalThis.document.createElement("a");
  link.href = "?fixture=demo";
  link.textContent = "Open temporary example workshop";
  target.append(link);
} else mount(Room, { target });
