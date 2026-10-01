package com.red.tracker.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import com.red.tracker.R;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

// Home-screen widget: days to the next predicted period, the current phase,
// and today's chance band.
//
// Why it computes instead of rendering what the app pushed: the widget must
// stay correct while the app stays closed. The app stores the predicted DATE
// and the ovulation DATE; this provider works out "in N days" and today's
// chance offset at paint time, so both figures are right on days the user never
// opens the app.
//
// One provider, two layouts selected by width: small 2x2 and wide 4x2.
//
// Java, not Kotlin: the generated project has MainActivity.java and no Kotlin
// plugin, so .kt sources were never compiled. Matching the template's language
// removes that whole class of failure.
public class CycleWidgetProvider extends AppWidgetProvider {

    // Shared with CycleWidgetPlugin, which writes these keys.
    public static final String PREFS = "red_widget";
    public static final String KEY_NEXT = "next_period";
    public static final String KEY_PHASE = "phase";
    public static final String KEY_OV = "ovulation";

    // Wilcox day-specific conception probabilities, percent. Same numbers as
    // lib/chance.ts (-5..+1). Re-implemented because native code cannot import
    // the TypeScript; the vitest contract asserts the two stay in step.
    private static final int[] OFFSETS = {-5, -4, -3, -2, -1, 0, 1};
    private static final int[] PERCENTS = {4, 8, 17, 27, 31, 33, 5};

