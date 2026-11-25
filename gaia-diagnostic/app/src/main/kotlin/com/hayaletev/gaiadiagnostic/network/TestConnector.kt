package com.hayaletev.gaiadiagnostic.network

import android.os.SystemClock
import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.Socket
import java.net.SocketTimeoutException

/**
 * Sends a JSON observation to the temporary test receiver on 127.0.0.1:<port>.
 * This is NOT a production transport — it is an ADB-reverse-tunnelled loopback
 * used only for the feasibility experiment.
 *
 * Uses blocking I/O on a background thread (caller's responsibility).
 * Returns null on success with the server's response string.
 * Returns an error message on failure.
 *
 * NOTE: J701F system clock may be wrong; we include both wall time and
 * monotonic time so the receiver can correlate with its own clock.
 */
class TestConnector(
    private val host: String = "127.0.0.1",
    private val port: Int = 7701
) {
    companion object {
        private const val TAG = "TestConnector"
        private const val CONNECT_TIMEOUT_MS = 3000
        private const val READ_TIMEOUT_MS = 5000
    }

    /**
     * Sends one JSON payload. Returns SendResult.
     */
    fun send(json: String): SendResult {
        val t0 = SystemClock.elapsedRealtime()
        return try {
            val socket = Socket()
            socket.connect(java.net.InetSocketAddress(host, port), CONNECT_TIMEOUT_MS)
            socket.soTimeout = READ_TIMEOUT_MS
            val writer = OutputStreamWriter(socket.getOutputStream(), Charsets.UTF_8)
            val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))
            writer.write(json + "\n")
            writer.flush()
            val response = try {
                reader.readLine() ?: ""
            } catch (e: SocketTimeoutException) {
                "(no response within ${READ_TIMEOUT_MS}ms)"
            }
            socket.close()
            val rttMs = SystemClock.elapsedRealtime() - t0
            Log.d(TAG, "sent OK rttMs=$rttMs resp=$response")
            SendResult.Ok(response = response, rttMs = rttMs)
        } catch (e: Exception) {
            Log.w(TAG, "send failed: ${e.message}")
            SendResult.Err(message = e.message ?: e.javaClass.simpleName)
        }
    }
}

sealed class SendResult {
    data class Ok(val response: String, val rttMs: Long) : SendResult()
    data class Err(val message: String) : SendResult()
}
