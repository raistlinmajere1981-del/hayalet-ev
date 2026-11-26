package com.hayaletev.gaiaclient.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.hayaletev.gaiaclient.R
import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.CollectionEngine
import com.hayaletev.gaiaclient.core.CoroutineSleeper
import com.hayaletev.gaiaclient.core.EngineEvents
import com.hayaletev.gaiaclient.core.EngineState
import com.hayaletev.gaiaclient.core.FullJitterBackoff
import com.hayaletev.gaiaclient.core.SnapshotFactory
import com.hayaletev.gaiaclient.hardware.HardwareSnapshotSource
import com.hayaletev.gaiaclient.hardware.SystemMonoClock
import com.hayaletev.gaiaclient.transport.TransportMode
import com.hayaletev.gaiaclient.transport.TransportProvider
import java.io.File
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

class GaiaClientService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArrayList<ClientListener>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val binder = ClientBinder(this)
    private val runGuard = RunGuard()

    private var engine: CollectionEngine? = null
    private var source: HardwareSnapshotSource? = null

    @Volatile
    private var state = ClientState()

    private var transportMode = TransportMode.LOCAL_TEST

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> if (!runGuard.isRunning()) startRun()
            ACTION_STOP -> requestStop(StopReason.USER)
        }
        return START_NOT_STICKY
    }

    /**
     * API 35 dataSync timeout uses the two-argument callback. The single-argument
     * overload remains for older foreground service types.
     */
    override fun onTimeout(startId: Int) {
        requestStop(StopReason.SYSTEM_TIMEOUT)
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        requestStop(StopReason.SYSTEM_TIMEOUT)
    }

    override fun onDestroy() {
        if (runGuard.isRunning()) {
            requestStop(StopReason.DESTROYED)
        } else {
            removeNotification()
        }
        scope.cancel()
        super.onDestroy()
    }

    fun state(): ClientState = state

    fun addListener(listener: ClientListener) {
        listeners.addIfAbsent(listener)
        handler.post { listener.onState(state) }
    }

    fun removeListener(listener: ClientListener) {
        listeners.remove(listener)
    }

    @Synchronized
    fun requestStop(reason: StopReason = StopReason.USER) {
        if (!runGuard.isRunning() && engine == null && source == null) {
            removeNotification()
            stopSelf()
            return
        }

        runGuard.stop()
        isRunning = false

        val currentEngine = engine
        engine = null
        currentEngine?.stop()

        val currentSource = source
        source = null
        currentSource?.dispose()

        removeNotification()
        publish(
            state.copy(
                running = false,
                stopReason = reason,
                error = null,
                accepted = emptyList(),
                sessionShortId = null,
                lastPacket = null
            )
        )
        stopSelf()
    }

    @Synchronized
    private fun startRun() {
        if (runGuard.isRunning()) return

        // A startForegroundService caller requires this within five seconds.
        // Identity failure removes the notification again below.
        startForeground(
            NOTIFICATION_ID,
            buildNotification(getString(R.string.notification_starting))
        )

        val identity = try {
            InstallationStore(File(noBackupFilesDir, INSTALLATION_DIR)).getOrCreate()
        } catch (failure: InstallationIdentityException) {
            failStart(ClientError.IDENTITY_UNAVAILABLE)
            return
        }

        val generation = runGuard.start()
        isRunning = true

        try {
            val newSource = HardwareSnapshotSource(applicationContext, SystemMonoClock)
            val transport = TransportProvider.create(applicationContext)
            transportMode = transport.mode
            val runId = UUID.randomUUID().toString()
            val newEngine = CollectionEngine(
                scope = scope,
                transport = transport,
                store = newSource.memory,
                snapshotFactory = SnapshotFactory(SystemMonoClock),
                clock = SystemMonoClock,
                sleeper = CoroutineSleeper,
                backoff = FullJitterBackoff(),
                events = eventsFor(generation, newSource),
                installationId = identity,
                runId = runId,
                offered = newSource.found
            )

            source = newSource
            engine = newEngine

            newSource.start()
            publish(
                ClientState(
                    running = true,
                    transportMode = transportMode,
                    found = newSource.found
                )
            )
            startForeground(
                NOTIFICATION_ID,
                buildNotification(getString(R.string.notification_running))
            )
            newEngine.start()
        } catch (failure: Exception) {
            failStart(ClientError.START_FAILED)
        }
    }

    @Synchronized
    private fun failStart(error: ClientError) {
        runGuard.stop()
        isRunning = false

        val currentEngine = engine
        engine = null
        currentEngine?.stop()

        val currentSource = source
        source = null
        currentSource?.dispose()

        removeNotification()
        publish(ClientState(running = false, error = error))
        stopSelf()
    }

    private fun eventsFor(generation: Long, runSource: HardwareSnapshotSource): EngineEvents =
        object : EngineEvents {
            override fun onSessionOpened(
                sessionId: String,
                accepted: List<CapabilityId>,
                floorMonoMs: Long
            ) {
                if (!runGuard.isCurrent(generation)) return
                runSource.onSessionOpened(accepted, floorMonoMs)
            }

            override fun onSessionClosed() {
                if (!runGuard.isCurrent(generation)) return
                runSource.onSessionClosed()
            }

            override fun onBeforeSnapshot() {
                if (!runGuard.isCurrent(generation)) return
                runSource.refreshNetwork()
            }

            override fun onResubscribe(ids: Set<CapabilityId>) {
                if (!runGuard.isCurrent(generation)) return
                runSource.resubscribe(ids)
            }

            override fun onState(state: EngineState) {
                publishFromRun(
                    generation,
                    ClientState(
                        running = true,
                        transportMode = transportMode,
                        found = runSource.found,
                        accepted = state.accepted,
                        sessionShortId = state.sessionId?.take(8),
                        tickCount = state.tickCount,
                        lastOutcome = state.lastOutcome,
                        lastPacket = state.lastPacket
                    )
                )
            }
        }

    /**
     * The generation is checked again at delivery time. A callback that passed
     * the check just before Stop must not put the old run back on screen after
     * the stopped state has already been posted.
     */
    private fun publishFromRun(generation: Long, next: ClientState) {
        synchronized(this) {
            if (!runGuard.isCurrent(generation)) return
            state = next
            lastPublishedState = next
        }
        handler.post {
            val deliver = synchronized(this) { runGuard.isCurrent(generation) }
            if (!deliver) return@post
            for (listener in listeners) listener.onState(next)
        }
    }

    private fun publish(next: ClientState) {
        synchronized(this) {
            state = next
            lastPublishedState = next
        }
        handler.post {
            for (listener in listeners) listener.onState(next)
        }
    }

    private fun removeNotification() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.cancel(NOTIFICATION_ID)
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun createChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notification_channel_description)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        val stop = PendingIntent.getService(
            this,
            1,
            stopIntent(this),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val action = Notification.Action.Builder(
            Icon.createWithResource(this, R.drawable.ic_notification),
            getString(R.string.notification_stop),
            stop
        ).build()
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(action)
            .build()
    }

    companion object {
        const val ACTION_START = "com.hayaletev.gaiaclient.action.START"
        const val ACTION_STOP = "com.hayaletev.gaiaclient.action.STOP"

        private const val CHANNEL_ID = "gaia-client-collection"
        private const val NOTIFICATION_ID = 1001
        private const val INSTALLATION_DIR = "gaia-client"

        @Volatile
        var isRunning: Boolean = false
            private set

        @Volatile
        private var lastPublishedState = ClientState()

        /**
         * The Activity can read the final state even when the service already
         * stopped itself after an identity failure and cannot be bound.
         */
        fun lastState(): ClientState = lastPublishedState

        fun startIntent(context: Context): Intent =
            Intent(context, GaiaClientService::class.java).setAction(ACTION_START)

        fun stopIntent(context: Context): Intent =
            Intent(context, GaiaClientService::class.java).setAction(ACTION_STOP)
    }
}
