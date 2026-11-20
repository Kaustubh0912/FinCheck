package com.example.fincheck.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.text.format.DateUtils
import android.view.View
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

enum class WidgetSpendingStatus {
    NEUTRAL,
    SAFE,
    WARNING,
    DANGER
}

data class WidgetTheme(
    val titleText: String,
    val titleColor: Int,
    val backgroundRes: Int,
    val tileBackgroundRes: Int,
    val refreshBackgroundRes: Int,
    val limitColor: Int,
    val expenseColor: Int,
    val labelColor: Int,
)

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

        private fun getTheme(status: WidgetSpendingStatus): WidgetTheme {
            return when (status) {
                WidgetSpendingStatus.NEUTRAL -> WidgetTheme(
                    titleText = "FINCHECK  ·  TODAY",
                    titleColor = 0xFFA0B0A4.toInt(),
                    backgroundRes = R.drawable.widget_background,
                    tileBackgroundRes = R.drawable.widget_metric_background,
                    refreshBackgroundRes = R.drawable.widget_refresh_background,
                    limitColor = 0xFFA9E0B3.toInt(),
                    expenseColor = 0xFFF5F3EA.toInt(),
                    labelColor = 0xFF82978A.toInt()
                )
                WidgetSpendingStatus.SAFE -> WidgetTheme(
                    titleText = "FINCHECK  ·  ON TRACK",
                    titleColor = 0xFFB7D0BE.toInt(),
                    backgroundRes = R.drawable.widget_background,
                    tileBackgroundRes = R.drawable.widget_metric_background,
                    refreshBackgroundRes = R.drawable.widget_refresh_background,
                    limitColor = 0xFFA9E0B3.toInt(),
                    expenseColor = 0xFFF5F3EA.toInt(),
                    labelColor = 0xFF82978A.toInt()
                )
                WidgetSpendingStatus.WARNING -> WidgetTheme(
                    titleText = "FINCHECK  ·  NEARING LIMIT",
                    titleColor = 0xFFE6C49C.toInt(),
                    backgroundRes = R.drawable.widget_background_warning,
                    tileBackgroundRes = R.drawable.widget_metric_background_warning,
                    refreshBackgroundRes = R.drawable.widget_refresh_background_warning,
                    limitColor = 0xFFF7D399.toInt(),
                    expenseColor = 0xFFFFC4A3.toInt(),
                    labelColor = 0xFFA88C72.toInt()
                )
                WidgetSpendingStatus.DANGER -> WidgetTheme(
                    titleText = "FINCHECK  ·  OVER LIMIT",
                    titleColor = 0xFFF3AFA6.toInt(),
                    backgroundRes = R.drawable.widget_background_danger,
                    tileBackgroundRes = R.drawable.widget_metric_background_danger,
                    refreshBackgroundRes = R.drawable.widget_refresh_background_danger,
                    limitColor = 0xFFF5B4A8.toInt(),
                    expenseColor = 0xFFFF7E6B.toInt(),
                    labelColor = 0xFFA87570.toInt()
                )
            }
        }

        private fun applyTheme(
            views: RemoteViews,
            theme: WidgetTheme,
            status: WidgetSpendingStatus,
            spendingProgress: Int
        ) {
            views.setTextViewText(R.id.widget_title, theme.titleText)
            views.setTextColor(R.id.widget_title, theme.titleColor)
            views.setInt(R.id.widget_container, "setBackgroundResource", theme.backgroundRes)
            views.setInt(R.id.widget_daily_tile, "setBackgroundResource", theme.tileBackgroundRes)
            views.setInt(R.id.widget_spent_tile, "setBackgroundResource", theme.tileBackgroundRes)
            views.setInt(R.id.widget_refresh_btn, "setBackgroundResource", theme.refreshBackgroundRes)
            views.setTextColor(R.id.widget_daily_limit, theme.limitColor)
            views.setTextColor(R.id.widget_today_expense, theme.expenseColor)
            views.setTextColor(R.id.widget_progress_label, theme.labelColor)

            views.setViewVisibility(
                R.id.widget_spending_progress,
                if (status == WidgetSpendingStatus.NEUTRAL || status == WidgetSpendingStatus.SAFE) View.VISIBLE else View.GONE
            )
            views.setViewVisibility(
                R.id.widget_spending_progress_warning,
                if (status == WidgetSpendingStatus.WARNING) View.VISIBLE else View.GONE
            )
            views.setViewVisibility(
                R.id.widget_spending_progress_danger,
                if (status == WidgetSpendingStatus.DANGER) View.VISIBLE else View.GONE
            )

            val activeProgressId = when (status) {
                WidgetSpendingStatus.NEUTRAL, WidgetSpendingStatus.SAFE -> R.id.widget_spending_progress
                WidgetSpendingStatus.WARNING -> R.id.widget_spending_progress_warning
                WidgetSpendingStatus.DANGER -> R.id.widget_spending_progress_danger
            }
            views.setProgressBar(activeProgressId, 100, spendingProgress, false)
        }

        internal fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = WidgetPrefs(context)
            val views = RemoteViews(context.packageName, R.layout.widget_layout)

            if (prefs.jwtToken == null) {
                applyTheme(
                    views,
                    getTheme(WidgetSpendingStatus.NEUTRAL),
                    WidgetSpendingStatus.NEUTRAL,
                    0
                )
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
                var status = WidgetSpendingStatus.NEUTRAL
                var spendingProgress = 0

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

                                spendingProgress = if (todaysBudget > 0) {
                                    ((data.todayExpense.toDouble() / todaysBudget) * 100).toInt().coerceIn(0, 100)
                                } else if (data.todayExpense > 0) {
                                    100
                                } else {
                                    0
                                }

                                status = when {
                                    todaysBudget <= 0L && data.todayExpense > 0L -> WidgetSpendingStatus.DANGER
                                    todaysBudget > 0L && data.todayExpense > todaysBudget -> WidgetSpendingStatus.DANGER
                                    todaysBudget > 0L && data.todayExpense.toDouble() >= (todaysBudget * 0.75) && data.todayExpense > 0L -> WidgetSpendingStatus.WARNING
                                    else -> WidgetSpendingStatus.SAFE
                                }
                            } else {
                                views.setTextViewText(R.id.widget_daily_limit, "--")
                                status = WidgetSpendingStatus.NEUTRAL
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

                val theme = getTheme(status)
                applyTheme(views, theme, status, spendingProgress)

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
