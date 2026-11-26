package com.hayaletev.gaiaclient.service

import java.lang.reflect.Modifier
import org.junit.Assert.assertTrue
import org.junit.Test

class GaiaClientServiceSignatureTest {
    @Test
    fun overridesTheApi35DataSyncTimeoutCallback() {
        val method = GaiaClientService::class.java.getDeclaredMethod(
            "onTimeout",
            Int::class.javaPrimitiveType,
            Int::class.javaPrimitiveType
        )

        assertTrue(Modifier.isPublic(method.modifiers))
    }

    @Test
    fun keepsTheLegacySingleArgumentTimeoutCallback() {
        val method = GaiaClientService::class.java.getDeclaredMethod(
            "onTimeout",
            Int::class.javaPrimitiveType
        )

        assertTrue(Modifier.isPublic(method.modifiers))
    }
}
