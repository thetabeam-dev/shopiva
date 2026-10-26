package com.thetabeam.shopiva

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerClient.InstallReferrerResponse
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class InstallReferrerModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    private lateinit var referrerClient: InstallReferrerClient

    override fun getName() = "InstallReferrer"

    @ReactMethod
    fun getReferrer(promise: Promise) {
        val prefs = context.getSharedPreferences("deedyte_install", 0)
        if (prefs.getBoolean("referrer_read", false)) {
            promise.resolve(null)
            return
        }

        referrerClient = InstallReferrerClient.newBuilder(context).build()
        referrerClient.startConnection(object : InstallReferrerStateListener {
            override fun onInstallReferrerSetupFinished(responseCode: Int) {
                when (responseCode) {
                    InstallReferrerResponse.OK -> {
                        try {
                            val referrer = referrerClient.installReferrer.installReferrer
                            prefs.edit().putBoolean("referrer_read", true).apply()
                            promise.resolve(referrer)
                        } catch (e: Exception) {
                            promise.resolve(null)
                        } finally {
                            referrerClient.endConnection()
                        }
                    }
                    else -> {
                        promise.resolve(null)
                        referrerClient.endConnection()
                    }
                }
            }

            override fun onInstallReferrerServiceDisconnected() {}
        })
    }
}