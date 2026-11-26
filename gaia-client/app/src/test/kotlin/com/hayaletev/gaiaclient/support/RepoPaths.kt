package com.hayaletev.gaiaclient.support

import java.io.File

object RepoPaths {
    fun protocolDir(): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            if (File(dir, "gaia-protocol/v1/fixtures/manifest.json").isFile) {
                return File(dir, "gaia-protocol/v1")
            }
            dir = dir.parentFile
        }
        error("gaia-protocol/v1 not found above ${System.getProperty("user.dir")}")
    }
}
