package com.sanad.accounting

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.URLUtil
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
import java.io.File
import java.io.FileOutputStream

/**
 * MainActivity for Sanad Accounting (com.sanad.accounting)
 * Configures WebView to load local bundled offline assets directly from assets/public/index.html.
 * Includes WebChromeClient.onShowFileChooser, native DownloadListener, and MediaStore Downloads bridge.
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

        @JavascriptInterface
        fun printReceipt(receiptText: String) {
            try {
                Toast.makeText(mContext, "جاري إرسال البيانات إلى الطابعة...", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                e.printStackTrace()
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
        fun saveBase64File(fileName: String, base64Data: String, mimeType: String): Boolean {
            return try {
                val cleanBase64 = if (base64Data.contains(",")) {
                    base64Data.substringAfter(",")
                } else {
                    base64Data
                }.replace("\\s".toRegex(), "")
                val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                val safeName = fileName.replace(Regex("[/\\\\?%*:|\"<>]"), "_").ifBlank { "sanad_file" }
                val cleanMime = mimeType.ifBlank { "application/octet-stream" }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                        put(MediaStore.Downloads.MIME_TYPE, cleanMime)
                        put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Sanad Accounting")
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val resolver = mContext.contentResolver
                    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    if (uri != null) {
                        resolver.openOutputStream(uri)?.use { out ->
                            out.write(bytes)
                        }
                        values.clear()
                        values.put(MediaStore.Downloads.IS_PENDING, 0)
                        resolver.update(uri, values, null, null)
                        return true
                    }
                }

                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val sanadDir = File(downloadsDir, "Sanad Accounting")
                if (!sanadDir.exists()) sanadDir.mkdirs()
                val outFile = File(sanadDir, safeName)
                FileOutputStream(outFile).use { it.write(bytes) }
                MediaScannerConnection.scanFile(mContext, arrayOf(outFile.absolutePath), arrayOf(cleanMime), null)
                true
            } catch (e: Exception) {
                e.printStackTrace()
                false
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

        val jsInterface = WebAppInterface(this)
        webView.addJavascriptInterface(jsInterface, "AndroidInterface")

        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            try {
                if (url.startsWith("data:")) {
                    val fileName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                    val saved = jsInterface.saveBase64File(fileName, url, mimetype ?: "application/octet-stream")
                    Toast.makeText(
                        this,
                        if (saved) "تم حفظ الملف في Download/Sanad Accounting" else "تعذر حفظ الملف",
                        Toast.LENGTH_LONG
                    ).show()
                } else if (url.startsWith("http://") || url.startsWith("https://")) {
                    val request = DownloadManager.Request(Uri.parse(url))
                    val fileName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                    request.setMimeType(mimetype)
                    request.addRequestHeader("User-Agent", userAgent)
                    request.setTitle(fileName)
                    request.setDescription("جاري التنزيل من Sanad Accounting...")
                    request.allowScanningByMediaScanner()
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "Sanad Accounting/$fileName")
                    val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(request)
                    Toast.makeText(this, "تم بدء تنزيل ($fileName) إلى مجلد التنزيلات", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

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
