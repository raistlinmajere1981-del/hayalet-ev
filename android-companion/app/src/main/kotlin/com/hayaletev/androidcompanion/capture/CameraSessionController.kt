package com.hayaletev.androidcompanion.capture

import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

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

class CameraSessionController(
    private val activity: AppCompatActivity,
    private val previewView: PreviewView,
) {
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageCapture: ImageCapture? = null
    private var currentConfig: CameraSessionConfig? = null

    fun isPreviewBound(): Boolean = imageCapture != null

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
                        )

                        cameraProvider = resolvedProvider
                        imageCapture = nextImageCapture
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
        cameraProvider?.unbindAll()
        imageCapture = null
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
}
