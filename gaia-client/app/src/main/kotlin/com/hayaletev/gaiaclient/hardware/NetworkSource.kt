package com.hayaletev.gaiaclient.hardware

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.MonoClock
import com.hayaletev.gaiaclient.core.NetworkTransport
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleMemory
import com.hayaletev.gaiaclient.hardware.mapping.NetworkMapper
import com.hayaletev.gaiaclient.hardware.mapping.NetworkRead
import com.hayaletev.gaiaclient.hardware.mapping.RssiMapper
import com.hayaletev.gaiaclient.hardware.mapping.RssiReading

class NetworkSource(
    context: Context,
    private val clock: MonoClock,
    private val memory: SampleMemory
) {
    private val appContext = context.applicationContext
    private val connectivity =
        appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    private val wifi = appContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager

    private var registered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                WifiManager.RSSI_CHANGED_ACTION -> onRssiChanged(intent)
                WifiManager.NETWORK_STATE_CHANGED_ACTION -> onWifiNetworkChanged()
            }
        }
    }

    fun hasWifi(): Boolean = wifi != null

    fun start() {
        if (registered) return
        val filter = IntentFilter().apply {
            addAction(WifiManager.RSSI_CHANGED_ACTION)
            addAction(WifiManager.NETWORK_STATE_CHANGED_ACTION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            appContext.registerReceiver(receiver, filter)
        }
        registered = true
    }

    fun stop() {
        if (!registered) return
        appContext.unregisterReceiver(receiver)
        registered = false
    }

    /** Queried right before every snapshot so the packet describes the network at send time. */
    fun refresh() {
        val now = clock.elapsedRealtimeMs()
        val read = try {
            val active = connectivity?.activeNetwork
            if (active == null) {
                NetworkRead.None(now)
            } else {
                val capabilities = connectivity.getNetworkCapabilities(active)
                if (capabilities == null) {
                    NetworkRead.Failed(now)
                } else {
                    NetworkRead.Available(
                        transports = transportsOf(capabilities),
                        internetCapable = capabilities.hasCapability(
                            NetworkCapabilities.NET_CAPABILITY_INTERNET
                        ),
                        validated = capabilities.hasCapability(
                            NetworkCapabilities.NET_CAPABILITY_VALIDATED
                        ),
                        monoMs = now
                    )
                }
            }
        } catch (failure: Exception) {
            NetworkRead.Failed(now)
        }
        memory.offer(NetworkMapper.map(read))
    }

    fun resetSignal() {
        memory.offer(Sample.missing(CapabilityId.SIGNAL))
    }

    @Suppress("DEPRECATION")
    private fun onRssiChanged(intent: Intent) {
        val now = clock.elapsedRealtimeMs()
        val info = runCatching { wifi?.connectionInfo }.getOrNull()
        val extraRssi = if (intent.hasExtra(WifiManager.EXTRA_NEW_RSSI)) {
            intent.getIntExtra(WifiManager.EXTRA_NEW_RSSI, -127)
        } else {
            null
        }
        // A notification without its own reading does not date the cached RSSI.
        val rssi = extraRssi
        memory.offer(
            RssiMapper.map(
                RssiReading(
                    rssi = rssi,
                    wifiEnabled = wifi?.isWifiEnabled == true,
                    connected = info != null && info.networkId != -1,
                    receiptMonoMs = now
                )
            )
        )
    }

    @Suppress("DEPRECATION")
    private fun onWifiNetworkChanged() {
        val info = runCatching { wifi?.connectionInfo }.getOrNull()
        val connected = wifi?.isWifiEnabled == true && info != null && info.networkId != -1
        if (!connected) {
            memory.offer(Sample.missing(CapabilityId.SIGNAL))
        }
        // A connect notification carries a cached RSSI; only RSSI_CHANGED_ACTION
        // proves a fresh reading, so this path never re-dates the cache.
    }

    private fun transportsOf(capabilities: NetworkCapabilities): Set<NetworkTransport> {
        val transports = LinkedHashSet<NetworkTransport>()
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
            transports += NetworkTransport.WIFI
        }
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
            transports += NetworkTransport.CELLULAR
        }
        if (
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ||
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) ||
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        ) {
            transports += NetworkTransport.OTHER
        }
        return transports
    }
}
