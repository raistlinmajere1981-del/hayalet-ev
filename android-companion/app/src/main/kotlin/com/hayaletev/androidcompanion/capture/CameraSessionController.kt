package com.hayaletev.androidcompanion.capture

import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
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
            return
        }

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
                        continuation.resume(Unit)
                    } catch (error: Exception) {
                        continuation.resumeWithException(error)
                    }
                },
                ContextCompat.getMainExecutor(activity),
            )
        }
    }

    fun stopSession() {
        cameraProvider?.unbindAll()
        imageCapture = null
        currentConfig = null
    }

    suspend fun takePhoto(outputFile: File): File {
        val capture = imageCapture ?: throw IllegalStateException("Camera preview is not ready yet.")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()
        return suspendCancellableCoroutine { continuation ->
            capture.takePicture(
                outputOptions,
                ContextCompat.getMainExecutor(activity),
                object : ImageCapture.OnImageSavedCallback {
                    override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                        continuation.resume(outputFile)
                    }

                    override fun onError(exception: ImageCaptureException) {
                        continuation.resumeWithException(exception)
                    }
                },
            )
        }
    }
}
