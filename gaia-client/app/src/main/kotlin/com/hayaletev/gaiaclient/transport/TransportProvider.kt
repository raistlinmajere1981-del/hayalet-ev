package com.hayaletev.gaiaclient.transport

import android.content.Context

/**
 * B6 replaces this composition point with the mTLS adapter. B5 never opens a
 * socket or claims a central delivery.
 */
object TransportProvider {
    fun create(context: Context): TransportAdapter {
        context.applicationContext
        return FakeTransportAdapter()
    }
}
