package com.red.tracker.widget

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

// Bridge so the web layer can hand the widget its data and ask for a repaint.
//
// Only two things cross: the next predicted period DATE and the current phase.
// The widget derives the countdown from the date itself, so nothing time-based
// is stored — a stored "3 days" would be wrong by morning.
//
// No @capacitor/preferences dependency: that plugin is not in package.json and
// adding it would need a lockfile regeneration, which CI's `npm ci` rejects if
// hand-edited. SharedPreferences is two calls and has no dependency cost.
@CapacitorPlugin(name = "CycleWidget")
class CycleWidgetPlugin : Plugin() {

    @PluginMethod
    fun setData(call: PluginCall) {
        val next = call.getString("nextPeriod") ?: ""
        val phase = call.getString("phase") ?: ""
        context.getSharedPreferences(CycleWidgetProvider.PREFS, android.content.Context.MODE_PRIVATE)
            .edit()
            .putString(CycleWidgetProvider.KEY_NEXT, next)
            .putString(CycleWidgetProvider.KEY_PHASE, phase)
            .apply()
        // Repaint immediately, so the widget is correct without waiting for the
        // next updatePeriodMillis tick.
        CycleWidgetProvider.updateAll(context)
        call.resolve(JSObject().put("ok", true))
    }
}
