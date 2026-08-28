import { asLabRecord, asNonEmptyString, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig, LabFeatureId } from "../domain/lab-types.js";
import { normalizeLaboratoryTransformStages } from "../shared/transform-stress-test-model.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

type AudioForensicsRecord = Record<string, unknown>;

type WorkspaceAudioForensicsInput = {
  editConfig: LabEditConfig | null;
  featureId: LabFeatureId;
  locked: boolean;
};

function getPreviewRecord(editConfig: LabEditConfig | null) {
  return asLabRecord(asLabRecord(editConfig)["preview"]);
}

function getPreviewArtifacts(editConfig: LabEditConfig | null) {
  const artifacts = getPreviewRecord(editConfig)["artifacts"];
  return Array.isArray(artifacts)
    ? artifacts.map((entry) => asLabRecord(entry) as AudioForensicsRecord)
    : [];
}

function getArtifactUrl(artifact: AudioForensicsRecord | null | undefined) {
  if (!artifact) return null;
  return (
    asNonEmptyString(artifact["previewUrl"]) ||
    asNonEmptyString(artifact["fileUrl"]) ||
    asNonEmptyString(artifact["url"]) ||
    asNonEmptyString(artifact["path"])
  );
}

function findArtifact(editConfig: LabEditConfig | null, kind: string) {
  return (
    getPreviewArtifacts(editConfig).find(function (artifact) {
      return asNonEmptyString(artifact["kind"]) === kind;
    }) || null
  );
}

function readAudioStages(editConfig: LabEditConfig | null) {
  const recipe = asLabRecord(asLabRecord(editConfig)["recipe"]);
  const audio = asLabRecord(recipe["audio"]);
  return normalizeLaboratoryTransformStages(audio["transformStages"], "audio");
}

function renderAudioPlayer(label: string, url: string | null) {
  return `
    <article class="labx-card labx-audio-forensics__player">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">${escapeHtml(label)}</p>
        ${
          url === null
            ? `<p class="labx-card__meta">Preview Stack ile güncel artefaktı üretin.</p>`
            : `<audio class="labx-preview-media" controls preload="metadata" src="${escapeHtml(url)}" aria-label="${escapeHtml(label)}"></audio>`
        }
      </div>
    </article>`;
}

function renderAnalysisImage(
  label: string,
  artifact: AudioForensicsRecord | null,
  altSuffix = ""
) {
  const url = getArtifactUrl(artifact);
  if (url === null) return "";
  return `
    <figure class="labx-card labx-audio-forensics__spectrogram">
      <div class="labx-card__body">
        <figcaption class="labx-card__eyebrow">${escapeHtml(label)}</figcaption>
        <img class="labx-preview-media" loading="lazy" src="${escapeHtml(url)}" alt="${escapeHtml(`${label}${altSuffix}`)}" />
      </div>
    </figure>`;
}

