package com.example.fincheck.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.text.format.DateUtils
import android.widget.RemoteViews
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.example.fincheck.MainActivity
import com.example.fincheck.R
import com.example.fincheck.api.WidgetData
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

class FinCheckWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // There may be multiple widgets active, so update all of them
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            // Trigger background worker
            val workRequest = OneTimeWorkRequestBuilder<WidgetRefreshWorker>().build()
            WorkManager.getInstance(context).enqueue(workRequest)

            // Optimistically update widget to show "Updating..."
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, FinCheckWidget::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                val views = RemoteViews(context.packageName, R.layout.widget_layout)
                views.setTextViewText(R.id.widget_last_updated, "Updating...")
                appWidgetManager.updateAppWidget(appWidgetId, views)
            }
        }
    }

    companion object {
        const val ACTION_REFRESH = "com.example.fincheck.widget.ACTION_REFRESH"

        internal fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = WidgetPrefs(context)
            val views = RemoteViews(context.packageName, R.layout.widget_layout)

            if (prefs.jwtToken == null) {
                views.setTextViewText(R.id.widget_net_worth, "Tap to setup")
                views.setTextViewText(R.id.widget_today_expense, "--")
                views.setTextViewText(R.id.widget_daily_limit, "--")
                views.setTextViewText(R.id.widget_last_updated, "Needs login")
                
                // Intent to setup/login
                val configIntent = Intent(context, WidgetConfigActivity::class.java)
                configIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                val configPendingIntent = PendingIntent.getActivity(
                    context, appWidgetId, configIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_container, configPendingIntent)
            } else {
                val cachedJson = prefs.cachedSummary
                if (cachedJson != null) {
                    try {
                        val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
                        val adapter = moshi.adapter(WidgetData::class.java)
                        val data = adapter.fromJson(cachedJson)
                        
                        if (data != null) {
                            val format = NumberFormat.getCurrencyInstance(Locale.getDefault())
                            try {
                                format.currency = Currency.getInstance(data.currency)
                            } catch (e: Exception) {
                                // Fallback to user locale currency
                            }
                            
                            val netWorthStr = format.format(data.netWorth / 100.0)
                            val todayStr = format.format(data.todayExpense / 100.0)

                            views.setTextViewText(R.id.widget_net_worth, netWorthStr)
                            views.setTextViewText(R.id.widget_today_expense, todayStr)

                            if (data.monthlyBudget != null && data.monthlyBudget > 0) {
                                val cal = java.util.Calendar.getInstance()
                                val totalDays = cal.getActualMaximum(java.util.Calendar.DAY_OF_MONTH)
                                val currentDay = cal.get(java.util.Calendar.DAY_OF_MONTH)
                                val daysLeft = totalDays - currentDay + 1
                                
                                val monthExpenseBeforeToday = Math.max(0L, data.monthlyExpense - data.todayExpense)
                                val todaysBudget = Math.max(0L, (data.monthlyBudget - monthExpenseBeforeToday) / daysLeft)
                                
                                val limitStr = format.format(todaysBudget / 100.0)
                                views.setTextViewText(R.id.widget_daily_limit, limitStr)
                            } else {
                                views.setTextViewText(R.id.widget_daily_limit, "--")
                            }

                            val timeString = DateUtils.formatDateTime(
                                context,
                                data.timestamp,
                                DateUtils.FORMAT_SHOW_TIME
                            )
                            views.setTextViewText(R.id.widget_last_updated, "Updated $timeString")
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                // Setup container click to open TWA main app
                val mainIntent = Intent(context, MainActivity::class.java)
                val mainPendingIntent = PendingIntent.getActivity(
                    context, 0, mainIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_container, mainPendingIntent)
            }

            // Setup refresh button
            val refreshIntent = Intent(context, FinCheckWidget::class.java)
            refreshIntent.action = ACTION_REFRESH
            val refreshPendingIntent = PendingIntent.getBroadcast(
                context, 0, refreshIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_refresh_btn, refreshPendingIntent)

            // Instruct the widget manager to update the widget
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
