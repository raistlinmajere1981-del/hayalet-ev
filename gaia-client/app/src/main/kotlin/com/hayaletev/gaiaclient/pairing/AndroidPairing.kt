package com.hayaletev.gaiaclient.pairing

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.spec.ECGenParameterSpec

internal class AndroidPairingKeys : PairingKeys {
    private val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    override fun generate(alias: String): KeyPair {
        require(!store.containsAlias(alias))
        val spec =
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_NONE)
                .build()
        return KeyPairGenerator.getInstance("EC", "AndroidKeyStore").run {
            initialize(spec)
            generateKeyPair().also { check(it.private.encoded == null) }
        }
    }

    override fun load(alias: String): KeyPair? {
        if (!store.containsAlias(alias)) return null
        val key = store.getKey(alias, null) as PrivateKey
        check(key.encoded == null)
        return KeyPair(store.getCertificate(alias).publicKey, key)
    }

    override fun delete(alias: String) = store.deleteEntry(alias)
}

internal fun pairingStore(context: Context) =
    PairingStore(File(context.noBackupFilesDir, "gaia-client"), AndroidPairingKeys())