function renderSweepVariants(editConfig: LabEditConfig | null, copy: LabI18n) {
  const sourceUrl = getArtifactUrl(findArtifact(editConfig, "transform-source-baseline"));
  const variants = getPreviewArtifacts(editConfig).filter(function (artifact) {
    return asNonEmptyString(artifact["kind"]) === "audio-sweep-variant";
  });
  if (variants.length === 0) {
    return `<p class="labx-card__meta">${escapeHtml(
      copy.locale === "tr"
        ? "Parameter Sweep aşaması eklenirse Preview Stack varyant WAV'larını burada A/B dinlemek için sıralar."
        : "Add a Parameter Sweep stage and Preview Stack will list variant WAV files here for A/B listening."
    )}</p>`;
  }
  const firstMetadata = asLabRecord(variants[0]?.["metadata"]) as AudioForensicsRecord;
  const requested = Number(firstMetadata["requestedVariantCount"] || variants.length);
  const truncated = firstMetadata["truncated"] === true;
  return `
    <details class="labx-card labx-audio-forensics__sweep" open>
      <summary>${escapeHtml(
        copy.locale === "tr"
          ? `Sweep varyantları · ${variants.length}${truncated ? ` / ${requested}` : ""}`
          : `Sweep variants · ${variants.length}${truncated ? ` / ${requested}` : ""}`
      )}</summary>
      <div class="labx-card__body">
        ${
          truncated
            ? `<p class="labx-card__meta">${escapeHtml(
                copy.locale === "tr"
                  ? "Varyant sınırına ulaşıldı. Daha ince tarama için aralığı bölün veya Maximum variants değerini yükseltin."
                  : "Variant limit reached. Split the range or raise Maximum variants for a finer sweep."
              )}</p>`
            : ""
        }
        ${
          sourceUrl === null
            ? ""
            : `<div class="labx-card" data-lab-audio-sweep-ab="true">
                <div class="labx-card__body">
                  <p class="labx-card__eyebrow">A / B</p>
                  <audio controls preload="metadata" src="${escapeHtml(sourceUrl)}" data-lab-audio-sweep-ab-player="true"></audio>
                  <p class="labx-card__meta" data-lab-audio-sweep-ab-status="true">A · Source</p>
                </div>
              </div>`
        }
        <div class="labx-controls-stack">
          ${variants
            .map(function (artifact, index) {
              const metadata = asLabRecord(artifact["metadata"]) as AudioForensicsRecord;
              const label =
                asNonEmptyString(metadata["label"]) ||
                `${copy.locale === "tr" ? "Varyant" : "Variant"} ${index + 1}`;
              const url = getArtifactUrl(artifact);
              return `<article class="labx-card" data-lab-audio-sweep-variant="true">
                <div class="labx-card__body">
                  <p class="labx-card__eyebrow">${escapeHtml(label)}</p>
                  ${
                    url === null
                      ? `<p class="labx-card__meta">Artifact URL unavailable.</p>`
                      : `<audio controls preload="none" src="${escapeHtml(url)}" aria-label="${escapeHtml(label)}"></audio>
                         ${
                           sourceUrl === null
                             ? ""
                             : `<button class="labx-inline-action" type="button"
                                  data-lab-action="workspace-audio-sweep-ab"
                                  data-lab-source-url="${escapeHtml(sourceUrl)}"
                                  data-lab-variant-url="${escapeHtml(url)}"
                                  data-lab-variant-label="${escapeHtml(label)}">A/B</button>`
                         }`
                  }
                </div>
              </article>`;
            })
            .join("")}
        </div>
      </div>
    </details>`;
}

