#include <jni.h>
#include <whisper.h>

#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

struct WavData {
    int sample_rate;
    int channels;
    std::vector<float> samples;
};

uint16_t read_u16_le(const uint8_t * data) {
    return static_cast<uint16_t>(data[0]) | (static_cast<uint16_t>(data[1]) << 8);
}

uint32_t read_u32_le(const uint8_t * data) {
    return static_cast<uint32_t>(data[0]) |
           (static_cast<uint32_t>(data[1]) << 8) |
           (static_cast<uint32_t>(data[2]) << 16) |
           (static_cast<uint32_t>(data[3]) << 24);
}

std::vector<uint8_t> read_file(const std::string & path) {
    FILE * file = std::fopen(path.c_str(), "rb");
    if (file == nullptr) {
        throw std::runtime_error("Audio file could not be opened.");
    }

    std::fseek(file, 0, SEEK_END);
    const long size = std::ftell(file);
    std::fseek(file, 0, SEEK_SET);
    if (size <= 0) {
        std::fclose(file);
        throw std::runtime_error("Audio file is empty.");
    }

    std::vector<uint8_t> data(static_cast<size_t>(size));
    const size_t read = std::fread(data.data(), 1, data.size(), file);
    std::fclose(file);
    if (read != data.size()) {
        throw std::runtime_error("Audio file could not be read.");
    }
    return data;
}

WavData read_wav_pcm16(const std::string & path) {
    const std::vector<uint8_t> data = read_file(path);
    if (data.size() < 44 || std::memcmp(data.data(), "RIFF", 4) != 0 ||
        std::memcmp(data.data() + 8, "WAVE", 4) != 0) {
        throw std::runtime_error("Audio file is not a WAV file.");
    }

    size_t cursor = 12;
    int sample_rate = 0;
    int channels = 0;
    int bits_per_sample = 0;
    int audio_format = 0;
    const uint8_t * pcm = nullptr;
    size_t pcm_size = 0;

    while (cursor + 8 <= data.size()) {
        const uint8_t * chunk = data.data() + cursor;
        const uint32_t chunk_size = read_u32_le(chunk + 4);
        const size_t payload = cursor + 8;
        if (payload + chunk_size > data.size()) {
            break;
        }

        if (std::memcmp(chunk, "fmt ", 4) == 0 && chunk_size >= 16) {
            audio_format = read_u16_le(data.data() + payload);
            channels = read_u16_le(data.data() + payload + 2);
            sample_rate = static_cast<int>(read_u32_le(data.data() + payload + 4));
            bits_per_sample = read_u16_le(data.data() + payload + 14);
        } else if (std::memcmp(chunk, "data", 4) == 0) {
            pcm = data.data() + payload;
            pcm_size = chunk_size;
        }

        cursor = payload + chunk_size + (chunk_size % 2);
    }

    if (audio_format != 1 || bits_per_sample != 16 || sample_rate != WHISPER_SAMPLE_RATE) {
        throw std::runtime_error("WAV must be PCM16 at 16 kHz.");
    }
    if (channels <= 0 || pcm == nullptr || pcm_size < static_cast<size_t>(channels * 2)) {
        throw std::runtime_error("WAV data chunk is empty.");
    }

    const size_t frames = pcm_size / static_cast<size_t>(channels * 2);
    std::vector<float> samples;
    samples.reserve(frames);
    for (size_t frame = 0; frame < frames; ++frame) {
        int mixed = 0;
        for (int channel = 0; channel < channels; ++channel) {
            const size_t offset = (frame * static_cast<size_t>(channels) + channel) * 2;
            const int16_t sample = static_cast<int16_t>(read_u16_le(pcm + offset));
            mixed += sample;
        }
        samples.push_back(static_cast<float>(mixed) / static_cast<float>(channels * 32768.0f));
    }

    return WavData{sample_rate, channels, std::move(samples)};
}

std::string jstring_to_string(JNIEnv * env, jstring value) {
    if (value == nullptr) {
        return "";
    }
    const char * chars = env->GetStringUTFChars(value, nullptr);
    if (chars == nullptr) {
        return "";
    }
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

void throw_java(JNIEnv * env, const std::string & message) {
    jclass exception = env->FindClass("java/lang/IllegalStateException");
    env->ThrowNew(exception, message.c_str());
}

} // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_com_hayaletev_androidcompanion_transcript_AndroidWhisperNative_transcribe(
    JNIEnv * env,
    jobject,
    jstring model_path,
    jstring audio_path,
    jstring language,
    jint threads
) {
    try {
        const std::string model = jstring_to_string(env, model_path);
        const std::string audio = jstring_to_string(env, audio_path);
        const std::string lang = jstring_to_string(env, language);
        if (model.empty() || audio.empty()) {
            throw std::runtime_error("Model and audio paths are required.");
        }

        WavData wav = read_wav_pcm16(audio);
        whisper_context_params context_params = whisper_context_default_params();
        whisper_context * ctx = whisper_init_from_file_with_params(model.c_str(), context_params);
        if (ctx == nullptr) {
            throw std::runtime_error("whisper.cpp model could not be loaded.");
        }

        whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        params.n_threads = std::max(1, static_cast<int>(threads));
        params.language = lang.empty() ? "tr" : lang.c_str();
        params.translate = false;
        params.no_context = true;
        params.no_timestamps = true;
        params.print_progress = false;
        params.print_realtime = false;
        params.print_timestamps = false;

        const int result = whisper_full(ctx, params, wav.samples.data(), wav.samples.size());
        if (result != 0) {
            whisper_free(ctx);
            throw std::runtime_error("whisper.cpp transcription failed.");
        }

        std::string transcript;
        const int segments = whisper_full_n_segments(ctx);
        for (int index = 0; index < segments; ++index) {
            const char * text = whisper_full_get_segment_text(ctx, index);
            if (text != nullptr) {
                transcript += text;
            }
        }
        whisper_free(ctx);
        return env->NewStringUTF(transcript.c_str());
    } catch (const std::exception & error) {
        throw_java(env, error.what());
        return nullptr;
    }
}
