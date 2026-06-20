package com.example.fincheck.widget

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class WidgetPrefs(context: Context) {

    private val prefs: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        prefs = EncryptedSharedPreferences.create(
            context,
            "fincheck_widget_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    var jwtToken: String?
        get() = prefs.getString("jwt_token", null)
        set(value) = prefs.edit().putString("jwt_token", value).apply()

    var serverUrl: String
        get() = prefs.getString("server_url", "") ?: ""
        set(value) = prefs.edit().putString("server_url", value).apply()

    var currency: String
        get() = prefs.getString("currency", "INR") ?: "INR"
        set(value) = prefs.edit().putString("currency", value).apply()

    var cachedSummary: String?
        get() = prefs.getString("cached_summary", null)
        set(value) = prefs.edit().putString("cached_summary", value).apply()

    var lastUpdated: Long
        get() = prefs.getLong("last_updated", 0L)
        set(value) = prefs.edit().putLong("last_updated", value).apply()
        
    fun clearAuth() {
        prefs.edit()
            .remove("jwt_token")
            .remove("cached_summary")
            .remove("last_updated")
            .apply()
    }
}
