package com.local.markdowneditor;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * 手机端文件持久化插件（Android 存储访问框架 SAF）
 *
 *  openDocument  : 系统文件选择器打开文件，返回 content:// URI（申请持久化权限，供后续保存覆盖）
 *  saveToUri     : 向已有 URI 写回内容（覆盖原文件，即"保存"）
 *  createDocument: 系统"保存到"对话框选择新位置并写入（即"另存为"）
 */
@CapacitorPlugin(name = "SafeStorage")
public class SafeStoragePlugin extends Plugin {

  @PluginMethod
  public void openDocument(PluginCall call) {
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("*/*");
    JSArray mimesArr = call.getArray("mimeTypes");
    if (mimesArr != null && mimesArr.length() > 0) {
      String[] mimes = new String[mimesArr.length()];
      for (int i = 0; i < mimesArr.length(); i++) {
        try {
          mimes[i] = String.valueOf(mimesArr.get(i));
        } catch (Exception ignored) {
          mimes[i] = "";
        }
      }
      intent.setType(mimes[0]);
      if (mimes.length > 1) {
        intent.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
      }
    }
    startActivityForResult(call, intent, "openDocumentResult");
  }

  @ActivityCallback
  private void openDocumentResult(PluginCall call, ActivityResult result) {
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
      call.reject("USER_CANCELLED");
      return;
    }
    try {
      Uri uri = result.getData().getData();
      takePersistablePermission(uri);
      String name = queryDisplayName(uri, call.getString("fallbackName"));
      String content = readAll(uri);
      JSObject ret = new JSObject();
      ret.put("uri", uri.toString());
      ret.put("name", name);
      ret.put("content", content);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("READ_FAILED: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void saveToUri(PluginCall call) {
    String uriStr = call.getString("uri");
    String content = call.getString("content");
    if (uriStr == null || content == null) {
      call.reject("MISSING_ARGS");
      return;
    }
    try {
      writeTo(Uri.parse(uriStr), content);
      call.resolve();
    } catch (Exception e) {
      call.reject("WRITE_FAILED: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void createDocument(PluginCall call) {
    String fileName = call.getString("fileName");
    String content = call.getString("content");
    String mime = call.getString("mimeType");
    if (fileName == null || content == null) {
      call.reject("MISSING_ARGS");
      return;
    }
    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType(mime != null ? mime : "text/plain");
    intent.putExtra(Intent.EXTRA_TITLE, fileName);
    startActivityForResult(call, intent, "createDocumentResult");
  }

  @ActivityCallback
  private void createDocumentResult(PluginCall call, ActivityResult result) {
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
      call.reject("USER_CANCELLED");
      return;
    }
    try {
      Uri uri = result.getData().getData();
      String content = call.getString("content");
      writeTo(uri, content);
      takePersistablePermission(uri);
      JSObject ret = new JSObject();
      ret.put("uri", uri.toString());
      ret.put("name", queryDisplayName(uri, call.getString("fileName")));
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("WRITE_FAILED: " + e.getMessage(), e);
    }
  }

  private void takePersistablePermission(Uri uri) {
    try {
      getContext().getContentResolver().takePersistableUriPermission(
          uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
    } catch (Exception ignored) {
      // 部分 Provider 不支持持久化授权，忽略即可（会话内权限仍然有效）
    }
  }

  private String queryDisplayName(Uri uri, String fallback) {
    try (Cursor c = getContext().getContentResolver().query(uri, null, null, null, null)) {
      if (c != null && c.moveToFirst()) {
        int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        if (idx >= 0) {
          return c.getString(idx);
        }
      }
    } catch (Exception ignored) {
    }
    return fallback != null ? fallback : "";
  }

  private String readAll(Uri uri) throws Exception {
    try (InputStream is = getContext().getContentResolver().openInputStream(uri)) {
      if (is == null) {
        throw new Exception("cannot open input stream");
      }
      ByteArrayOutputStream bos = new ByteArrayOutputStream();
      byte[] buf = new byte[8192];
      int n;
      while ((n = is.read(buf)) != -1) {
        bos.write(buf, 0, n);
      }
      return new String(bos.toByteArray(), StandardCharsets.UTF_8);
    }
  }

  private void writeTo(Uri uri, String content) throws Exception {
    try (OutputStream os = getContext().getContentResolver().openOutputStream(uri, "wt")) {
      if (os == null) {
        throw new Exception("cannot open output stream");
      }
      os.write(content.getBytes(StandardCharsets.UTF_8));
      os.flush();
    }
  }
}
