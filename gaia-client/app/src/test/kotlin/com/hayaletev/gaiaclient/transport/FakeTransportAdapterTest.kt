package com.hayaletev.gaiaclient.transport

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.ObservationPacket
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FakeTransportAdapterTest {
    private val context = SessionOpenContext(
        installationId = "11111111-1111-4111-8111-111111111111",
        runId = "22222222-2222-4222-8222-222222222222",
        offered = listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL)
    )

    private fun packet(sessionId: String, seq: Long = 1): ObservationPacket =
        ObservationPacket(
            sessionId = sessionId,
            seq = seq,
            sentMonoMs = 1_000,
            deviceWallMs = 1_700_000_000_000,
            samples = emptyList()
        )

    @Test
    fun openReturnsALowercaseUuidAndTheOfferedList() = runBlocking {
        val adapter = FakeTransportAdapter()
        val result = adapter.open(context)

        assertTrue(result is OpenResult.Opened)
        val opened = result as OpenResult.Opened
        assertTrue(
            Regex("^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
                .matches(opened.sessionId)
        )
        assertEquals(context.offered, opened.accepted)
        assertEquals(10_000L, opened.intervalMs)
        assertEquals(context, adapter.lastContext)
        assertEquals(TransportMode.LOCAL_TEST, adapter.mode)
    }

    @Test
    fun secondOpenDoesNotReplaceALiveSession() = runBlocking {
        val adapter = FakeTransportAdapter()
        val first = adapter.open(context) as OpenResult.Opened
        val second = adapter.open(context)

        assertTrue(second is OpenResult.Failed)
        assertEquals(first.sessionId, adapter.currentSessionId)
    }

    @Test
    fun sendRequiresTheCurrentSession() = runBlocking {
        val adapter = FakeTransportAdapter()
        assertTrue(adapter.send(packet("00000000-0000-4000-8000-000000000001")) is SendResult.SessionLost)

        val opened = adapter.open(context) as OpenResult.Opened
        val accepted = adapter.send(packet(opened.sessionId, 4))
        assertEquals(SendResult.Accepted(opened.sessionId, 4), accepted)
        assertEquals(4L, adapter.lastPacket?.seq)
        assertEquals(1, adapter.sentCount)

        assertTrue(adapter.send(packet("00000000-0000-4000-8000-000000000002")) is SendResult.SessionLost)
    }

    @Test
    fun closeIsIdempotentAndEndsTheSession() = runBlocking {
        val adapter = FakeTransportAdapter()
        val opened = adapter.open(context) as OpenResult.Opened
        adapter.close()
        adapter.close()

        assertNull(adapter.currentSessionId)
        assertTrue(adapter.send(packet(opened.sessionId)) is SendResult.SessionLost)
    }

    @Test
    fun adapterHasNoRemoteDeliveryState() = runBlocking {
        val adapter = FakeTransportAdapter()
        assertEquals(TransportMode.LOCAL_TEST, adapter.mode)
        val opened = adapter.open(context) as OpenResult.Opened
        adapter.send(packet(opened.sessionId))

        assertEquals(1, adapter.sentCount)
        assertEquals(opened.sessionId, adapter.lastPacket?.sessionId)
    }
}
