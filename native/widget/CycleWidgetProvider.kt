package com.red.tracker.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import com.red.tracker.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// Home-screen widget: days to the next predicted period, plus the current phase.
//
// Why it computes the countdown itself instead of rendering a number the app
// pushed: the widget must stay correct while the app stays closed. The app
// stores the predicted DATE; this provider works out "in N days" at paint time,
// so the figure is right on a day the user never opens the app.
//
// Two layouts, selected by width: the small 2x2 and the wide 4x2. Both read the
// same values and differ only in how much they show.
class CycleWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val data = readWidgetData(context)
        for (id in ids) {
            manager.updateAppWidget(id, buildViews(context, manager, id, data))
        }
    }

    companion object {
        // Shared with CycleWidgetPlugin, which writes these keys.
        const val PREFS = "red_widget"
        const val KEY_NEXT = "next_period"
        const val KEY_PHASE = "phase"

        // Repaint every widget instance. Called by the plugin after the app
        // writes new data, and by the daily updatePeriodMillis tick.
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(context, CycleWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val data = readWidgetData(context)
            for (id in ids) {
                manager.updateAppWidget(id, buildViews(context, manager, id, data))
            }
        }

        private data class WidgetData(val next: String?, val phase: String?)

        private fun readWidgetData(context: Context): WidgetData {
            val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            return WidgetData(p.getString(KEY_NEXT, null), p.getString(KEY_PHASE, null))
        }

        // Whole days from today to the stored date, in UTC to match how the app
        // stores YYYY-MM-DD. Null when there is no date or it will not parse.
        private fun daysUntil(next: String?): Int? {
            if (next.isNullOrEmpty()) return null
            return try {
                val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val target = fmt.parse(next) ?: return null
                val today = fmt.parse(fmt.format(Date())) ?: return null
                ((target.time - today.time) / 86_400_000L).toInt()
            } catch (_: Exception) {
                null
            }
        }

        private fun phaseLabel(phase: String?): String? = when (phase) {
            "period" -> "Hari haid"
            "fertile" -> "Masa subur"
            "ovulation" -> "Perkiraan ovulasi"
            "pms" -> "Menjelang haid"
            "neutral" -> "Hari biasa"
            "bc" -> "Siklus dijeda KB"
            else -> null
        }

        private fun buildViews(
            context: Context,
            manager: AppWidgetManager,
            id: Int,
            data: WidgetData,
        ): RemoteViews {
            // Width decides the layout. 220dp is comfortably between the 2x2 and
            // the 4x2 default sizes, so neither falls on the wrong side.
            val wide = manager.getAppWidgetOptions(id)
                .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) >= 220
            val layout = if (wide) R.layout.widget_cycle_wide else R.layout.widget_cycle
            val views = RemoteViews(context.packageName, layout)

            val days = daysUntil(data.next)
            val figure = when {
                days == null -> "–"
                days > 0 -> days.toString()
                days == 0 -> "0"
                else -> days.toString()
            }
            // Copy states the number's meaning, so a bare figure is never
            // ambiguous. Overdue is worded plainly, not alarmingly.
            val unit = when {
                days == null -> "Tandai haid untuk mulai"
                days > 1 -> "hari lagi"
                days == 1 -> "besok"
                days == 0 -> "hari ini"
                days == -1 -> "terlambat 1 hari"
                else -> "terlambat ${-days} hari"
            }

            views.setTextViewText(R.id.widget_days, figure)
            views.setTextViewText(R.id.widget_unit, unit)
            views.setTextViewText(R.id.widget_phase, phaseLabel(data.phase) ?: "Belum ada data")

            // The phase dot carries the same colour the app uses for that phase,
            // so the widget and the app read as one product.
            val dotColor = when (data.phase) {
                "period" -> 0xFFF0507A.toInt()
                "fertile" -> 0xFF5BB8E8.toInt()
                "ovulation" -> 0xFF2F8FD0.toInt()
                "pms" -> 0xFFF5A94A.toInt()
                else -> 0xFFB9A8C9.toInt()
            }
            views.setInt(R.id.widget_dot, "setColorFilter", dotColor)

            // Tapping anywhere opens the app.
            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launch != null) {
                views.setOnClickPendingIntent(R.id.widget_root, android.app.PendingIntent.getActivity(
                    context,
                    0,
                    launch,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
                ))
            }
            return views
        }
    }
}
