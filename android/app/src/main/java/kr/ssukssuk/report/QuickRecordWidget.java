package kr.ssukssuk.report;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.RemoteViews;

public final class QuickRecordWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        update(context, manager, id);
    }
    private static void update(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.quick_record_widget);
        int[] buttons = {R.id.widget_sleep, R.id.widget_feeding, R.id.widget_temperature, R.id.widget_diaper};
        String[] actions = {"sleep", "feeding", "temperature", "diaper"};
        for (int i = 0; i < actions.length; i++) {
            Intent intent = new Intent(context, MainActivity.class);
            intent.setAction("kr.ssukssuk.report.QUICK_" + actions[i]);
            intent.putExtra(MainActivity.EXTRA_QUICK_ACTION, actions[i]);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pending = PendingIntent.getActivity(context, i, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(buttons[i], pending);
        }
        manager.updateAppWidget(widgetId, views);
    }
}
