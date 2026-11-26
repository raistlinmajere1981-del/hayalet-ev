package com.hayaletev.gaiaclient.core

import kotlinx.coroutines.delay

fun interface Sleeper {
    suspend fun sleep(ms: Long)
}

object CoroutineSleeper : Sleeper {
    override suspend fun sleep(ms: Long) {
        delay(ms)
    }
}
