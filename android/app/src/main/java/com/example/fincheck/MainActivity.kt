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
    private lateinit var launcher: com.google.androidbrowserhelper.trusted.TwaLauncher

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) {
            launched = savedInstanceState.getBoolean("launched", false)
        }
        launcher = com.google.androidbrowserhelper.trusted.TwaLauncher(this)
    }

    override fun onResume() {
        super.onResume()
        if (!launched) {
            launched = true
            val pm = packageManager
            val pInfo = pm.getPackageInfo(packageName, 0)
            val versionCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                pInfo.longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode
            }
            val uri = Uri.parse("https://fin-check-client.vercel.app/?apk_version=$versionCode")
            launcher.launch(uri)
        } else {
            // Returned from TWA
            refreshWidgets()
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        launcher.destroy()
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
