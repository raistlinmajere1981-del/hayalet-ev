# Laboratory Analiz Yetenekleri Geliştirme Planı

Laboratory sayfasının mevcut analiz yeteneklerini genişletmek ve yeni medya işleme/export kabiliyetleri eklemek için kapsamlı bir geliştirme planı.

---

## Mevcut Durum Analizi

### Mimari Özet
Laboratory, `rooms/laboratory/` altında 3 ana feature'dan oluşur: **media-analysis**, **audio-analysis**, **subtitle-analysis**. V2.3 workspace modelinde tek bir yüzeyde (workspace-surface) birleştirilmiştir.

### Mevcut Yetenekler
| Alan | Mevcut | Sınırlar |
|------|--------|----------|
| **Visual Controls** | Brightness, Contrast, Gamma, RGB channel isolate, Edge highlight | CSS filter tabanlı, sadece preview'a uygulanır; ffmpeg ile export yok |
| **Audio Focus** | Gain (0–3x), Filter (none/lowpass/highpass/bandpass) | 4 temel filtre; cutoff frekans kontrolü yok |
| **ROI** | Dikdörtgen çizim, aktif/pasif toggle | Sadece analiz referansı; ROI'den export yok |
| **Timeline** | Start/End seçimi, bookmark, fine-tune (±10ms/100ms/1s) | Zaman aralığı seçimi var ama export yok |
| **YouTube** | yt-dlp ile indirme; format, kalite, altyazı seçimi | Sadece video+audio birlikte; audio-only mod yok |
| **Audio Analysis** | Spectrogram, waveform, spectral descriptors, transcription, prosody, source separation, music analysis | Analiz çıktıları var ama interaktif görselleştirme yok |
| **Edit Pipeline** | ffmpeg ile preview/apply; crop, resize, trim, blur, sharpen, normalize | Temel düzey; renk/ton gelişmiş ayarları yok |

### Mevcut Tool Zinciri
`ffmpeg`, `yt-dlp`, `whisper.cpp`, `pyaudioanalysis`, `opensmile`, `yamnet`, `demucs`, `librosa`

---

## Önerilen Geliştirmeler

### 1. 🎬 Video/Resim Export — Bölgesel ve Zamansal

**Hedef:** Seçili ROI bölgesinden veya timeline aralığından görüntü/ses/resim export edebilmek.

**Kapsam:**
- ROI → resim olarak export (PNG/JPEG)
- Timeline aralığı → video clip export (MP4)
- Timeline aralığı + ROI → kırpılmış video clip export
- Video → tek frame export (bookmark noktasından veya manuel)

**Teknik Yaklaşım:**
- `edit-pipeline.ts` ve `edit-artifacts.ts` mekanizmasını genişlet
- Yeni `data-lab-action` değerleri: `export-roi-image`, `export-timeline-clip`, `export-frame`
- Host tarafında yeni action handler'lar: ffmpeg `-ss`, `-t`, `-filter:v crop` kompozisyonu
- Export sonrası artifact olarak kaydet + indirme linki

**Etkilenen Dosyalar:**
- `workspace-surface.ts` — export butonları UI
- `workspace-roi-overlay.ts` — ROI export action
- `workspace-timeline.ts` — timeline export action
- `main-functions/media-analysis/host/action-handlers.ts` — yeni action routing
- `main-functions/media-analysis/host/edit-support.ts` — export recipe oluşturma
- `models/lab-types.ts` — yeni event tipleri

---

### 2. 🎵 yt-dlp Audio-Only ve Video-Only İndirme Modları

**Hedef:** YouTube kaynağından sadece ses veya sadece video indirebilme.

**Kapsam:**
- YouTube source intake'a yeni "Capture Mode" seçimi: `video+audio` | `audio-only` | `video-only`
- Audio-only: yt-dlp `-x --audio-format` ile doğrudan ses indirme
- Video-only: yt-dlp `-f bestvideo` ile video stream indirme (audio track olmadan)
- Mevcut `audioFormat` alanı zaten `-x` flag'ini destekliyor ama sadece "custom" preset altında ve UI'da gizli

