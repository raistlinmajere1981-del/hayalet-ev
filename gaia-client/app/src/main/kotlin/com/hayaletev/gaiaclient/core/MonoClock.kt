package com.hayaletev.gaiaclient.core

interface MonoClock {
    fun elapsedRealtimeMs(): Long
    fun wallTimeMs(): Long
}
