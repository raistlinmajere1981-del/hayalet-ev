package com.hayaletev.gaiadiagnostic

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.IBinder
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.hayaletev.gaiadiagnostic.databinding.ActivityMainBinding
import com.hayaletev.gaiadiagnostic.service.DiagnosticService

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private var service: DiagnosticService? = null
    private var serviceBound = false

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            service = (binder as DiagnosticService.LocalBinder).getService()
            serviceBound = true
            updateUi()
        }

        override fun onServiceDisconnected(name: ComponentName) {
            service = null
            serviceBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnStartStop.setOnClickListener {
            if (DiagnosticService.isRunning) {
                stopDiagnosticService()
            } else {
                requestPermissionsAndStart()
            }
        }

        // Allow ADB to start/stop service: adb shell am start ... --ez start_service true
        if (intent?.getBooleanExtra("start_service", false) == true && !DiagnosticService.isRunning) {
            startDiagnosticService()
        }
        if (intent?.getBooleanExtra("stop_service", false) == true && DiagnosticService.isRunning) {
            stopDiagnosticService()
        }

        // Observe live readings via broadcast
        DiagnosticService.liveText.observe(this) { text ->
            binding.tvStatus.text = text ?: getString(R.string.status_idle)
        }

        updateUi()
    }

    override fun onStart() {
        super.onStart()
        if (DiagnosticService.isRunning) {
            bindToService()
        }
        updateUi()
    }

    override fun onStop() {
        super.onStop()
        if (serviceBound) {
            unbindService(connection)
            serviceBound = false
        }
    }

    private fun bindToService() {
        Intent(this, DiagnosticService::class.java).also { intent ->
            bindService(intent, connection, Context.BIND_AUTO_CREATE)
        }
    }

    private fun requestPermissionsAndStart() {
        val needed = mutableListOf<String>()
        val optional = listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        for (p in optional) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                needed.add(p)
            }
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), REQ_PERMISSIONS)
        } else {
            startDiagnosticService()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_PERMISSIONS) {
            // Start regardless; camera/mic availability is reported in diagnostics
            startDiagnosticService()
        }
    }

    private fun startDiagnosticService() {
        val intent = Intent(this, DiagnosticService::class.java)
        ContextCompat.startForegroundService(this, intent)
        bindToService()
        updateUi()
    }

    private fun stopDiagnosticService() {
        if (serviceBound) {
            unbindService(connection)
            serviceBound = false
        }
        service = null
        stopService(Intent(this, DiagnosticService::class.java))
        updateUi()
    }

    private fun updateUi() {
        val running = DiagnosticService.isRunning
        binding.btnStartStop.text = if (running) getString(R.string.stop) else getString(R.string.start)
        if (!running) {
            binding.tvStatus.text = getString(R.string.status_idle)
        }
    }

    companion object {
        private const val REQ_PERMISSIONS = 101
    }
}
