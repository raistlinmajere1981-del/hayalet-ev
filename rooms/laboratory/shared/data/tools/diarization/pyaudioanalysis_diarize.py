#!/usr/bin/env python3

import argparse
import contextlib
import datetime as dt
import json
import wave
from pathlib import Path

import numpy as np
from pyAudioAnalysis import audioSegmentation as aS


def read_wav_duration_seconds(file_path: str) -> float:
    with contextlib.closing(wave.open(file_path, "rb")) as wav_file:
        frames = wav_file.getnframes()
        sample_rate = wav_file.getframerate()
        return float(frames) / float(sample_rate) if sample_rate else 0.0


def build_segments(labels, mid_step: float, duration_seconds: float):
    if len(labels) == 0:
        return []

    segments = []
    start_index = 0
    current_label = int(labels[0])

    for index in range(1, len(labels)):
        next_label = int(labels[index])
        if next_label == current_label:
            continue
        segments.append(
            {
                "speakerId": f"speaker_{current_label + 1}",
                "speakerIndex": current_label,
                "startSeconds": round(start_index * mid_step, 3),
                "endSeconds": round(min(duration_seconds, index * mid_step), 3),
                "windowCount": index - start_index,
            }
        )
        start_index = index
        current_label = next_label

    segments.append(
        {
            "speakerId": f"speaker_{current_label + 1}",
            "speakerIndex": current_label,
            "startSeconds": round(start_index * mid_step, 3),
            "endSeconds": round(min(duration_seconds, len(labels) * mid_step), 3),
            "windowCount": len(labels) - start_index,
        }
    )
    return segments


def should_retry_with_local_fallback(error: Exception) -> bool:
    message = str(error).lower()
    return "'diag' covars must be positive" in message


def run_local_kmeans_diarization(
    input_path: str,
    requested_speaker_count: int,
    mid_window: float,
    mid_step: float,
    short_window: float,
):
    sampling_rate, signal = aS.audioBasicIO.read_audio_file(input_path)
    signal = aS.audioBasicIO.stereo_to_mono(signal)

    base_dir = Path(aS.__file__).resolve().parent / "data" / "models"
    classifier_all, mean_all, std_all, class_names_all, _, _, _, _, _ = aS.at.load_model(
        str(base_dir / "svm_rbf_speaker_10")
    )
    classifier_fm, mean_fm, std_fm, class_names_fm, _, _, _, _, _ = aS.at.load_model(
        str(base_dir / "svm_rbf_speaker_male_female")
    )

    mid_feats, _, _ = aS.mtf.mid_feature_extraction(
        signal,
        sampling_rate,
        mid_window * sampling_rate,
        mid_step * sampling_rate,
        round(sampling_rate * 0.05),
        round(sampling_rate * 0.05),
    )

    mid_term_features = np.zeros(
        (mid_feats.shape[0] + len(class_names_all) + len(class_names_fm), mid_feats.shape[1])
    )
    for index in range(mid_feats.shape[1]):
        feature_norm_all = (mid_feats[:, index] - mean_all) / std_all
        feature_norm_fm = (mid_feats[:, index] - mean_fm) / std_fm
        _, probabilities_all = aS.at.classifier_wrapper(classifier_all, "svm_rbf", feature_norm_all)
        _, probabilities_fm = aS.at.classifier_wrapper(classifier_fm, "svm_rbf", feature_norm_fm)
        start = mid_feats.shape[0]
        end = mid_feats.shape[0] + len(class_names_all)
        mid_term_features[0 : mid_feats.shape[0], index] = mid_feats[:, index]
        mid_term_features[start:end, index] = probabilities_all + 1e-4
        mid_term_features[end::, index] = probabilities_fm + 1e-4

    scaler = aS.StandardScaler()
    mid_feats_norm = scaler.fit_transform(mid_term_features.T)

    dist_all = np.sum(aS.distance.squareform(aS.distance.pdist(mid_feats_norm.T)), axis=0)
    mean_distance = np.mean(dist_all)
    non_outlier_indices = np.nonzero(dist_all < 1.1 * mean_distance)[0]
    mid_feats_norm_original = mid_feats_norm
    mid_feats_norm = mid_feats_norm[:, non_outlier_indices]

    if mid_feats_norm.shape[0] == 0:
        non_outlier_indices = np.arange(mid_feats_norm_original.shape[0])
        mid_feats_norm = mid_feats_norm_original

    speaker_range = [requested_speaker_count] if requested_speaker_count > 0 else list(range(2, 10))
    cluster_labels = []
    silhouettes = []

    for speaker_count in speaker_range:
        kmeans = aS.sklearn.cluster.KMeans(n_clusters=speaker_count, n_init=10, random_state=0)
        kmeans.fit(mid_feats_norm)
        labels = kmeans.labels_
        cluster_labels.append(labels)

        silhouette_a = []
        silhouette_b = []
        for cluster_index in range(speaker_count):
            cluster_share = np.nonzero(labels == cluster_index)[0].shape[0] / float(len(labels))
            if cluster_share < 0.020:
                silhouette_a.append(0.0)
                silhouette_b.append(0.0)
                continue

            cluster_features = mid_feats_norm[labels == cluster_index, :]
            intra_cluster_distance = aS.distance.pdist(cluster_features.T)
            silhouette_a.append(np.mean(intra_cluster_distance) * cluster_share)
            inter_cluster_distances = []
            for other_cluster_index in range(speaker_count):
                if other_cluster_index == cluster_index:
                    continue
                other_cluster_share = np.nonzero(labels == other_cluster_index)[0].shape[0] / float(len(labels))
                other_cluster_features = mid_feats_norm[labels == other_cluster_index, :]
                inter_cluster_distance = aS.distance.cdist(cluster_features, other_cluster_features)
                inter_cluster_distances.append(
                    np.mean(inter_cluster_distance) * (cluster_share + other_cluster_share) / 2.0
                )
            silhouette_b.append(min(inter_cluster_distances) if inter_cluster_distances else 0.0)

        silhouette_scores = []
        for cluster_index in range(speaker_count):
            numerator = silhouette_b[cluster_index] - silhouette_a[cluster_index]
            denominator = max(silhouette_b[cluster_index], silhouette_a[cluster_index]) + 1e-5
            silhouette_scores.append(numerator / denominator)
        silhouettes.append(float(np.mean(silhouette_scores)))

    best_index = int(np.argmax(silhouettes))
    best_labels = np.asarray(cluster_labels[best_index]).astype(int)

    full_labels = np.zeros((mid_feats_norm_original.shape[0],), dtype=int)
    for frame_index in range(full_labels.shape[0]):
        nearest_index = int(np.argmin(np.abs(frame_index - non_outlier_indices)))
        full_labels[frame_index] = int(best_labels[nearest_index])

    smoothed_labels = aS.scipy.signal.medfilt(full_labels, 5)
    return smoothed_labels.astype(int), None, None


