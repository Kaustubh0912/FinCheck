package com.example.fincheck.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.fincheck.api.FinCheckApi
import com.example.fincheck.api.WidgetData
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class WidgetRefreshWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val prefs = WidgetPrefs(context)
        if (prefs.jwtToken == null) {
            return Result.failure()
        }

        return try {
            val api = FinCheckApi.create(prefs)
            
            // Get today date strings
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val cal = Calendar.getInstance()
            val todayStr = sdf.format(cal.time)
            
            // Get month date strings
            cal.set(Calendar.DAY_OF_MONTH, 1)
            val monthStartStr = sdf.format(cal.time)
            cal.set(Calendar.DAY_OF_MONTH, cal.getActualMaximum(Calendar.DAY_OF_MONTH))
            val monthEndStr = sdf.format(cal.time)

            // Fetch monthly summary for netWorth, income, expense
            val monthlySummary = api.getSummary(monthStartStr, monthEndStr)
            
            // Note: Since monthlySummary also includes todayExpense according to the API response, 
            // we don't necessarily need a separate request for today's spending, but to be sure we can just use the returned todayExpense.
            
            val widgetData = WidgetData(
                netWorth = monthlySummary.netWorth,
                monthlyIncome = monthlySummary.income,
                monthlyExpense = monthlySummary.expense,
                todayExpense = monthlySummary.todayExpense,
                currency = prefs.currency,
                timestamp = System.currentTimeMillis()
            )

            val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
            val jsonAdapter = moshi.adapter(WidgetData::class.java)
            prefs.cachedSummary = jsonAdapter.toJson(widgetData)
            prefs.lastUpdated = widgetData.timestamp

            // Notify widget to update
            updateWidgets(context)

            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            // If it's a 401 error, we might want to clear auth and update widget to show "Login again"
            if (e is retrofit2.HttpException && e.code() == 401) {
                prefs.clearAuth()
                updateWidgets(context)
                return Result.failure()
            }
            // Keep cached data if network error
            Result.retry()
        }
    }

    private fun updateWidgets(context: Context) {
        val intent = Intent(context, FinCheckWidget::class.java)
        intent.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        val ids = AppWidgetManager.getInstance(context)
            .getAppWidgetIds(ComponentName(context, FinCheckWidget::class.java))
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        context.sendBroadcast(intent)
    }
}
