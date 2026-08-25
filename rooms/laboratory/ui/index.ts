import { bindLaboratoryTransformStackInteractions } from "../runtime/controller/lab-transform-stack-live-controller.js";
import "./lab-root.js";

bindLaboratoryTransformStackInteractions({
  documentRef: document,
  windowRef: window,
});
