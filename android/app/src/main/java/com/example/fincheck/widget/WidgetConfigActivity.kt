package com.example.fincheck.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.ExistingPeriodicWorkPolicy
import com.example.fincheck.api.FinCheckApi
import com.example.fincheck.api.LoginRequest
import com.example.fincheck.theme.FinCheckTheme
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class WidgetConfigActivity : ComponentActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Find the widget id from the intent
        val extras = intent.extras
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
        }

        // If this activity was started with an intent without an app widget ID, finish with an error
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }
        
        // Set result to CANCELED. This will cause the widget host to cancel
        // out of the widget placement if the user presses the back button.
        setResult(Activity.RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))

        setContent {
            FinCheckTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ConfigScreen(onComplete = { finishSetup() })
                }
            }
        }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun ConfigScreen(onComplete: () -> Unit) {
        val prefs = remember { WidgetPrefs(this@WidgetConfigActivity) }
        var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var isLoading by remember { mutableStateOf(false) }
        var errorMessage by remember { mutableStateOf<String?>(null) }
        val scope = rememberCoroutineScope()

        Column(
            modifier = Modifier
                .padding(24.dp)
                .fillMaxSize(),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "FinCheck Widget",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email") },
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                singleLine = true
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                singleLine = true
            )

            if (errorMessage != null) {
                Text(
                    text = errorMessage!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }

            Button(
                onClick = {
                    if (email.isBlank() || password.isBlank()) {
                        errorMessage = "Please fill in all fields"
                        return@Button
                    }
                    scope.launch {
                        isLoading = true
                        errorMessage = null
                        try {
                            val api = FinCheckApi.create(prefs)
                            
                            val loginResponse = api.login(LoginRequest(email, password))
                            prefs.jwtToken = loginResponse.token
                            prefs.currency = loginResponse.user.currency
                            
                            // Immediately fetch summary to have initial data
                            val refreshWorker = androidx.work.OneTimeWorkRequestBuilder<WidgetRefreshWorker>().build()
                            WorkManager.getInstance(this@WidgetConfigActivity).enqueue(refreshWorker)

                            // Start periodic worker
                            val periodicWork = PeriodicWorkRequestBuilder<WidgetRefreshWorker>(15, TimeUnit.MINUTES)
                                .build()
                            WorkManager.getInstance(this@WidgetConfigActivity).enqueueUniquePeriodicWork(
                                "WidgetRefresh",
                                ExistingPeriodicWorkPolicy.KEEP,
                                periodicWork
                            )
                            
                            onComplete()
                        } catch (e: Exception) {
                            errorMessage = "Login failed: ${e.message}"
                        } finally {
                            isLoading = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                } else {
                    Text("Connect FinCheck")
                }
            }
        }
    }

    private fun finishSetup() {
        val resultValue = Intent().apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        
        // Notify the widget to update
        val updateIntent = Intent(this, FinCheckWidget::class.java)
        updateIntent.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(appWidgetId))
        sendBroadcast(updateIntent)
        
        setResult(Activity.RESULT_OK, resultValue)
        finish()
    }
}
