package com.finduo.fingo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class TrackingForegroundService : Service() {

    companion object {
        const val NOTIF_ID = 88888
        const val CHANNEL_ID = "fingo_tracking"

        const val CMD_START = "CMD_START"
        const val CMD_PAUSE = "CMD_PAUSE"
        const val CMD_RESUME = "CMD_RESUME"
        const val CMD_STOP = "CMD_STOP"

        const val EXTRA_CMD = "cmd"
        const val EXTRA_ELAPSED_MS = "elapsedMs"

        const val ACTION_PAUSE = "com.finduo.fingo.TRACKING_PAUSE"
        const val ACTION_RESUME = "com.finduo.fingo.TRACKING_RESUME"
        const val ACTION_STOP = "com.finduo.fingo.TRACKING_STOP"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val cmd = intent?.getStringExtra(EXTRA_CMD) ?: return START_NOT_STICKY
        val elapsedMs = intent.getLongExtra(EXTRA_ELAPSED_MS, 0L)

        when (cmd) {
            CMD_START -> startForeground(NOTIF_ID, buildNotification(elapsedMs, paused = false))
            CMD_PAUSE -> notify(buildNotification(elapsedMs, paused = true))
            CMD_RESUME -> notify(buildNotification(elapsedMs, paused = false))
            CMD_STOP -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun notify(notification: Notification) {
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, notification)
    }

    private fun buildNotification(elapsedMs: Long, paused: Boolean): Notification {
        val iconRes = resources.getIdentifier("ic_stat_name", "drawable", packageName)
            .takeIf { it != 0 } ?: android.R.drawable.ic_media_play

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle("FinGo Tracking")
            .setOngoing(true)
            .setAutoCancel(false)
            .setShowWhen(true)

        if (paused) {
            builder
                .setContentText("Paused — ${formatElapsed(elapsedMs)}")
                .setUsesChronometer(false)
                .setWhen(System.currentTimeMillis())
                .addAction(android.R.drawable.ic_media_play, "Resume", buildActionIntent(ACTION_RESUME))
        } else {
            // setWhen to the epoch time when tracking started so the OS counts up correctly
            builder
                .setContentText("Recording your route…")
                .setUsesChronometer(true)
                .setWhen(System.currentTimeMillis() - elapsedMs)
                .addAction(android.R.drawable.ic_media_pause, "Pause", buildActionIntent(ACTION_PAUSE))
        }

        builder.addAction(android.R.drawable.ic_delete, "Stop", buildActionIntent(ACTION_STOP))

        return builder.build()
    }

    private fun buildActionIntent(action: String): PendingIntent {
        val intent = Intent(this, ActionReceiver::class.java).apply { this.action = action }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        return PendingIntent.getBroadcast(this, action.hashCode(), intent, flags)
    }

    private fun formatElapsed(ms: Long): String {
        val totalSec = ms / 1000
        return "%d:%02d".format(totalSec / 60, totalSec % 60)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Live Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setSound(null, null)
                enableVibration(false)
                description = "Active tracking session status with controls"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    class ActionReceiver : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val action = when (intent.action) {
                ACTION_PAUSE -> "pause"
                ACTION_RESUME -> "resume"
                ACTION_STOP -> "stop"
                else -> return
            }
            ForegroundTimerPlugin.onAction?.invoke(action)
        }
    }
}
