package com.hayaletev.androidcompanion.capture

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import androidx.camera.core.ImageProxy
import java.nio.ByteBuffer

private const val H264_MIME_TYPE = "video/avc"
private const val H264_CODEC_LABEL = "avc1.42E01E"
private const val H264_BIT_RATE = 1_000_000
private const val H264_FRAME_RATE = 12
private const val H264_I_FRAME_INTERVAL_SECONDS = 1

class H264PreviewEncoder {
    private var codec: MediaCodec? = null
    private var width = 0
    private var height = 0
    private var sequenceNumber = 0L
    private var codecConfigBytes: ByteArray? = null
    private val bufferInfo = MediaCodec.BufferInfo()

    fun reset() {
        runCatching { codec?.stop() }
        runCatching { codec?.release() }
        codec = null
        width = 0
        height = 0
        sequenceNumber = 0L
        codecConfigBytes = null
    }

    fun encode(imageProxy: ImageProxy, timestampMs: Long): List<CameraPreviewFrame> {
        val imageWidth = imageProxy.width
        val imageHeight = imageProxy.height
        if (imageWidth <= 0 || imageHeight <= 0 || imageWidth % 2 != 0 || imageHeight % 2 != 0) {
            throw IllegalArgumentException("H.264 preview requires positive even frame dimensions.")
        }

        val activeCodec = ensureCodec(imageWidth, imageHeight)
        val inputBytes = imageProxy.toI420()
        val inputIndex = activeCodec.dequeueInputBuffer(0)
        if (inputIndex >= 0) {
            val inputBuffer = activeCodec.getInputBuffer(inputIndex)
                ?: throw IllegalStateException("H.264 encoder input buffer is missing.")
            inputBuffer.clear()
            inputBuffer.put(inputBytes)
            activeCodec.queueInputBuffer(
                inputIndex,
                0,
                inputBytes.size,
                timestampMs * 1_000L,
                0,
            )
        }

        return drainOutput(activeCodec, timestampMs)
    }

    private fun ensureCodec(nextWidth: Int, nextHeight: Int): MediaCodec {
        val activeCodec = codec
        if (activeCodec != null && width == nextWidth && height == nextHeight) {
            return activeCodec
        }

        reset()
        val format = MediaFormat.createVideoFormat(H264_MIME_TYPE, nextWidth, nextHeight)
        format.setInteger(
            MediaFormat.KEY_COLOR_FORMAT,
            MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible,
        )
        format.setInteger(MediaFormat.KEY_BIT_RATE, H264_BIT_RATE)
        format.setInteger(MediaFormat.KEY_FRAME_RATE, H264_FRAME_RATE)
        format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, H264_I_FRAME_INTERVAL_SECONDS)
        format.setInteger(MediaFormat.KEY_PREPEND_HEADER_TO_SYNC_FRAMES, 1)

