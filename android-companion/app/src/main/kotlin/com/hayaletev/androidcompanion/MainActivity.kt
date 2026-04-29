package com.hayaletev.androidcompanion

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import com.hayaletev.androidcompanion.capture.CameraSessionController
import com.hayaletev.androidcompanion.capture.CaptureForegroundService
import com.hayaletev.androidcompanion.databinding.ActivityMainBinding
import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import com.hayaletev.androidcompanion.debug.CompanionDiagnosticsListener
import com.hayaletev.androidcompanion.debug.CompanionDiagnosticsSnapshot
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
    private val diagnosticsListener =
        CompanionDiagnosticsListener { snapshot ->
            runOnUiThread {
                if (isDestroyed.not()) {
                    renderDiagnostics(snapshot)
                }
            }
        }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            CompanionDiagnostics.i(
                "permissions",
                "Permission result received.",
                grants.entries.joinToString(", ") { "${it.key}=${it.value}" },
            )
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
        CompanionDiagnostics.addListener(diagnosticsListener)
        CompanionDiagnostics.setState("App", "${manifest.versionName} (${manifest.versionCode})")
        CompanionDiagnostics.setState("Bridge endpoint", "127.0.0.1:${manifest.bridgePort}")
        CompanionDiagnostics.i("lifecycle", "MainActivity created.", describeIntent(intent))

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
        configureDiagnosticsPanel()

        binding.previewValue.text = getString(R.string.preview_on_phone)
        renderUiState(
            CompanionUiState(
                connectionStatus = getString(R.string.status_waiting_desktop),
                target = getString(R.string.target_waiting),
                permissionsSummary = getString(R.string.permissions_missing)
            )
        )
        renderPreviewState()

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
        CompanionDiagnostics.i("intent", "Activity received a new launch intent.", describeIntent(intent))
        sessionCoordinator.updateLaunchContext(intent)
        updatePermissionsUi()
        if (hasCapturePermissions()) {
            startPreviewAndSessionLoop()
        }
    }

    override fun onStart() {
        super.onStart()
        CompanionDiagnostics.i("lifecycle", "MainActivity started.")
        updatePermissionsUi()
        if (hasCapturePermissions()) {
            startPreviewAndSessionLoop()
        }
    }

    override fun onStop() {
        CompanionDiagnostics.i("lifecycle", "MainActivity stopped.")
        sessionCoordinator.stop()
        super.onStop()
    }

    override fun onDestroy() {
        CompanionDiagnostics.i("lifecycle", "MainActivity destroyed.")
        CompanionDiagnostics.removeListener(diagnosticsListener)
        sessionCoordinator.destroy()
        super.onDestroy()
    }

    private fun requestPermissionsIfNeeded() {
        if (hasCapturePermissions()) {
            CompanionDiagnostics.i("permissions", "Capture permissions are already granted.")
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
        CompanionDiagnostics.i(
            "permissions",
            "Requesting capture permissions.",
            permissions.joinToString(", "),
        )
        permissionLauncher.launch(permissions.toTypedArray())
    }

    private fun startPreviewAndSessionLoop() {
        CompanionDiagnostics.i("session", "Requesting preview/session loop start.")
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
        val permissionsText =
            if (hasCapturePermissions()) {
                getString(R.string.permissions_ready)
            } else {
                getString(R.string.permissions_missing)
            }
        binding.permissionsValue.text = permissionsText
        CompanionDiagnostics.setState("Permissions", permissionsText)
        renderPreviewState()
    }

    private fun renderUiState(state: CompanionUiState) {
        binding.statusValue.text = state.connectionStatus
        binding.targetValue.text = state.target
        binding.permissionsValue.text = state.permissionsSummary
        CompanionDiagnostics.setState("Connection", state.connectionStatus)
        CompanionDiagnostics.setState("Target", state.target)
        CompanionDiagnostics.setState("Permissions", state.permissionsSummary)
        renderPreviewState()
    }

    private fun renderPreviewState() {
        val previewBound = cameraController.isPreviewBound()
        binding.previewPlaceholder.isVisible = previewBound.not()
        CompanionDiagnostics.setState(
            "Preview",
            if (previewBound) {
                "Active on this phone"
            } else {
                "Waiting for desktop command"
            },
        )
    }

    private fun configureDiagnosticsPanel() {
        binding.diagnosticsCopyButton.setOnClickListener {
            copyDiagnosticsToClipboard()
        }
        binding.diagnosticsShareButton.setOnClickListener {
            shareDiagnostics()
        }
        binding.diagnosticsClearButton.setOnClickListener {
            CompanionDiagnostics.clearLogs()
            CompanionDiagnostics.i("ui", "Diagnostics log cleared by user.")
        }
    }

    private fun renderDiagnostics(snapshot: CompanionDiagnosticsSnapshot) {
        binding.diagnosticsSummaryValue.text =
            if (snapshot.stateEntries.isEmpty()) {
                getString(R.string.diagnostics_summary_empty)
            } else {
                snapshot.stateEntries.joinToString("\n") { (key, value) -> "$key: $value" }
            }
        binding.diagnosticsLogsValue.text =
            if (snapshot.logEntries.isEmpty()) {
                getString(R.string.diagnostics_logs_empty)
            } else {
                snapshot.logEntries
                    .takeLast(160)
                    .asReversed()
                    .joinToString("\n\n", transform = CompanionDiagnostics::formatEntry)
            }
    }

    private fun copyDiagnosticsToClipboard() {
        val clipboard = getSystemService(ClipboardManager::class.java)
        val export = CompanionDiagnostics.buildShareText()
        clipboard?.setPrimaryClip(
            ClipData.newPlainText(getString(R.string.diagnostics_clipboard_label), export),
        )
        CompanionDiagnostics.i("ui", "Diagnostics copied to clipboard.")
        Toast.makeText(this, getString(R.string.diagnostics_copy_success), Toast.LENGTH_SHORT).show()
    }

    private fun shareDiagnostics() {
        CompanionDiagnostics.i("ui", "Sharing diagnostics.")
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, getString(R.string.diagnostics_clipboard_label))
                    putExtra(Intent.EXTRA_TEXT, CompanionDiagnostics.buildShareText())
                },
                getString(R.string.diagnostics_share_title),
            ),
        )
    }

    private fun describeIntent(intent: Intent?): String? {
        if (intent == null) {
            return null
        }

        val summary =
            buildList {
                intent.getStringExtra("deviceId")?.takeIf { it.isNotBlank() }?.let {
                    add("deviceId=$it")
                }
                intent.getStringExtra("target")?.takeIf { it.isNotBlank() }?.let {
                    add("target=$it")
                }
                intent.getStringExtra("defaultLens")?.takeIf { it.isNotBlank() }?.let {
                    add("defaultLens=$it")
                }
                intent.getStringExtra("photoQuality")?.takeIf { it.isNotBlank() }?.let {
                    add("photoQuality=$it")
                }
            }
        return summary.joinToString(", ").ifBlank { null }
    }
}
