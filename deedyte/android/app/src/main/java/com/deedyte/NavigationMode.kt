package com.thetabeam.shopiva

import android.content.Context
import android.provider.Settings

object NavigationModeReader {
  const val THREE_BUTTON = 0
  const val TWO_BUTTON = 1
  const val GESTURE = 2

  fun read(context: Context): Int {
    return Settings.Secure.getInt(
      context.contentResolver,
      "navigation_mode",
      -1,
    )
  }

  fun name(mode: Int): String = when (mode) {
    THREE_BUTTON -> "3-button"
    TWO_BUTTON -> "2-button"
    GESTURE -> "gesture"
    else -> "unknown"
  }
}
