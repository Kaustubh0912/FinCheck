package com.example.fincheck.api

import com.example.fincheck.widget.WidgetPrefs
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface FinCheckApi {

    @GET("api/summary")
    suspend fun getSummary(
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("todayStart") todayStart: String? = null
    ): SummaryResponse

    @GET("api/auth/me")
    suspend fun getMe(): MeResponse

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    companion object {
        fun create(prefs: WidgetPrefs): FinCheckApi {
            val authInterceptor = Interceptor { chain ->
                val requestBuilder = chain.request().newBuilder()
                prefs.jwtToken?.let {
                    requestBuilder.addHeader("Authorization", "Bearer $it")
                }
                chain.proceed(requestBuilder.build())
            }

            val client = OkHttpClient.Builder()
                .addInterceptor(authInterceptor)
                .build()

            val moshi = Moshi.Builder()
                .add(KotlinJsonAdapterFactory())
                .build()

            var baseUrl = prefs.serverUrl
            if (!baseUrl.endsWith("/")) {
                baseUrl += "/"
            }

            return Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(MoshiConverterFactory.create(moshi))
                .build()
                .create(FinCheckApi::class.java)
        }
    }
}
