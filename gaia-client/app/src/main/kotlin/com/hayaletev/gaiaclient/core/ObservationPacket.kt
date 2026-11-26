package com.hayaletev.gaiaclient.core

data class ObservationPacket(
    val v: Int = 1,
    val sessionId: String,
    val seq: Long,
    val sentMonoMs: Long,
    val deviceWallMs: Long,
    val samples: List<Sample>
) {
    init {
        require(v == 1) { "unsupported observation version" }
        require(sessionId.isNotBlank()) { "sessionId must not be blank" }
        require(seq >= 1) { "seq must start at 1" }
        require(sentMonoMs >= 0) { "sentMonoMs must be non-negative" }
        require(deviceWallMs >= 0) { "deviceWallMs must be non-negative" }
    }
}
