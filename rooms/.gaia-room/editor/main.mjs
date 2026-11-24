import { mount } from "svelte";
import Workshop from "./Workshop.svelte";
import "./workshop.css";

mount(Workshop, { target: globalThis.document.getElementById("app") });
