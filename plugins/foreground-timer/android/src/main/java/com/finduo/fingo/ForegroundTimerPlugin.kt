package com.finduo.fingo

import android.content.Intent
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ForegroundTimer")
class ForegroundTimerPlugin : Plugin() {

    companion object {
        var onAction: ((String) -> Unit)? = null
    }

    override fun load() {
        super.load()
        onAction = { action ->
            val data = JSObject().apply { put("action", action) }
            notifyListeners("actionPerformed", data)
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        onAction = null
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val elapsedMs = call.getLong("elapsedMs") ?: 0L
        sendCmd(TrackingForegroundService.CMD_START, elapsedMs)
        call.resolve()
    }

    @PluginMethod
    fun update(call: PluginCall) {
        val elapsedMs = call.getLong("elapsedMs") ?: 0L
        val state = call.getString("state") ?: "active"
        val cmd = if (state == "paused") TrackingForegroundService.CMD_PAUSE
                  else TrackingForegroundService.CMD_RESUME
        sendCmd(cmd, elapsedMs)
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        sendCmd(TrackingForegroundService.CMD_STOP, 0L)
        call.resolve()
    }

    private fun sendCmd(cmd: String, elapsedMs: Long) {
        val intent = Intent(context, TrackingForegroundService::class.java).apply {
            putExtra(TrackingForegroundService.EXTRA_CMD, cmd)
            putExtra(TrackingForegroundService.EXTRA_ELAPSED_MS, elapsedMs)
        }
        if (cmd == TrackingForegroundService.CMD_START &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }
}