        val nextCodec = MediaCodec.createEncoderByType(H264_MIME_TYPE)
        nextCodec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        nextCodec.start()
        codec = nextCodec
        width = nextWidth
        height = nextHeight
        return nextCodec
    }

    private fun drainOutput(activeCodec: MediaCodec, timestampMs: Long): List<CameraPreviewFrame> {
        val frames = mutableListOf<CameraPreviewFrame>()
        while (true) {
            when (val outputIndex = activeCodec.dequeueOutputBuffer(bufferInfo, 0)) {
                MediaCodec.INFO_TRY_AGAIN_LATER -> return frames
                MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    codecConfigBytes = readCodecConfig(activeCodec.outputFormat)
                }
                else -> {
                    if (outputIndex < 0) {
                        continue
                    }
                    if (bufferInfo.size > 0) {
                        val bytes = readOutputBytes(activeCodec, bufferInfo, outputIndex)
                        val isConfig =
                            bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
                        val isKeyFrame =
                            bufferInfo.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0

                        if (isConfig) {
                            codecConfigBytes = bytes
                        } else {
                            val config = codecConfigBytes
                            frames += buildFrame(
                                bytes = if (isKeyFrame && config != null) config + bytes else bytes,
                                timestampMs = timestampMs,
                                isKeyFrame = isKeyFrame,
                                isConfig = false,
                            )
                        }
                    }
                    activeCodec.releaseOutputBuffer(outputIndex, false)
                }
            }
        }
    }

    private fun buildFrame(
        bytes: ByteArray,
        timestampMs: Long,
        isKeyFrame: Boolean,
        isConfig: Boolean,
    ): CameraPreviewFrame {
        return CameraPreviewFrame(
            bytes = bytes,
            mimeType = H264_MIME_TYPE,
            width = width,
            height = height,
            timestampMs = timestampMs,
            codec = H264_CODEC_LABEL,
            isKeyFrame = isKeyFrame,
            isConfig = isConfig,
            sequenceNumber = sequenceNumber++,
        )
    }

    private fun readOutputBytes(
        activeCodec: MediaCodec,
        info: MediaCodec.BufferInfo,
        outputIndex: Int,
    ): ByteArray {
        val outputBuffer = activeCodec.getOutputBuffer(outputIndex)
            ?: throw IllegalStateException("H.264 encoder output buffer is missing.")
        val duplicate = outputBuffer.duplicate()
        duplicate.position(info.offset)
        duplicate.limit(info.offset + info.size)
        val bytes = ByteArray(info.size)
        duplicate.get(bytes)
        return bytes
    }

    private fun readCodecConfig(format: MediaFormat): ByteArray? {
        val buffers = listOfNotNull(
            format.getByteBuffer("csd-0")?.toByteArray(),
            format.getByteBuffer("csd-1")?.toByteArray(),
        )
        if (buffers.isEmpty()) {
            return null
        }
        val totalSize = buffers.sumOf { it.size }
        val output = ByteArray(totalSize)
        var offset = 0
        buffers.forEach { buffer ->
            buffer.copyInto(output, offset)
            offset += buffer.size
        }
        return output
    }

    private fun ByteBuffer.toByteArray(): ByteArray {
        val duplicate = duplicate()
        val bytes = ByteArray(duplicate.remaining())
        duplicate.get(bytes)
        return bytes
    }

    private fun ImageProxy.toI420(): ByteArray {
        val yPlane = planes[0]
        val uPlane = planes[1]
        val vPlane = planes[2]
        val output = ByteArray(width * height * 3 / 2)
        var outputOffset = 0

        outputOffset = copyPlaneToArray(
            buffer = yPlane.buffer,
            rowStride = yPlane.rowStride,
            pixelStride = yPlane.pixelStride,
            width = width,
            height = height,
            output = output,
            outputOffset = outputOffset,
        )

        outputOffset = copyPlaneToArray(
            buffer = uPlane.buffer,
            rowStride = uPlane.rowStride,
            pixelStride = uPlane.pixelStride,
            width = width / 2,
            height = height / 2,
            output = output,
            outputOffset = outputOffset,
        )

        copyPlaneToArray(
            buffer = vPlane.buffer,
            rowStride = vPlane.rowStride,
            pixelStride = vPlane.pixelStride,
            width = width / 2,
            height = height / 2,
            output = output,
            outputOffset = outputOffset,
        )

        return output
    }

    private fun copyPlaneToArray(
        buffer: ByteBuffer,
        rowStride: Int,
        pixelStride: Int,
        width: Int,
        height: Int,
        output: ByteArray,
        outputOffset: Int,
    ): Int {
        var nextOutputOffset = outputOffset
        for (row in 0 until height) {
            val rowOffset = row * rowStride
            for (column in 0 until width) {
                output[nextOutputOffset++] = buffer.get(rowOffset + column * pixelStride)
            }
        }
        return nextOutputOffset
    }
}
