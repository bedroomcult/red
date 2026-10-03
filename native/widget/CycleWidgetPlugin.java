package com.red.tracker.widget;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

import static com.red.tracker.widget.CycleWidgetProvider.KEY_NEXT;
import static com.red.tracker.widget.CycleWidgetProvider.KEY_OV;
import static com.red.tracker.widget.CycleWidgetProvider.KEY_PHASE;
import static com.red.tracker.widget.CycleWidgetProvider.KEY_VERDICT;
import static com.red.tracker.widget.CycleWidgetProvider.PREFS;

// Bridge so the web layer can hand the widget its data and ask for a repaint.
//
// Only three things cross: the next predicted period DATE, the current phase,
// and the ovulation DATE. The widget derives the countdown and today's offset
// itself, so nothing time-based is stored — a number would freeze the moment
// the app is closed.
//
// Java, not Kotlin: the generated project has MainActivity.java and no Kotlin
// plugin, so .kt sources were never compiled. Matching the template's language
// removes that whole class of failure.
@CapacitorPlugin(name = "CycleWidget")
public class CycleWidgetPlugin extends Plugin {

    @PluginMethod
    public void setData(PluginCall call) {
        // getString with a default keeps older web builds working: an app that
        // predates the ovulation line sends no "ov" and must not crash here.
        String next = call.getString("nextPeriod", "");
        String phase = call.getString("phase", "");
        String ov = call.getString("ov", "");
        String verdict = call.getString("verdict", "");

        getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_NEXT, next)
                .putString(KEY_PHASE, phase)
                .putString(KEY_OV, ov)
                .putString(KEY_VERDICT, verdict)
                .apply();
        // Repaint immediately, so the widget is correct without waiting for the
        // next updatePeriodMillis tick.
        CycleWidgetProvider.updateAll(getContext());
        call.resolve(new JSObject().put("ok", true));
    }
}
