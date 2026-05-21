import type { SourcePackage } from "../types/source-package.js";

export const SAMPLE_USER_TEXT_SOURCE_PACKAGE: SourcePackage = {
  sourcePackageId: "sample-user-text",
  sourceKind: "user_text",
  title: "Field Notebook Excerpt",
  origin: "manual:user-notebook",
  language: "en",
  createdAt: "2026-05-21T10:00:00.000Z",
  sourceItems: [
    {
      sourceItemId: "sample-user-text-item-1",
      label: "Notebook page",
      origin: "manual:user-notebook/page-1",
      metadata: {},
    },
  ],
  cleanedText: "A short local note about repeating shadows and navigation cues.",
  segments: [],
  quotes: [
    {
      quoteId: "sample-user-text-quote-1",
      sourceItemId: "sample-user-text-item-1",
      segmentId: null,
      label: "Shadow cue",
      excerpt: "The same shadow cue appears whenever the path turns north.",
      context: "User-entered field observation.",
      page: "1",
      timecode: null,
      speaker: null,
      metadata: {},
    },
  ],
  observations: [],
  motifs: [
    {
      motifId: "sample-user-text-motif-1",
      label: "Repeating shadow cue",
      content: "Shadow cues repeat around directional choices.",
      relatedQuoteIds: ["sample-user-text-quote-1"],
      metadata: {},
    },
  ],
  uncertainties: [],
  numericPatterns: [],
  references: [],
  metadata: {
    summary: "Manual note package prepared as a Source Workbench draft sample.",
  },
};

export const SAMPLE_NEWSPAPER_SOURCE_PACKAGE: SourcePackage = {
  sourcePackageId: "sample-newspaper",
  sourceKind: "newspaper",
  title: "Evening Gazette Archive Note",
  origin: "archive:newspaper/evening-gazette-1912-05-01",
  language: "en",
  createdAt: "2026-05-21T10:05:00.000Z",
  sourceItems: [
    {
      sourceItemId: "sample-newspaper-item-1",
      label: "Evening Gazette, 1912-05-01",
      origin: "archive:newspaper/evening-gazette-1912-05-01/page-3",
      metadata: {},
    },
  ],
  cleanedText: null,
  segments: [],
  quotes: [
    {
      quoteId: "sample-newspaper-quote-1",
      sourceItemId: "sample-newspaper-item-1",
      segmentId: null,
      label: "Market rhythm",
      excerpt: "Reports repeated every seventh edition with nearly identical wording.",
      context: "Archive clipping transcription.",
      page: "3",
      timecode: null,
      speaker: null,
      metadata: {},
    },
  ],
  observations: [
    {
      observationId: "sample-newspaper-observation-1",
      observationType: "frequency",
      label: "Seven-edition repetition",
      content: "The clipping suggests a repeated publication rhythm.",
      relatedQuoteIds: ["sample-newspaper-quote-1"],
      metadata: {},
    },
  ],
  motifs: [],
  uncertainties: [
    {
      uncertaintyId: "sample-newspaper-uncertainty-1",
      label: "Archive completeness",
      content: "The series may be incomplete because only one month was sampled.",
      relatedQuoteIds: ["sample-newspaper-quote-1"],
      metadata: {},
    },
  ],
  numericPatterns: [
    {
      patternId: "sample-newspaper-number-1",
      label: "Seven-count cadence",
      content: "A repeated count appears across edition numbers.",
      value: "7",
      relatedQuoteIds: ["sample-newspaper-quote-1"],
      metadata: {},
    },
  ],
  references: [],
  metadata: {},
};

export const SAMPLE_SUBTITLE_SOURCE_PACKAGE: SourcePackage = {
  sourcePackageId: "sample-subtitle-archive",
  sourceKind: "youtube_channel_subtitles",
  title: "Channel Subtitle Bundle",
  origin: "producer:subtitle-channel/channel-alpha",
  language: "tr",
  createdAt: "2026-05-21T10:10:00.000Z",
  sourceItems: [
    {
      sourceItemId: "sample-subtitle-item-1",
      label: "Episode transcript",
      origin: "producer:subtitle-channel/channel-alpha/video-1",
      metadata: {},
    },
  ],
  cleanedText: null,
  segments: [
    {
      segmentId: "sample-subtitle-segment-1",
      sourceItemId: "sample-subtitle-item-1",
      label: "Opening minute",
      text: "Bir iz tekrar ediyorsa, onu tek olay gibi okumamak gerekir.",
      order: 1,
      page: null,
      timecode: "00:01:12",
      speaker: "Narrator",
      metadata: {},
    },
  ],
  quotes: [
    {
      quoteId: "sample-subtitle-quote-1",
      sourceItemId: "sample-subtitle-item-1",
      segmentId: "sample-subtitle-segment-1",
      label: "Repeated trace",
      excerpt: "Bir iz tekrar ediyorsa, onu tek olay gibi okumamak gerekir.",
      context: "Subtitle sample with timecode.",
      page: null,
      timecode: "00:01:12",
      speaker: "Narrator",
      metadata: {},
    },
  ],
  observations: [],
  motifs: [],
  uncertainties: [],
  numericPatterns: [],
  references: [],
  metadata: {},
};

export const SAMPLE_SOURCE_PACKAGES = [
  SAMPLE_USER_TEXT_SOURCE_PACKAGE,
  SAMPLE_NEWSPAPER_SOURCE_PACKAGE,
  SAMPLE_SUBTITLE_SOURCE_PACKAGE,
] as const;
