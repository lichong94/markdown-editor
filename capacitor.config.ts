import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.local.markdowneditor',
  appName: 'Markdown 编辑器',
  webDir: 'dist-mobile',
  android: {
    backgroundColor: '#ffffff',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