**Teknik Yaklaşım:**
- `source-intake-youtube.ts` → `buildYtDlpArgs` fonksiyonuna capture mode parametresi ekle
- `workspace-surface.ts` YouTube formuna yeni "Capture Mode" toggle/select ekle
- `LabSourceDrafts` → yeni `youtubeCaptureMode` alanı
- `youtubeCustom` form şemasına capture mode field'ı ekle
- Audio-only modda `sourceKind` otomatik "audio" olarak set edilmeli

**Etkilenen Dosyalar:**
- `main-functions/media-analysis/host/source-intake-youtube.ts`
- `workspace-surface.ts` — YouTube form bölümü
- `models/lab-types.ts` — `LabSourceDrafts` genişletme
- `shared/data/` — yt-dlp form şeması güncellemesi

---

### 3. 🎨 Gelişmiş Renk/Ton Ayarları

**Hedef:** Video ve resimlerde profesyonel düzeyde renk ve ton kontrolü.

**Kapsam:**
- **Saturation** (doygunluk) slider: 0–200%
- **Hue Rotation** (renk döndürme): 0–360°
- **Temperature** (renk sıcaklığı): soğuk ↔ sıcak shift
- **Shadows / Highlights** ayrı kontrol
- **Curves** — basit 3-point (shadows, midtones, highlights)
- **Color Grading Presets** — önceden tanımlı stil (cinematic, vintage, noir, vb.)
- Mevcut preview CSS filter → ffmpeg `eq`, `colorbalance`, `curves` filter'larına export

**Teknik Yaklaşım:**
- `LabInteractiveSettings` genişlet: `saturation`, `hueRotation`, `temperature`, `shadows`, `highlights`
- `workspace-interactive-controls.ts` — yeni slider'lar ve preset butonları
- Preview: CSS `filter: saturate() hue-rotate()` ile anlık gösterim
- Export: ffmpeg `eq=brightness=:contrast=:saturation=`, `colorbalance`, `curves` filtre zinciri
- `edit-support.ts` → recipe oluşturma güncellemesi

**Etkilenen Dosyalar:**
- `models/lab-types.ts` — `LabInteractiveSettings` genişletme
- `workspace-interactive-controls.ts` — UI genişletme
- `workspace-surface.ts` — `renderPreviewMedia` filter güncellemesi
- `main-functions/media-analysis/host/edit-support.ts` — recipe genişletme
- `main-functions/media-analysis/host/edit-pipeline.ts` — ffmpeg command builder

---

### 4. 📊 Ses Frekans Görselleştirme ve İnteraktif Ayarlar

**Hedef:** Ses dosyalarında gerçek zamanlı frekans görselleştirme ve sese özel parametrik ayarlar.

**Kapsam:**
- **Real-time Waveform** — HTML5 Canvas ile canlı dalga formu görselleştirme
- **Spectrogram Display** — mevcut statik görüntü yerine interaktif spektrogram (zoom, pan)
- **Frequency Spectrum** — anlık frekans spektrumu grafiği (FFT)
- **Parametric EQ** — 5-band parametrik ekolayzer (frekans, gain, Q)
- **Cutoff Frequency Control** — lowpass/highpass için frekans slider'ı (Hz cinsinden)
- **Loudness Normalization** — LUFS hedefleme (ffmpeg `loudnorm`)
- **Audio Preview** — filtre uygulanmış sesin anlık dinlenebilir hali

**Teknik Yaklaşım:**
- `LabAudioFocusSettings` genişlet: `lowpassHz`, `highpassHz`, `eqBands`, `lufsTarget`
- Web Audio API (`AudioContext`, `AnalyserNode`) ile client-side görselleştirme
- `workspace-audio-focus.ts` → tam genişletme; yeni "Audio Workstation" paneli
- Yeni UI bileşeni: `workspace-audio-visualizer.ts` — Canvas tabanlı görselleştirme
- Host tarafında: ffmpeg `equalizer`, `loudnorm` filtre zinciri export

