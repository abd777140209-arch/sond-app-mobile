package com.sanad.accounting;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private String jsonToSave = "";

    // 🎯 1. منتقي الحفظ المباشر من واجهة الأندرويد الرسمية (SAF)
    private final ActivityResultLauncher<String> createDocumentLauncher =
            registerForActivityResult(new ActivityResultContracts.CreateDocument("application/json"), uri -> {
                if (uri != null) {
                    try {
                        getContentResolver().openOutputStream(uri).write(jsonToSave.getBytes());
                        Toast.makeText(this, "✅ تم حفظ النسخة الاحتياطية بنجاح!", Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Toast.makeText(this, "❌ فشل الحفظ: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    }
                }
            });

    // 🎯 2. منتقي القراءة والاسترجاع المباشر من ذاكرة الجهاز
    private final ActivityResultLauncher<String[]> openDocumentLauncher =
            registerForActivityResult(new ActivityResultContracts.OpenDocument(), uri -> {
                if (uri != null) {
                    try {
                        byte[] bytes = getContentResolver().openInputStream(uri).readAllBytes();
                        String jsonString = new String(bytes);
                        
                        WebView webView = getBridge().getWebView();
                        if (webView != null) {
                            webView.post(() -> webView.evaluateJavascript(
                                    "window.onNativeRestoreSuccess && window.onNativeRestoreSuccess(" + jsonString + ")", null));
                        }
                        Toast.makeText(this, "✅ تم قراءة واسترجاع ملف البيانات بنجاح!", Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Toast.makeText(this, "❌ خطأ في قراءة الملف: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    }
                }
            });

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // ربط الجسر المباشر مع الـ WebView التابع لـ Capacitor
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        }
    }

    // 🎯 الجسر البرمجي بين أندرويد وReact / TypeScript
    public class AndroidBridge {
        @JavascriptInterface
        public void saveBackupNative(String jsonContent, String fileName) {
            jsonToSave = jsonContent;
            runOnUiThread(() -> createDocumentLauncher.launch(fileName));
        }

        @JavascriptInterface
        public void restoreBackupNative() {
            runOnUiThread(() -> openDocumentLauncher.launch(new String[]{"application/json", "*/*"}));
        }
    }
}
