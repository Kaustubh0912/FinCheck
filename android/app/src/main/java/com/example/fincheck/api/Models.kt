package com.example.fincheck.api

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
    val token: String,
    val user: UserInfo
)

@JsonClass(generateAdapter = true)
data class MeResponse(
    val user: UserInfo
)

@JsonClass(generateAdapter = true)
data class UserInfo(
    val id: String,
    val name: String,
    val currency: String,
    val monthlyBudget: Long?
)

@JsonClass(generateAdapter = true)
data class SummaryResponse(
    val range: Range,
    val netWorth: Long,
    val income: Long,
    val expense: Long,
    val todayExpense: Long,
    val byCategory: List<CategoryBreakdown>,
    val accounts: List<AccountSummary>?
)

@JsonClass(generateAdapter = true)
data class Range(
    val from: String,
    val to: String
)

@JsonClass(generateAdapter = true)
data class CategoryBreakdown(
    val categoryId: String?,
    val name: String,
    val icon: String,
    val color: String,
    val amount: Long
)

@JsonClass(generateAdapter = true)
data class AccountSummary(
    val id: String,
    val name: String,
    val icon: String,
    val color: String,
    val balance: Long
)

@JsonClass(generateAdapter = true)
data class WidgetData(
    val netWorth: Long,
    val monthlyIncome: Long,
    val monthlyExpense: Long,
    val todayExpense: Long,
    val currency: String,
    val timestamp: Long
)
