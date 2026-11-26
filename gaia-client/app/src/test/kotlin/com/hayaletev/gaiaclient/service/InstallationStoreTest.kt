package com.hayaletev.gaiaclient.service

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class InstallationStoreTest {
    @get:Rule
    val temp = TemporaryFolder()

    private val uuidV4 = Regex(
        "^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"
    )

    private fun store(): InstallationStore = InstallationStore(temp.root)

    @Test
    fun firstCallCreatesALowercaseUuidV4() {
        val id = store().getOrCreate()

        assertTrue(id, uuidV4.matches(id))
        val file = File(temp.root, "installation-id")
        assertTrue(file.isFile)
        assertEquals(id, file.readText())
    }

    @Test
    fun secondCallReturnsTheSameIdentity() {
        val first = store().getOrCreate()
        val second = store().getOrCreate()

        assertEquals(first, second)
    }

    @Test
    fun invalidExistingContentIsNotReplaced() {
        val file = File(temp.root, "installation-id")
        file.writeText("not-a-uuid")

        assertThrows(InstallationIdentityException::class.java) {
            store().getOrCreate()
        }

        assertEquals("not-a-uuid", file.readText())
    }

    @Test
    fun emptyExistingIdentityIsNotReplaced() {
        val file = File(temp.root, "installation-id")
        file.createNewFile()

        assertThrows(InstallationIdentityException::class.java) {
            store().getOrCreate()
        }

        assertEquals("", file.readText())
    }

    @Test
    fun unreadableExistingIdentityIsNotReplaced() {
        val file = File(temp.root, "installation-id")
        assertTrue(file.mkdirs())

        assertThrows(InstallationIdentityException::class.java) {
            store().getOrCreate()
        }

        assertTrue(file.isDirectory)
    }

    @Test
    fun writeFailureDoesNotFallBackToDirectWrite() {
        val tempPath = File(temp.root, "installation-id.tmp")
        assertTrue(tempPath.mkdirs())

        assertThrows(InstallationIdentityException::class.java) {
            store().getOrCreate()
        }

        assertFalse(File(temp.root, "installation-id").exists())
    }

    @Test
    fun blockedParentDirectoryFailsClosed() {
        val blocked = File(temp.root, "blocked")
        blocked.writeText("not a directory")

        assertThrows(InstallationIdentityException::class.java) {
            InstallationStore(blocked).getOrCreate()
        }

        assertEquals("not a directory", blocked.readText())
    }

    @Test
    fun noTemporaryFileRemains() {
        store().getOrCreate()

        val leftovers = temp.root.listFiles()?.filter {
            it.name != "installation-id"
        }.orEmpty()
        assertTrue("unexpected files: $leftovers", leftovers.isEmpty())
        assertFalse(File(temp.root, "installation-id.tmp").exists())
    }
}