    // Small entry: always the 2x2 layout. The safety badge is a separate
    // provider (CycleWidgetSafety) so Android shows two choices.
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetData data = readWidgetData(context);
        for (int id : ids) {
            manager.updateAppWidget(id, paint(context, R.layout.widget_cycle, data));
        }
    }

    // Repaint every widget instance of BOTH kinds. Called by the plugin after
    // the app writes new data, and by the daily updatePeriodMillis tick.
    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        WidgetData data = readWidgetData(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, CycleWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, paint(context, R.layout.widget_cycle, data));
        }
        int[] safetyIds = manager.getAppWidgetIds(new ComponentName(context, CycleWidgetSafety.class));
        for (int id : safetyIds) {
            manager.updateAppWidget(id, paintSafety(context, data));
        }
    }

    static class WidgetData {
        final String next;
        final String phase;
        final String ov;
        WidgetData(String next, String phase, String ov) {
            this.next = next;
            this.phase = phase;
            this.ov = ov;
        }
    }

    static WidgetData readWidgetData(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return new WidgetData(
                p.getString(KEY_NEXT, null),
                p.getString(KEY_PHASE, null),
                p.getString(KEY_OV, null));
    }

    private static String todayIso() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new Date());
    }

    // Whole days from today to the stored date, in UTC to match how the app
    // stores YYYY-MM-DD. Null when there is no date or it will not parse.
    private static Integer daysUntil(String next) {
        if (next == null || next.isEmpty()) return null;
        try {
            SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date target = fmt.parse(next);
            Date today = fmt.parse(fmt.format(new Date()));
            if (target == null || today == null) return null;
            return (int) ((target.getTime() - today.getTime()) / 86_400_000L);
        } catch (Exception e) {
            return null;
        }
    }

    // Today's offset into the Wilcox curve. Null without an ovulation date to
    // measure against: without one any band would be invented.
    private static Integer chanceOffset(String today, String ov) {
        if (today == null || today.isEmpty() || ov == null || ov.isEmpty()) return null;
        try {
            SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date o = fmt.parse(ov);
            Date t = fmt.parse(today);
            if (o == null || t == null) return null;
            return (int) ((t.getTime() - o.getTime()) / 86_400_000L);
        } catch (Exception e) {
            return null;
        }
    }

    // Same buckets as lib/chance.ts: >=27% high, >=8% medium, window low.
    // Returns null when there is no measurement — a missing offset is not a
    // low day, it is an unknown one, and collapsing the two would lie.
    private static String chanceBand(Integer offset) {
        if (offset == null) return null;
        Integer p = null;
        for (int i = 0; i < OFFSETS.length; i++) {
            if (OFFSETS[i] == offset) { p = PERCENTS[i]; break; }
        }
        if (p == null) return "rendah";
        if (p >= 27) return "tinggi";
        if (p >= 8) return "sedang";
        return "rendah";
    }

    private static String phaseLabel(String phase) {
        if ("period".equals(phase)) return "Hari haid";
        if ("fertile".equals(phase)) return "Masa subur";
        if ("ovulation".equals(phase)) return "Perkiraan ovulasi";
        if ("pms".equals(phase)) return "Menjelang haid";
        if ("neutral".equals(phase)) return "Hari biasa";
        if ("bc".equals(phase)) return "Siklus dijeda KB";
        return null;
    }

    // Risk wording, matching the app's chance card labels exactly.
    private static String chanceLabel(String band) {
        if ("tinggi".equals(band)) return "Tinggi";
        if ("sedang".equals(band)) return "Sedang";
        if ("rendah".equals(band)) return "Rendah";
        return "Tidak dapat diperkirakan";
    }

    // 1x1 safety paint: chance icon + band label only. No countdown, no
    // phase row; those stay on the 2x2 widget. Unknown (including
    // BC-suppressed) shows the same wording as the app's chance card and
    // hides the icon row: naming a risk with no ovulation to measure
    // against would be invented.
    static RemoteViews paintSafety(Context context, WidgetData data) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_safety);
        String band = "bc".equals(data.phase) ? null : chanceBand(chanceOffset(todayIso(), data.ov));
        int visible = band == null ? -1
                : "tinggi".equals(band) ? R.id.widget_chance_high
                : "sedang".equals(band) ? R.id.widget_chance_medium : R.id.widget_chance_low;
        int[] icons = {R.id.widget_chance_high, R.id.widget_chance_medium, R.id.widget_chance_low};
        for (int viewId : icons) {
            views.setViewVisibility(viewId, viewId == visible ? View.VISIBLE : View.GONE);
        }
        if (visible != -1) {
            int badge = "tinggi".equals(band) ? 0xFFF0507A
                    : "sedang".equals(band) ? 0xFFF5A94A : 0xFF4CC38A;
            views.setInt(visible, "setColorFilter", badge);
        }
        views.setTextViewText(R.id.widget_chance_label, chanceLabel(band));

        // Tapping anywhere opens the app.
        android.content.Intent launch = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(
                    context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        return views;
    }

    static RemoteViews paint(
            Context context, int layout, WidgetData data) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);

        Integer days = daysUntil(data.next);
        String figure = days == null ? "–" : String.valueOf(days);
        // Copy states the number's meaning, so a bare figure is never
        // ambiguous. Overdue is worded plainly, not alarmingly.
        String unit;
        if (days == null) unit = "Tandai haid untuk mulai";
        else if (days > 1) unit = "hari lagi";
        else if (days == 1) unit = "besok";
        else if (days == 0) unit = "hari ini";
        else if (days == -1) unit = "terlambat 1 hari";
        else unit = "terlambat " + (-days) + " hari";

        views.setTextViewText(R.id.widget_days, figure);
        views.setTextViewText(R.id.widget_unit, unit);
        String phaseName = phaseLabel(data.phase);
        views.setTextViewText(R.id.widget_phase, phaseName != null ? phaseName : "Belum ada data");

        // The phase dot carries the same colour the app uses for that phase,
        // so the widget and the app read as one product.
        int dotColor;
        if ("period".equals(data.phase)) dotColor = 0xFFF0507A;
        else if ("fertile".equals(data.phase)) dotColor = 0xFF5BB8E8;
        else if ("ovulation".equals(data.phase)) dotColor = 0xFF2F8FD0;
        else if ("pms".equals(data.phase)) dotColor = 0xFFF5A94A;
        else dotColor = 0xFFB9A8C9;
        views.setInt(R.id.widget_dot, "setColorFilter", dotColor);

        // Today's chance. Unknown (including BC-suppressed) shows the same
        // wording as the app's chance card and hides the icon row: naming
        // a risk with no ovulation to measure against would be invented.
        // The visible icon is tinted to its band, the way the phase dot is
        // tinted to the phase.
        String band = "bc".equals(data.phase) ? null : chanceBand(chanceOffset(todayIso(), data.ov));
        int visible = band == null ? -1
                : "tinggi".equals(band) ? R.id.widget_chance_high
                : "sedang".equals(band) ? R.id.widget_chance_medium : R.id.widget_chance_low;
        int[] icons = {R.id.widget_chance_high, R.id.widget_chance_medium, R.id.widget_chance_low};
        for (int viewId : icons) {
            views.setViewVisibility(viewId, viewId == visible ? View.VISIBLE : View.GONE);
        }
        if (visible != -1) {
            int badge = "tinggi".equals(band) ? 0xFFF0507A
                    : "sedang".equals(band) ? 0xFFF5A94A : 0xFF4CC38A;
            views.setInt(visible, "setColorFilter", badge);
        }
        views.setTextViewText(R.id.widget_chance_label, chanceLabel(band));

        // Tapping anywhere opens the app.
        android.content.Intent launch = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(
                    context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        return views;
    }
}
