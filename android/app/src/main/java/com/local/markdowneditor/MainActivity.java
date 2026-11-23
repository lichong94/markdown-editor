package com.local.markdowneditor;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // 必须在 super.onCreate 之前注册本地插件：bridge 在 super.onCreate 内创建并加载插件
    registerPlugin(SafeStoragePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
