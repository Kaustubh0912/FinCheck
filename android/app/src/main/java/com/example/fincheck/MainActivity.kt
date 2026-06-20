package com.example.fincheck

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.example.fincheck.widget.WidgetRefreshWorker

class MainActivity : ComponentActivity() {
    private var launched = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) {
            launched = savedInstanceState.getBoolean("launched", false)
        }
    }

    override fun onResume() {
        super.onResume()
        if (!launched) {
            launched = true
            val uri = Uri.parse("https://fin-check-client.vercel.app/")
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(false)
                .build()
            
            // Setting the package to Chrome to ensure it acts as a TWA/Custom Tab properly if possible
            customTabsIntent.intent.setPackage("com.android.chrome")
            try {
                customTabsIntent.launchUrl(this, uri)
            } catch (e: Exception) {
                // Fallback if Chrome is not installed
                customTabsIntent.intent.setPackage(null)
                customTabsIntent.launchUrl(this, uri)
            }
        } else {
            // Returned from TWA
            refreshWidgets()
            finish()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean("launched", launched)
    }

    private fun refreshWidgets() {
        // Enqueue a work to refresh widget data immediately
        val workRequest = OneTimeWorkRequestBuilder<WidgetRefreshWorker>().build()
        WorkManager.getInstance(this).enqueue(workRequest)
    }
}