export function renderWorkspaceAudioForensics(
  input: WorkspaceAudioForensicsInput,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const preview = getPreviewRecord(input.editConfig);
  const stages = readAudioStages(input.editConfig);
  const sourceUrl = getArtifactUrl(findArtifact(input.editConfig, "transform-source-baseline"));
  const transformUrl =
    asNonEmptyString(preview["previewUrl"]) ||
    asNonEmptyString(preview["fileUrl"]) ||
    asNonEmptyString(preview["path"]);
  const differenceUrl = getArtifactUrl(findArtifact(input.editConfig, "transform-difference"));
  const sourceWaveform = findArtifact(input.editConfig, "waveform-source");
  const transformWaveform = findArtifact(input.editConfig, "waveform");
  const sourceSpectrogram = findArtifact(input.editConfig, "spectrogram-source");
  const transformSpectrogram = findArtifact(input.editConfig, "spectrogram");
  const recipe = asLabRecord(asLabRecord(input.editConfig)["recipe"]);
  const audioRecipe = asLabRecord(recipe["audio"]);
  const trimStartSeconds =
    audioRecipe["trimEnabled"] === true &&
    typeof audioRecipe["trimStartSeconds"] === "number" &&
    Number.isFinite(audioRecipe["trimStartSeconds"])
      ? Math.max(0, audioRecipe["trimStartSeconds"] as number)
      : 0;
  const selectionHint =
    copy.locale === "tr"
      ? "Timeline'da sessiz bir aralık seçin; düğme seçimin başlangıç/bitişini noise-profile aşamasına yazar."
      : "Select a quiet timeline range; the button writes its start/end into the noise-profile stage.";

  return `
    <section
      class="labx-card labx-audio-forensics"
      data-lab-audio-forensics="true"
      data-lab-audio-forensics-feature-id="${escapeHtml(input.featureId)}"
      data-lab-audio-forensics-locked="${input.locked ? "true" : "false"}"
      data-lab-audio-transform-stages-json="${escapeHtml(JSON.stringify(stages))}"
      data-lab-audio-trim-start-seconds="${String(trimStartSeconds)}"
    >
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">AUDIO FORENSICS / RECONSTRUCTION</p>
        <p class="labx-card__meta">${escapeHtml(
          copy.locale === "tr"
            ? "Timeline waveform görünür kalır; Preview Stack ayrıca 20 Hz–20 kHz zaman/frekans haritasını, Source/Transform/Difference seslerini ve sweep varyantlarını üretir."
            : "The timeline waveform stays visible; Preview Stack also produces a 20 Hz–20 kHz time/frequency map, Source/Transform/Difference audio, and sweep variants."
        )}</p>

        <div class="labx-controls-actions">
          <button
            class="labx-inline-action labx-transform-action"
            type="button"
            data-lab-action="workspace-noise-profile-capture"
            ${input.locked ? "disabled" : ""}
          >${escapeHtml(copy.locale === "tr" ? "Gürültü profilini al" : "Capture noise profile")}</button>
        </div>
        <p class="labx-card__meta" data-lab-noise-profile-status="true">${escapeHtml(selectionHint)}</p>

        <div class="labx-controls-stack" data-lab-audio-comparison="true">
          ${renderAudioPlayer("Source", sourceUrl)}
          ${renderAudioPlayer("Transform", transformUrl)}
          ${renderAudioPlayer("Audio Difference", differenceUrl)}
        </div>

        <section class="labx-card" data-lab-audio-spectrogram-pair="true">
          <div class="labx-card__body">
            <p class="labx-card__eyebrow">Waveform + Spectrogram · 20 Hz–20 kHz</p>
            <p class="labx-card__meta">${escapeHtml(
              copy.locale === "tr"
                ? "Spektrogram log frekans eksenindedir; taşıyıcı, harmonik, bant kesimi, tekrar eden çizgi ve ani frekans kaymalarını waveform ile aynı çalışma bağlamında karşılaştırmak içindir."
                : "The spectrogram uses a logarithmic frequency axis for comparing carriers, harmonics, band cuts, repeated lines, and abrupt shifts in the same workspace as the waveform."
            )}</p>
            ${renderAnalysisImage("Source Waveform", sourceWaveform)}
            ${renderAnalysisImage("Source Spectrogram", sourceSpectrogram, " · 20 Hz–20 kHz")}
            ${renderAnalysisImage("Transform Waveform", transformWaveform)}
            ${renderAnalysisImage("Transform Spectrogram", transformSpectrogram, " · 20 Hz–20 kHz")}
            ${
              sourceSpectrogram === null && transformSpectrogram === null
                ? `<p class="labx-card__meta">${escapeHtml(
                    copy.locale === "tr"
                      ? "Preview Stack ile hizalı waveform + spektrogram çiftini üretin."
                      : "Run Preview Stack to generate the aligned waveform + spectrogram pair."
                  )}</p>`
                : ""
            }
          </div>
        </section>

        <section class="labx-card" data-lab-audio-sweep-results="true">
          <div class="labx-card__body">
            <p class="labx-card__eyebrow">Parameter Sweep / A-B</p>
            ${renderSweepVariants(input.editConfig, copy)}
          </div>
        </section>

        <p class="labx-card__meta">${escapeHtml(
          copy.locale === "tr"
            ? "Formant Preserve ve bağımsız Formant Shift aşamaları FFmpeg'in Rubber Band filtresini gerektirir; diğer pitch/speed yolları built-in filtrelerle çalışır. Mid/Side, L/R, L−R, polarity ve mono-collapse testleri Channel / Mid-Side ile Phase / Polarity aşamalarındadır."
            : "Formant Preserve and independent Formant Shift require FFmpeg's Rubber Band filter; the other pitch/speed paths use built-in filters. Mid/Side, L/R, L−R, polarity and mono-collapse tests live in the Channel / Mid-Side and Phase / Polarity stages."
        )}</p>
      </div>
    </section>`;
}
