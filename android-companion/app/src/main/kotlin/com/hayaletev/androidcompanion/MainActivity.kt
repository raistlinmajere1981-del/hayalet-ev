package com.hayaletev.androidcompanion

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.hayaletev.androidcompanion.capture.CameraSessionController
import com.hayaletev.androidcompanion.capture.CaptureForegroundService
import com.hayaletev.androidcompanion.databinding.ActivityMainBinding
import com.hayaletev.androidcompanion.model.CompanionManifest
import com.hayaletev.androidcompanion.session.CompanionSessionCoordinator
import com.hayaletev.androidcompanion.session.CompanionUiState
import com.hayaletev.androidcompanion.transport.DesktopBridgeClient
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var cameraController: CameraSessionController
    private lateinit var sessionCoordinator: CompanionSessionCoordinator
    private lateinit var manifest: CompanionManifest

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            updatePermissionsUi()
            if (hasCapturePermissions()) {
                startPreviewAndSessionLoop()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        manifest = CompanionManifest.load(this)
        cameraController = CameraSessionController(this, binding.cameraPreview)
        val bridgeClient = DesktopBridgeClient(manifest)
        sessionCoordinator = CompanionSessionCoordinator(
            appContext = applicationContext,
            scope = lifecycleScope,
            manifest = manifest,
            bridgeClient = bridgeClient,
            cameraController = cameraController,
            onUiState = ::renderUiState
        )

        binding.previewValue.text = getString(R.string.preview_on_phone)
        renderUiState(
            CompanionUiState(
                connectionStatus = getString(R.string.status_waiting_desktop),
                target = getString(R.string.target_waiting),
                permissionsSummary = getString(R.string.permissions_missing)
            )
        )

        ContextCompat.startForegroundService(
            this,
            Intent(this, CaptureForegroundService::class.java)
        )

        sessionCoordinator.updateLaunchContext(intent)
        requestPermissionsIfNeeded()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        sessionCoordinator.updateLaunchContext(intent)
        updatePermissionsUi()
        if (hasCapturePermissions()) {
            startPreviewAndSessionLoop()
        }
    }

    override fun onStart() {
        super.onStart()
        updatePermissionsUi()
        if (hasCapturePermissions()) {
            startPreviewAndSessionLoop()
        }
    }

    override fun onStop() {
        sessionCoordinator.stop()
        super.onStop()
    }

    override fun onDestroy() {
        sessionCoordinator.destroy()
        super.onDestroy()
    }

    private fun requestPermissionsIfNeeded() {
        if (hasCapturePermissions()) {
            startPreviewAndSessionLoop()
            return
        }

        val permissions = buildList {
            add(Manifest.permission.CAMERA)
            add(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        permissionLauncher.launch(permissions.toTypedArray())
    }

    private fun startPreviewAndSessionLoop() {
        sessionCoordinator.start(::hasCapturePermissions)
        lifecycleScope.launch {
            updatePermissionsUi()
        }
    }

    private fun hasCapturePermissions(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
    }

    private fun updatePermissionsUi() {
        binding.permissionsValue.text =
            if (hasCapturePermissions()) {
                getString(R.string.permissions_ready)
            } else {
                getString(R.string.permissions_missing)
            }
    }

    private fun renderUiState(state: CompanionUiState) {
        binding.statusValue.text = state.connectionStatus
        binding.targetValue.text = state.target
        binding.permissionsValue.text = state.permissionsSummary
    }
}
