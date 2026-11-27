package com.hayaletev.gaiaclient.transport

import com.hayaletev.gaiaclient.protocol.WIRE_LIMIT
import com.hayaletev.gaiaclient.protocol.bounded
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.InputStream
import java.util.Locale

internal data class FieldResponse(val status: Int, val body: ByteArray, val retryAfterMs: Long = 0)

internal fun readResponse(input: InputStream, bodyStarted: () -> Unit): FieldResponse {
    var remaining = 8192
    fun line(): String {
        val bytes = ByteArrayOutputStream()
        while (remaining-- > 0) {
            val c = input.read()
            if (c == -1) throw EOFException()
            if (c == 13) {
                require(remaining-- > 0 && input.read() == 10)
                return bytes.toString("US-ASCII")
            }
            require(c == 9 || c in 32..126)
            bytes.write(c)
        }
        error("HTTP headers exceed budget")
    }

    val statusLine = line()
    require(statusLine.matches(Regex("HTTP/1\\.[01] [1-5][0-9]{2}(?: [^\\r\\n]*)?")))
    val status = statusLine.substring(9, 12).toInt()
    // Authorization loss stops collection even when the error page is incomplete.
    if (status == 403) return FieldResponse(status, byteArrayOf())
    val headers = mutableMapOf<String, String>()
    while (true) {
        val header = line()
        if (header.isEmpty()) break
        val name = header.substringBefore(':').lowercase(Locale.ROOT)
        require(':' in header && name.matches(Regex("[!#$%&'*+.^_`|~a-z0-9-]+")))
        require(headers.put(name, header.substringAfter(':').trim(' ', '\t')) == null)
    }
    val retry =
        headers["retry-after"]?.let {
            require(it.matches(Regex("[0-9]+")))
            (it.trimStart('0').ifEmpty { "0" }.toLongOrNull() ?: Long.MAX_VALUE).coerceAtMost(
                Long.MAX_VALUE / 1000
            ) * 1000
        } ?: 0
    require(headers["content-encoding"] == null)
    require(
        headers["content-type"]?.matches(
            Regex(
                "application/json(?:\\s*;\\s*charset=(?:utf-8|\"utf-8\"))?",
                RegexOption.IGNORE_CASE,
            )
        ) == true
    )
    require(
        headers["cache-control"]?.split(',')?.any { it.trim().equals("no-store", true) } == true
    )
    val length = headers["content-length"]
    val transfer = headers["transfer-encoding"]
    bodyStarted()
    val body = ByteArrayOutputStream()
    val buffer = ByteArray(4096)
    fun readBytes(size: Int) {
        require(size in 0..(WIRE_LIMIT - body.size()))
        var left = size
        while (left > 0) {
            val n = input.read(buffer, 0, minOf(left, buffer.size))
            if (n <= 0) throw EOFException()
            body.write(buffer, 0, n)
            left -= n
        }
    }
    if (transfer != null) {
        require(length == null && transfer.equals("chunked", true))
        while (true) {
            val hex = line()
            require(hex.matches(Regex("[a-fA-F0-9]{1,8}")))
            val size = hex.toLong(16)
            require(size <= WIRE_LIMIT)
            if (size == 0L) {
                require(line().isEmpty())
                break
            }
            readBytes(size.toInt())
            require(line().isEmpty())
        }
    } else if (length != null) {
        require(length.matches(Regex("[0-9]+")))
        readBytes(length.toInt())
    } else {
        return FieldResponse(status, input.bounded(WIRE_LIMIT), retry)
    }
    return FieldResponse(status, body.toByteArray(), retry)
}
