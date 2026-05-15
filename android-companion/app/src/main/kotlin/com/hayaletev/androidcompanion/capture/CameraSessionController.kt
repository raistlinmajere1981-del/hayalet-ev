package com.hayaletev.androidcompanion.capture

import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.os.SystemClock
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val LIVE_PREVIEW_FRAME_INTERVAL_MS = 550L
private const val LIVE_PREVIEW_H264_FRAME_INTERVAL_MS = 85L
private const val LIVE_PREVIEW_JPEG_QUALITY = 58

enum class CaptureLens {
    BACK,
    FRONT,
}

enum class CapturePhotoQuality {
    HIGH,
    BALANCED,
}

data class CameraSessionConfig(
    val lens: CaptureLens = CaptureLens.BACK,
    val photoQuality: CapturePhotoQuality = CapturePhotoQuality.HIGH,
)

data class CameraPreviewFrame(
    val bytes: ByteArray,
    val mimeType: String = "image/jpeg",
    val width: Int,
    val height: Int,
    val timestampMs: Long,
    val codec: String? = null,
    val isKeyFrame: Boolean = true,
    val isConfig: Boolean = false,
    val sequenceNumber: Long = 0L,
)

class CameraSessionController(
    private val activity: AppCompatActivity,
    private val previewView: PreviewView,
) {
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageCapture: ImageCapture? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var currentConfig: CameraSessionConfig? = null
    private var previewFrameSink: ((CameraPreviewFrame) -> Unit)? = null
    @Volatile private var previewStreamingEnabled = false
    @Volatile private var h264PreviewAvailable = true
    @Volatile private var lastPreviewFrameAtMs = 0L
    private val analysisExecutor = Executors.newSingleThreadExecutor()
    private val h264PreviewEncoder = H264PreviewEncoder()

    fun isPreviewBound(): Boolean = imageCapture != null

    fun setPreviewFrameSink(sink: ((CameraPreviewFrame) -> Unit)?) {
        previewFrameSink = sink
    }

    fun setPreviewStreamingEnabled(enabled: Boolean) {
        previewStreamingEnabled = enabled
        lastPreviewFrameAtMs = 0L
        if (enabled.not()) {
            h264PreviewEncoder.reset()
            h264PreviewAvailable = true
        }
        CompanionDiagnostics.setState(
            "Live preview stream",
            if (enabled) "Enabled" else "Disabled",
        )
    }

    suspend fun ensurePreview(config: CameraSessionConfig) {
        if (imageCapture != null && currentConfig == config) {
            CompanionDiagnostics.d("camera", "Camera preview is already active.", describeConfig(config))
            return
        }

        CompanionDiagnostics.i("camera", "Binding camera preview.", describeConfig(config))
        suspendCancellableCoroutine { continuation ->
            val cameraProviderFuture = ProcessCameraProvider.getInstance(activity)
            cameraProviderFuture.addListener(
                {
                    try {
                        val resolvedProvider = cameraProviderFuture.get()
                        val preview =
                            Preview.Builder().build().also {
                                it.surfaceProvider = previewView.surfaceProvider
                            }
                        val nextImageCapture =
                            ImageCapture.Builder()
                                .setCaptureMode(
                                    if (config.photoQuality == CapturePhotoQuality.HIGH) {
                                        ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY
                                    } else {
                                        ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
                                    }
                                )
                                .setJpegQuality(
                                    if (config.photoQuality == CapturePhotoQuality.HIGH) 95 else 82
                                )
                                .build()
                        val nextImageAnalysis =
                            ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                                .also { analysis ->
                                    analysis.setAnalyzer(analysisExecutor) { imageProxy ->
                                        handlePreviewFrame(imageProxy)
                                    }
                                }

                        resolvedProvider.unbindAll()
                        resolvedProvider.bindToLifecycle(
                            activity,
                            if (config.lens == CaptureLens.FRONT) {
                                CameraSelector.DEFAULT_FRONT_CAMERA
                            } else {
                                CameraSelector.DEFAULT_BACK_CAMERA
                            },
                            preview,
                            nextImageCapture,
                            nextImageAnalysis,
                        )

                        cameraProvider = resolvedProvider
                        imageCapture = nextImageCapture
                        imageAnalysis = nextImageAnalysis
                        currentConfig = config
                        CompanionDiagnostics.setState("Camera preview", "Bound (${describeConfig(config)})")
                        CompanionDiagnostics.i("camera", "Camera preview is active.", describeConfig(config))
                        continuation.resume(Unit)
                    } catch (error: Exception) {
                        CompanionDiagnostics.e("camera", "Failed to bind camera preview.", throwable = error)
                        continuation.resumeWithException(error)
                    }
                },
                ContextCompat.getMainExecutor(activity),
            )
        }
    }

    fun stopSession() {
        if (imageCapture != null) {
            CompanionDiagnostics.i("camera", "Stopping camera preview session.")
        }
        setPreviewStreamingEnabled(false)
        h264PreviewEncoder.reset()
        cameraProvider?.unbindAll()
        imageCapture = null
        imageAnalysis = null
        currentConfig = null
        CompanionDiagnostics.setState("Camera preview", "Idle")
    }

    suspend fun takePhoto(outputFile: File): File {
        val capture = imageCapture ?: throw IllegalStateException("Camera preview is not ready yet.")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()
        CompanionDiagnostics.i("camera", "Capturing photo.", outputFile.name)
        return suspendCancellableCoroutine { continuation ->
            capture.takePicture(
                outputOptions,
                ContextCompat.getMainExecutor(activity),
                object : ImageCapture.OnImageSavedCallback {
                    override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                        CompanionDiagnostics.i("camera", "Photo capture completed.", outputFile.name)
                        continuation.resume(outputFile)
                    }

                    override fun onError(exception: ImageCaptureException) {
                        CompanionDiagnostics.e("camera", "Photo capture failed.", throwable = exception)
                        continuation.resumeWithException(exception)
                    }
                },
            )
        }
    }

    private fun describeConfig(config: CameraSessionConfig): String {
        return buildString {
            append(config.lens.name.lowercase(Locale.US))
            append(" / ")
            append(config.photoQuality.name.lowercase(Locale.US))
        }
    }

    private fun handlePreviewFrame(imageProxy: ImageProxy) {
        try {
            val sink = previewFrameSink
            if (previewStreamingEnabled.not() || sink == null) {
                return
            }

            val now = SystemClock.elapsedRealtime()
            val frameInterval =
                if (h264PreviewAvailable) {
                    LIVE_PREVIEW_H264_FRAME_INTERVAL_MS
                } else {
                    LIVE_PREVIEW_FRAME_INTERVAL_MS
                }
            if (now - lastPreviewFrameAtMs < frameInterval) {
                return
            }
            lastPreviewFrameAtMs = now

            if (h264PreviewAvailable) {
                runCatching {
                    h264PreviewEncoder.encode(imageProxy, now).forEach { frame ->
                        sink(frame)
                    }
                }.onFailure { error ->
                    h264PreviewAvailable = false
                    h264PreviewEncoder.reset()
                    CompanionDiagnostics.w(
                        "camera",
                        "H.264 live preview failed; falling back to JPEG frames.",
                        throwable = error,
                    )
                }.onSuccess {
                    return
                }
            }

            val bytes = imageProxy.toJpegBytes(LIVE_PREVIEW_JPEG_QUALITY)
            sink(
                CameraPreviewFrame(
                    bytes = bytes,
                    width = imageProxy.width,
                    height = imageProxy.height,
                    timestampMs = now,
                )
            )
        } catch (error: Exception) {
            CompanionDiagnostics.w("camera", "Live preview frame encoding failed.", throwable = error)
        } finally {
            imageProxy.close()
        }
    }

    private fun ImageProxy.toJpegBytes(quality: Int): ByteArray {
        val nv21 = toNv21()
        val output = ByteArrayOutputStream()
        YuvImage(nv21, ImageFormat.NV21, width, height, null).compressToJpeg(
            Rect(0, 0, width, height),
            quality,
            output,
        )
        return output.toByteArray()
    }

    private fun ImageProxy.toNv21(): ByteArray {
        val yPlane = planes[0]
        val uPlane = planes[1]
        val vPlane = planes[2]
        val nv21 = ByteArray(width * height * 3 / 2)
        var outputOffset = 0

        outputOffset =
            copyPlaneToArray(
                buffer = yPlane.buffer,
                rowStride = yPlane.rowStride,
                pixelStride = yPlane.pixelStride,
                width = width,
                height = height,
                output = nv21,
                outputOffset = outputOffset,
                interleaveWith = null,
            )

        copyPlaneToArray(
            buffer = vPlane.buffer,
            rowStride = vPlane.rowStride,
            pixelStride = vPlane.pixelStride,
            width = width / 2,
            height = height / 2,
            output = nv21,
            outputOffset = outputOffset,
            interleaveWith =
                PlaneInterleave(
                    buffer = uPlane.buffer,
                    rowStride = uPlane.rowStride,
                    pixelStride = uPlane.pixelStride,
                ),
        )
        return nv21
    }

    private fun copyPlaneToArray(
        buffer: ByteBuffer,
        rowStride: Int,
        pixelStride: Int,
        width: Int,
        height: Int,
        output: ByteArray,
        outputOffset: Int,
        interleaveWith: PlaneInterleave?,
    ): Int {
        var offset = outputOffset
        for (row in 0 until height) {
            val rowOffset = row * rowStride
            for (column in 0 until width) {
                output[offset] = buffer.get(rowOffset + column * pixelStride)
                offset += 1
                if (interleaveWith != null) {
                    output[offset] =
                        interleaveWith.buffer.get(
                            row * interleaveWith.rowStride + column * interleaveWith.pixelStride
                        )
                    offset += 1
                }
            }
        }
        return offset
    }

    private data class PlaneInterleave(
        val buffer: ByteBuffer,
        val rowStride: Int,
        val pixelStride: Int,
    )
}
