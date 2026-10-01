package com.red.tracker.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;

// 2x1 picker entry: today's risk percent, band label and ovulation caption.
// Shares prefs and the daily tick with the other widgets: this class only
// picks the risk layout, CycleWidgetProvider does everything else.
public class CycleWidgetRisk extends CycleWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetData data = readWidgetData(context);
        for (int id : ids) {
            manager.updateAppWidget(id, paintRisk(context, data));
        }
    }
}
