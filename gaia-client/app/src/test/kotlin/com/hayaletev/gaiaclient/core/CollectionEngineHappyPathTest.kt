package com.hayaletev.gaiaclient.core

import com.hayaletev.gaiaclient.support.FixedClock
import com.hayaletev.gaiaclient.support.ManualSleeper
import com.hayaletev.gaiaclient.support.RecordingEngineEvents
import com.hayaletev.gaiaclient.support.RecordingSampleStore
import com.hayaletev.gaiaclient.support.ScriptedTransport
import com.hayaletev.gaiaclient.transport.OpenResult
import com.hayaletev.gaiaclient.transport.SendResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Collections
import kotlin.random.Random

class CollectionEngineHappyPathTest {
    @Test
    fun opensSendsAndWaitsForTheInterval() = runBlocking {
        val log = Collections.synchronizedList(mutableListOf<String>())
        val clock = FixedClock()
        val transport = ScriptedTransport { log += it }
        val store = RecordingSampleStore { log += it }
        val events = RecordingEngineEvents { log += it }
        val sleeper = ManualSleeper()
        val engineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val engine = CollectionEngine(
            scope = engineScope,
            transport = transport,
            store = store,
            snapshotFactory = SnapshotFactory(clock),
            clock = clock,
            sleeper = sleeper,
            backoff = FullJitterBackoff(Random(0)),
            events = events,
            installationId = "installation-1",
            runId = "run-1",
            offered = listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL)
        )
        store.snapshotMap = mapOf(
            CapabilityId.BATTERY_LEVEL to Sample.valid(
                CapabilityId.BATTERY_LEVEL,
                SampleValue.Integer(83),
                1_000
            ),
            CapabilityId.SIGNAL to Sample.valid(
                CapabilityId.SIGNAL,
                SampleValue.Integer(-67),
                1_000
            )
        )

        try {
            engine.start()

            val context = withTimeout(5_000) { transport.nextOpenContext() }
            assertEquals("installation-1", context.installationId)
            assertEquals("run-1", context.runId)
            assertEquals(
                listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                context.offered
            )

            transport.respondOpen(
                OpenResult.Opened(
                    sessionId = "session-1",
                    accepted = listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                    intervalMs = 10_000
                )
            )

            val opened = withTimeout(5_000) { events.awaitOpened() }
            assertEquals("session-1", opened.sessionId)
            assertEquals(
                listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                opened.accepted
            )
            assertEquals(5_000L, opened.floorMonoMs)

            val begin = store.beginCallsCopy().single()
            assertEquals(
                setOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                begin.accepted
            )
            assertEquals(5_000L, begin.floorMonoMs)

            withTimeout(5_000) { events.awaitBeforeSnapshot() }
            val first = withTimeout(5_000) { transport.nextSend() }
            assertEquals(1L, first.seq)
            assertEquals("session-1", first.sessionId)
            assertEquals(5_000L, first.sentMonoMs)
            assertEquals(1_700_000_000_000L, first.deviceWallMs)
            assertEquals(
                listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                first.samples.map { it.id }
            )
            assertEquals(SampleValue.Integer(83), first.samples[0].value)
            assertEquals(SampleValue.Integer(-67), first.samples[1].value)
            assertNull(transport.tryNextSend())

            assertTrue(log.indexOf("beforeSnapshot") >= 0)
            assertTrue(log.indexOf("beforeSnapshot") < log.indexOf("snapshot"))
            assertTrue(log.indexOf("snapshot") < log.indexOf("send"))

            transport.respondSend(SendResult.Accepted("session-1", 1))
            assertEquals(10_000L, withTimeout(5_000) { sleeper.nextDelay() })

            val waiting = withTimeout(5_000) {
                events.awaitState { it.phase == EnginePhase.WAITING && it.tickCount == 1L }
            }
            assertEquals(SendOutcome.ACCEPTED, waiting.lastOutcome)
            assertEquals(first, waiting.lastPacket)
            assertEquals(listOf(first), store.sentPacketsCopy())

            sleeper.releaseNext()
            val second = withTimeout(5_000) { transport.nextSend() }
            assertEquals(2L, second.seq)
            assertEquals("session-1", second.sessionId)
            assertEquals(5_000L, second.sentMonoMs)

            engine.stop()?.join()
            val stopped = engine.state()
            assertEquals(EnginePhase.STOPPED, stopped.phase)
            assertNull(stopped.sessionId)
            assertTrue(stopped.accepted.isEmpty())
            assertNull(stopped.lastPacket)
            assertTrue(transport.closeCount.get() >= 1)
            assertTrue(store.endCount() >= 1)
            assertTrue(events.closedCount() >= 1)
        } finally {
            engine.stop()?.join()
            engineScope.cancel()
        }
    }
}
