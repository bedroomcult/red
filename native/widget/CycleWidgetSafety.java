package com.red.tracker.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;

// 1x1 picker entry: today's chance band only. Shares prefs and the daily tick
// with the 2x2 countdown widget: this class only picks the safety layout,
// CycleWidgetProvider does everything else.
public class CycleWidgetSafety extends CycleWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetData data = readWidgetData(context);
        for (int id : ids) {
            manager.updateAppWidget(id, paintSafety(context, data));
        }
    }
}