**Etkilenen Dosyalar:**
- `models/lab-types.ts` — `LabAudioFocusSettings` genişletme
- `workspace-audio-focus.ts` — tam genişletme
- Yeni: `workspace-audio-visualizer.ts`
- `workspace-surface.ts` — audio görselleştirme entegrasyonu
- `main-functions/audio-analysis/host/process-local-runners.ts` — filtre genişletme
- `main-functions/media-analysis/host/edit-support.ts` — audio recipe genişletme

---

### 5. 🔊 Gelişmiş Ses Analiz Çıktıları — İnteraktif Görünüm

**Hedef:** Mevcut ses analiz artifact'lerini (spektrogram, waveform, prosody contour) interaktif olarak görüntüleme.

**Kapsam:**
- Artifact preview'da spektrogram/waveform zoom ve pan
- Prosody contour (F0 eğrisi) interaktif grafik
- Speaker diarization timeline görselleştirme
- Spectral descriptor (centroid, rolloff, flatness) zaman serisi grafiği
- Analiz sonucu artifact'ler arasında geçişli navigasyon

**Teknik Yaklaşım:**
- Mevcut `LabPreviewArtifactProjection` sistemini genişlet
- Canvas/SVG tabanlı interaktif görüntüleyici bileşenler
- Artifact metadata'dan görselleştirme parametrelerini çözümle
- `workspace-process-panel.ts` içinde artifact preview genişletmesi

**Etkilenen Dosyalar:**
- `workspace-process-panel.ts` — artifact preview genişletme
- Yeni: `workspace-artifact-viewer.ts`
- `main-functions/audio-analysis/host/module-projection.ts` — metadata zenginleştirme

---

### 6. 🖼️ Resim Analizi Genişletme

**Hedef:** Image source kind için şu an sınırlı olan yetenekleri genişlet.

**Kapsam:**
- **EXIF/Metadata Inspector** — resim metadata'sını yapılandırılmış gösterim
- **Histogram Display** — RGB ve luminance histogramları
- **Color Palette Extraction** — dominant renk analizi (ffmpeg/Python)
- **Image Comparison** — iki resmi yan yana veya overlay karşılaştırma
- **Steganography Check** — temel steganografi tespiti

**Teknik Yaklaşım:**
- `visual-structure` ve `visual-forensics` capability'lerini `sourceKinds`'a `"image"` ekle
- ffmpeg `signalstats`, `entropy` filter'ları ile analiz
- Python tabanlı renk paleti çıkarma (yeni tool dependency)

**Etkilenen Dosyalar:**
- `models/lab-types.ts` — `CAPABILITY_FAMILIES` güncelleme
- `main-functions/media-analysis/host/visual-analysis-runtime.ts`
- `main-functions/media-analysis/host/source-metadata.ts` — EXIF genişletme

---

## Önceliklendirme Önerisi

| Öncelik | Geliştirme | Karmaşıklık | Değer |
|---------|-----------|-------------|-------|
| **P0** | 2. yt-dlp audio/video-only modu | Düşük | Yüksek — mevcut altyapı hazır |
| **P0** | 1. Video/Resim Export (ROI + Timeline) | Orta | Yüksek — doğrudan kullanıcı talebi |
| **P1** | 3. Gelişmiş Renk/Ton Ayarları | Orta | Yüksek — profesyonel kullanım |
| **P1** | 4. Ses Frekans Görselleştirme | Yüksek | Yüksek — farklılaştırıcı özellik |
| **P2** | 5. İnteraktif Analiz Çıktıları | Yüksek | Orta — UX iyileştirmesi |
| **P2** | 6. Resim Analizi Genişletme | Orta | Orta — image source sınırlı kullanım |

---

## Uygulama Sırası Önerisi

1. **Faz 1** — yt-dlp audio/video-only + temel export (ROI image, frame grab)
2. **Faz 2** — Gelişmiş renk/ton + timeline clip export
3. **Faz 3** — Ses frekans görselleştirme + parametrik EQ
4. **Faz 4** — İnteraktif analiz çıktıları + resim analizi

Her faz kendi içinde bağımsız test edilebilir ve deploy edilebilir.
