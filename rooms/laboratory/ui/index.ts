import { bindLaboratoryAudioForensicsInteractions } from "../runtime/controller/lab-audio-forensics-controller.js";
import { bindLaboratoryTransformStackInteractions } from "../runtime/controller/lab-transform-stack-live-controller.js";
import { bindLaboratoryRoiMediaGeometry } from "./lab-roi-media-geometry-binder.js";
import { bindLaboratoryTrackingPreview } from "./lab-tracking-preview-binder.js";
import { bindLaboratoryVisualReportActions } from "./lab-visual-report-actions-binder.js";
import "./lab-root.js";

bindLaboratoryAudioForensicsInteractions({
  documentRef: document,
  windowRef: window,
});

bindLaboratoryTransformStackInteractions({
  documentRef: document,
  windowRef: window,
});

bindLaboratoryRoiMediaGeometry({
  documentRef: document,
  windowRef: window,
});

bindLaboratoryTrackingPreview({
  documentRef: document,
  windowRef: window,
});

bindLaboratoryVisualReportActions({
  documentRef: document,
  windowRef: window,
});
