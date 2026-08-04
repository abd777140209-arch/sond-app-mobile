package com.sanad.accounting;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;

public class MainActivity extends BridgeActivity {

    private String jsonToSave = "";

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

    private final ActivityResultLauncher<String[]> openDocumentLauncher =
            registerForActivityResult(new ActivityResultContracts.OpenDocument(), uri -> {
                if (uri != null) {
                    try {
                        InputStream inputStream = getContentResolver().openInputStream(uri);
                        ByteArrayOutputStream result = new ByteArrayOutputStream();
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = inputStream.read(buffer)) != -1) {
                            result.write(buffer, 0, length);
                        }
                        String jsonString = result.toString("UTF-8");

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
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        }
    }

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
