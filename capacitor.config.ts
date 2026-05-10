import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.finduo.fingo',
  appName: 'FinDuo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#060A14',
  },
  plugins: {
    StatusBar: {
      // #53E3A6 matches the PWA theme-color; DARK = dark icons on the light teal bg
      backgroundColor: '#53E3A6',
      style: 'DARK',
      // Android 15 (targetSdkVersion=35) enforces edge-to-edge regardless of this
      // flag; set true so the WebView renders behind system bars and CSS
      // env(safe-area-inset-*) variables are populated correctly.
      overlaysWebView: true,
    },
  },
};

export default config;
