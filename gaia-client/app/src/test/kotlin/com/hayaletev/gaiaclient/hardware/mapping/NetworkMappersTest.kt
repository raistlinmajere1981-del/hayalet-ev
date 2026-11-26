package com.hayaletev.gaiaclient.hardware.mapping

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.NetworkTransport
import com.hayaletev.gaiaclient.core.Quality
import com.hayaletev.gaiaclient.core.SampleValue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NetworkMappersTest {
    @Test
    fun noActiveNetworkIsAValidOfflineObservation() {
        val sample = NetworkMapper.map(NetworkRead.None(monoMs = 7_000))

        assertEquals(Quality.VALID, sample.quality)
        assertEquals(7_000L, sample.sampleMonoMs)
        assertEquals(
            SampleValue.Network(NetworkTransport.NONE, internetCapable = false, validated = false),
            sample.value
        )
    }

    @Test
    fun availableNetworkKeepsFalseCapabilityBits() {
        val sample = NetworkMapper.map(
            NetworkRead.Available(
                transports = setOf(NetworkTransport.WIFI),
                internetCapable = false,
                validated = false,
                monoMs = 8_000
            )
        )

        assertEquals(Quality.VALID, sample.quality)
        assertEquals(8_000L, sample.sampleMonoMs)
        assertEquals(
            SampleValue.Network(NetworkTransport.WIFI, internetCapable = false, validated = false),
            sample.value
        )
    }

    @Test
    fun transportPrecedenceIsWifiThenCellularThenOther() {
        fun transportOf(transports: Set<NetworkTransport>): NetworkTransport =
            (
                NetworkMapper.map(
                    NetworkRead.Available(
                        transports = transports,
                        internetCapable = true,
                        validated = true,
                        monoMs = 1_000
                    )
                ).value as SampleValue.Network
                ).transport

        assertEquals(
            NetworkTransport.WIFI,
            transportOf(
                setOf(NetworkTransport.OTHER, NetworkTransport.CELLULAR, NetworkTransport.WIFI)
            )
        )
        assertEquals(
            NetworkTransport.CELLULAR,
            transportOf(setOf(NetworkTransport.OTHER, NetworkTransport.CELLULAR))
        )
        assertEquals(
            NetworkTransport.OTHER,
            transportOf(setOf(NetworkTransport.OTHER))
        )
        assertEquals(NetworkTransport.OTHER, transportOf(emptySet()))
    }

    @Test
    fun failedNetworkReadIsInvalidAtTheReadTime() {
        val sample = NetworkMapper.map(NetworkRead.Failed(monoMs = 9_000))

        assertEquals(Quality.INVALID, sample.quality)
        assertEquals(9_000L, sample.sampleMonoMs)
        assertNull(sample.value)
    }

    @Test
    fun connectedWifiRssiBoundariesAreValid() {
        for (rssi in listOf(-126, -67, 0)) {
            val sample = RssiMapper.map(
                RssiReading(
                    rssi = rssi,
                    wifiEnabled = true,
                    connected = true,
                    receiptMonoMs = 4_000
                )
            )
            assertEquals(Quality.VALID, sample.quality)
            assertEquals(4_000L, sample.sampleMonoMs)
            assertEquals(SampleValue.Integer(rssi.toLong()), sample.value)
        }
    }

    @Test
    fun unknownSentinelNullDisabledAndDisconnectedAreMissing() {
        val readings = listOf(
            RssiReading(-127, wifiEnabled = true, connected = true, receiptMonoMs = 4_000),
            RssiReading(null, wifiEnabled = true, connected = true, receiptMonoMs = 4_000),
            RssiReading(-67, wifiEnabled = false, connected = true, receiptMonoMs = 4_000),
            RssiReading(-67, wifiEnabled = true, connected = false, receiptMonoMs = 4_000)
        )

        for (reading in readings) {
            val sample = RssiMapper.map(reading)
            assertEquals(Quality.MISSING, sample.quality)
            assertNull(sample.sampleMonoMs)
            assertNull(sample.value)
        }
    }

    @Test
    fun outOfRangeDeliveredRssiIsInvalidAtReceiptTime() {
        for (rssi in listOf(1, -128, -130)) {
            val sample = RssiMapper.map(
                RssiReading(
                    rssi = rssi,
                    wifiEnabled = true,
                    connected = true,
                    receiptMonoMs = 4_000
                )
            )
            assertEquals(Quality.INVALID, sample.quality)
            assertEquals(4_000L, sample.sampleMonoMs)
            assertNull(sample.value)
        }
    }

    @Test
    fun rssiSampleUsesTheCapabilityId() {
        val sample = RssiMapper.map(
            RssiReading(-67, wifiEnabled = true, connected = true, receiptMonoMs = 4_000)
        )
        assertEquals(CapabilityId.SIGNAL, sample.id)
    }
}
