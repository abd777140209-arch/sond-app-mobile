package com.sanad.accounting

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * MainActivity for Sanad Accounting (نظام سند الذكي المحاسبي)
 * Configures WebView to load local bundled offline assets directly from assets/public/index.html.
 * Includes complete WebChromeClient.onShowFileChooser implementation for HTML file inputs.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val LOCAL_APP_URL = "file:///android_asset/public/index.html"
    private val PERMISSIONS_REQUEST_CODE = 1001
    private val FILE_CHOOSER_REQUEST_CODE = 1002

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

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

        private fun String?.isNullOrBlank(): Boolean {
            return this == null || this.trim().isEmpty()
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

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        setContentView(webView)

        requestRequiredPermissions()
        configureWebView()

        webView.loadUrl(LOCAL_APP_URL)
    }

    @Suppress("DEPRECATION")
    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false

        webView.addJavascriptInterface(WebAppInterface(this), "AndroidInterface")

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    view?.loadUrl(LOCAL_APP_URL)
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    request?.grant(request.resources)
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                // Reset existing callback if present
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }

                return try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE)
                    true
                } catch (e: Exception) {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = null
                    false
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return

            val results: Array<Uri>? = when {
                resultCode == RESULT_OK && data?.data != null -> arrayOf(data.data!!)
                resultCode == RESULT_OK && data?.clipData != null -> {
                    val count = data.clipData!!.itemCount
                    Array(count) { i -> data.clipData!!.getItemAt(i).uri }
                }
                else -> null
            }

            fileUploadCallback?.onReceiveValue(results)
            fileUploadCallback = null
        }
    }

    private fun requestRequiredPermissions() {
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
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missingPermissions.toTypedArray(), PERMISSIONS_REQUEST_CODE)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
