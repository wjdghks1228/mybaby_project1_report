package kr.ssukssuk.report;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import org.json.JSONObject;
import android.webkit.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String SITE_HOST = "baby-ssukssuk-report.wjdghks1228607146.chatgpt.site";
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingBackup;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        setContentView(web);
        web.setPadding(0, 0, 0, 0);
        web.setFitsSystemWindows(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new BackupBridge(), "AndroidBackup");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && SITE_HOST.equals(uri.getHost()) && uri.getPath() != null && uri.getPath().startsWith("/api/")) return null;
                if (!"https".equals(uri.getScheme()) || !"app.ssukssuk.local".equals(uri.getHost())) return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                String path = uri.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.contains("..")) return null;
                String mime = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png" : "text/html";
                try { return new WebResourceResponse(mime, "UTF-8", getAssets().open(path.substring(1))); }
                catch (IOException e) { return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0])); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json");
                startActivityForResult(intent, 101); return true;
            }
        });
        Uri incoming = getIntent().getData();
        String fragment = incoming != null && SITE_HOST.equals(incoming.getHost()) ? incoming.getFragment() : null;
        String localUrl = "https://app.ssukssuk.local/";
        if (fragment != null && fragment.matches("invite=[a-f0-9]{64}")) localUrl += "#" + fragment;
        web.loadUrl(localUrl);
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        Uri uri = intent.getData();
        if (uri != null && "https".equals(uri.getScheme()) && SITE_HOST.equals(uri.getHost()) && uri.getFragment() != null && uri.getFragment().matches("invite=[a-f0-9]{64}")) {
            web.evaluateJavascript("typeof window.ssukssukJoin === 'function' && window.ssukssukJoin(" + JSONObject.quote(uri.toString()) + ")", null);
        }
    }
    private class BackupBridge {
        @JavascriptInterface public void shareText(String text) {
            Uri uri = Uri.parse(text);
            if (!"https".equals(uri.getScheme()) || !SITE_HOST.equals(uri.getHost()) || text.length() > 2000) return;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain"); intent.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(intent, "가족 초대 링크 공유"));
            });
        }
        @JavascriptInterface public void exportJson(String json) {
            if (json.length() > 10 * 1024 * 1024) return;
            runOnUiThread(() -> {
                pendingBackup = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "ssukssuk-backup.json");
                startActivityForResult(intent, 102);
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 101 && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null ? new Uri[]{data.getData()} : null);
            fileCallback = null;
        }
        if (request == 102 && result == RESULT_OK && data != null && pendingBackup != null) {
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                if (out != null) out.write(pendingBackup.getBytes(StandardCharsets.UTF_8));
            } catch (IOException e) { android.widget.Toast.makeText(this,"백업 저장에 실패했어요",android.widget.Toast.LENGTH_LONG).show(); }
        }
        if (request == 102) pendingBackup = null;
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("typeof window.ssukssukBack === 'function' && window.ssukssukBack()", value -> {
            if (!"true".equals(value)) {
                if (web.canGoBack()) web.goBack(); else MainActivity.super.onBackPressed();
            }
        });
    }
}
