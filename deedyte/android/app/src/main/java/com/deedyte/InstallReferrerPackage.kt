package com.thetabeam.shopiva

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext

class InstallReferrerPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext) =
        listOf(InstallReferrerModule(context))

    override fun createViewManagers(context: ReactApplicationContext) =
        emptyList<com.facebook.react.uimanager.ViewManager<*, *>>()
}