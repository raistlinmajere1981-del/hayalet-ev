package com.hayaletev.gaiaclient.transport

import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Binder
import android.os.IBinder
import android.os.Parcel
import android.os.Process
import java.io.IOException
import java.net.InetAddress
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

// API 28's system getaddrinfo has no cancellation handle. Its private bound process
// can be released even while netd is stalled, preserving the device's resolver policy.
class FieldResolverService : Service() {
    private val binder =
        object : Binder() {
            override fun onTransact(code: Int, data: Parcel, reply: Parcel?, flags: Int): Boolean {
                if (code != IBinder.FIRST_CALL_TRANSACTION)
                    return super.onTransact(code, data, reply, flags)
                val host = requireNotNull(data.readString())
                val callback = requireNotNull(data.readStrongBinder())
                val answer = Parcel.obtain()
                try {
                    val address = runCatching { InetAddress.getByName(host).address }.getOrNull()
                    answer.writeByteArray(address)
                    callback.transact(code, answer, null, IBinder.FLAG_ONEWAY)
                } finally {
                    answer.recycle()
                }
                return true
            }
        }

    override fun onBind(intent: Intent) = binder

    override fun onDestroy() {
        super.onDestroy()
        Process.killProcess(Process.myPid())
    }
}

internal fun androidHostLookup(context: Context): HostLookup = HostLookup { host, cancelled ->
    if (':' in host || host.matches(Regex("[0-9.]+"))) {
        return@HostLookup InetAddress.getByName(host)
    }
    val result = CompletableFuture<InetAddress>()
    val callback =
        object : Binder() {
            override fun onTransact(code: Int, data: Parcel, reply: Parcel?, flags: Int): Boolean {
                if (code != IBinder.FIRST_CALL_TRANSACTION)
                    return super.onTransact(code, data, reply, flags)
                val bytes = data.createByteArray()
                if (bytes == null) result.completeExceptionally(IOException("Name lookup failed"))
                else result.complete(InetAddress.getByAddress(bytes))
                return true
            }
        }
    val connection =
        object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName, binder: IBinder) {
                val request = Parcel.obtain()
                try {
                    request.writeString(host)
                    request.writeStrongBinder(callback)
                    if (
                        !binder.transact(
                            IBinder.FIRST_CALL_TRANSACTION,
                            request,
                            null,
                            IBinder.FLAG_ONEWAY,
                        )
                    )
                        throw IOException("Resolver unavailable")
                } catch (e: Exception) {
                    result.completeExceptionally(e)
                } finally {
                    request.recycle()
                }
            }

            override fun onServiceDisconnected(name: ComponentName) {
                result.completeExceptionally(IOException("Resolver disconnected"))
            }
        }
    if (
        !context.bindService(
            Intent(context, FieldResolverService::class.java),
            connection,
            Context.BIND_AUTO_CREATE,
        )
    )
        throw IOException("Cannot bind resolver")
    try {
        while (!cancelled()) {
            try {
                return@HostLookup result.get(50, TimeUnit.MILLISECONDS)
            } catch (_: TimeoutException) {}
        }
        throw IOException("Lookup cancelled")
    } finally {
        context.unbindService(connection)
    }
}