def main():
    parser = argparse.ArgumentParser(description="Run pyAudioAnalysis speaker diarization and emit JSON.")
    parser.add_argument("--input", required=True, help="Path to the prepared WAV file.")
    parser.add_argument("--output", required=True, help="Path to the JSON output.")
    parser.add_argument("--num-speakers", type=int, default=0, help="Known number of speakers, or 0 to infer.")
    parser.add_argument("--mid-window", type=float, default=2.0, help="Mid-term window in seconds.")
    parser.add_argument("--mid-step", type=float, default=0.2, help="Mid-term step in seconds.")
    parser.add_argument("--short-window", type=float, default=0.05, help="Short-term window in seconds.")
    parser.add_argument("--lda-dim", type=int, default=0, help="Optional LDA dimension, 0 disables it.")
    args = parser.parse_args()

    effective_num_speakers = args.num_speakers
    fallback_applied = False
    fallback_reason = None
    try:
        labels, purity_cluster, purity_speaker = aS.speaker_diarization(
            args.input,
            args.num_speakers,
            args.mid_window,
            args.mid_step,
            args.short_window,
            args.lda_dim,
            False,
        )
    except Exception as error:
        if not should_retry_with_local_fallback(error):
            raise
        fallback_applied = True
        fallback_reason = str(error)
        labels, purity_cluster, purity_speaker = run_local_kmeans_diarization(
            args.input,
            args.num_speakers,
            args.mid_window,
            args.mid_step,
            args.short_window,
        )

    labels_array = np.asarray(labels).astype(int)
    duration_seconds = read_wav_duration_seconds(args.input)
    segments = build_segments(labels_array.tolist(), args.mid_step, duration_seconds)
    unique_labels = sorted({int(label) for label in labels_array.tolist()})
    if effective_num_speakers <= 0:
        effective_num_speakers = len(unique_labels)

    payload = {
        "generatedAt": dt.datetime.now(dt.UTC).isoformat().replace("+00:00", "Z"),
        "inputPath": args.input,
        "durationSeconds": duration_seconds,
        "numSpeakersRequested": args.num_speakers,
        "effectiveNumSpeakers": effective_num_speakers,
        "speakerCountMode": "fixed" if args.num_speakers > 0 else "auto",
        "fallbackApplied": fallback_applied,
        "fallbackReason": fallback_reason,
        "speakerCount": len(unique_labels),
        "midWindowSeconds": args.mid_window,
        "midStepSeconds": args.mid_step,
        "shortWindowSeconds": args.short_window,
        "ldaDimension": args.lda_dim,
        "purityCluster": None if purity_cluster is None or purity_cluster < 0 else float(purity_cluster),
        "puritySpeaker": None if purity_speaker is None or purity_speaker < 0 else float(purity_speaker),
        "labels": labels_array.tolist(),
        "segments": segments,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
