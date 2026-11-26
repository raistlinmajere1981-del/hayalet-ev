package com.hayaletev.gaiaclient.hardware.mapping

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.NetworkTransport
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleValue

sealed interface NetworkRead {
    data class None(val monoMs: Long) : NetworkRead

    data class Available(
        val transports: Set<NetworkTransport>,
        val internetCapable: Boolean,
        val validated: Boolean,
        val monoMs: Long
    ) : NetworkRead

    data class Failed(val monoMs: Long) : NetworkRead
}

object NetworkMapper {
    fun map(read: NetworkRead): Sample = when (read) {
        is NetworkRead.None -> Sample.valid(
            CapabilityId.NETWORK,
            SampleValue.Network(NetworkTransport.NONE, internetCapable = false, validated = false),
            read.monoMs
        )

        is NetworkRead.Available -> {
            val transport = when {
                NetworkTransport.WIFI in read.transports -> NetworkTransport.WIFI
                NetworkTransport.CELLULAR in read.transports -> NetworkTransport.CELLULAR
                else -> NetworkTransport.OTHER
            }
            Sample.valid(
                CapabilityId.NETWORK,
                SampleValue.Network(transport, read.internetCapable, read.validated),
                read.monoMs
            )
        }

        is NetworkRead.Failed -> Sample.invalid(CapabilityId.NETWORK, read.monoMs)
    }
}

data class RssiReading(
    val rssi: Int?,
    val wifiEnabled: Boolean,
    val connected: Boolean,
    val receiptMonoMs: Long
)

object RssiMapper {
    fun map(reading: RssiReading): Sample {
        val rssi = reading.rssi
        if (rssi == null || rssi == -127 || !reading.wifiEnabled || !reading.connected) {
            return Sample.missing(CapabilityId.SIGNAL)
        }
        if (rssi !in -126..0) {
            return Sample.invalid(CapabilityId.SIGNAL, reading.receiptMonoMs)
        }
        return Sample.valid(
            CapabilityId.SIGNAL,
            SampleValue.Integer(rssi.toLong()),
            reading.receiptMonoMs
        )
    }
}
