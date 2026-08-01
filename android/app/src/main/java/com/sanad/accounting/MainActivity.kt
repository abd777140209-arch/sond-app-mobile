package com.sanad.accounting

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity

/**
 * MainActivity for Sanad Accounting (نظام سند الذكي المحاسبي)
 * Extends Capacitor's BridgeActivity for full Capacitor plugin support (Filesystem, Share, etc.)
 * while maintaining native AndroidInterface bridge capabilities.
 */
class MainActivity : BridgeActivity() {

    private val PERMISSIONS_REQUEST_CODE = 1001

    class WebAppInterface(private val mContext: Context) {
        @JavascriptInterface
        fun getDeviceId(): String {
            return try {
                val androidId = Settings.Secure.getString(mContext.contentResolver, Settings.Secure.ANDROID_ID)
                if (androidId != null && androidId.trim().isNotEmpty()) androidId else ""
            } catch (e: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun showToast(message: String) {
            try {
                Toast.makeText(mContext, message, Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                // ignore
            }
        }

        @JavascriptInterface
        fun requestPermissions(permissions: Array<String>) {
            // Permission handler bridge
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestRequiredPermissions()

        try {
            bridge?.webView?.addJavascriptInterface(WebAppInterface(this@MainActivity as Context), "AndroidInterface")
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun requestRequiredPermissions() {
        val context: Context = this@MainActivity
        val activity: android.app.Activity = this@MainActivity

        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.INTERNET,
            Manifest.permission.ACCESS_NETWORK_STATE,
            Manifest.permission.VIBRATE,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
        } else {
            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }

        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(activity, missingPermissions.toTypedArray(), PERMISSIONS_REQUEST_CODE)
        }
    }
}

