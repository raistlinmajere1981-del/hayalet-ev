package com.hayaletev.gaiaclient.transport

import android.content.Context
import com.hayaletev.gaiaclient.hardware.SystemMonoClock
import com.hayaletev.gaiaclient.pairing.pairingStore

object TransportProvider {
    fun create(context: Context): TransportAdapter =
        FieldTransport(pairingStore(context).active(), SystemMonoClock, androidHostLookup(context.applicationContext))
}
