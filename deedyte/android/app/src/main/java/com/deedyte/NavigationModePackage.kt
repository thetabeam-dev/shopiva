package com.thetabeam.shopiva

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

class NavigationModeModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "NavigationMode"

  @ReactMethod
  fun getNavigationMode(promise: Promise) {
    val mode = NavigationModeReader.read(reactApplicationContext)
    val result = Arguments.createMap()
    result.putInt("mode", mode)
    result.putString("name", NavigationModeReader.name(mode))
    promise.resolve(result)
  }
}

class NavigationModePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(NavigationModeModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
