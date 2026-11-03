package com.bnb.business.network;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        final int splashGreen = Color.parseColor("#06822e");
        // Apply branded green window & system bar background BEFORE super.onCreate so there is zero white or black frame
        try {
            Window preWindow = getWindow();
            if (preWindow != null) {
                preWindow.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                preWindow.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                preWindow.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
                preWindow.setStatusBarColor(splashGreen);
                preWindow.setNavigationBarColor(splashGreen);
                preWindow.setBackgroundDrawable(new ColorDrawable(splashGreen));
                View decor = preWindow.getDecorView();
                if (decor != null) {
                    decor.setBackgroundColor(splashGreen);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        decor.setForceDarkAllowed(false);
                    }
                }
            }
        } catch (Exception ignored) {}

        super.onCreate(savedInstanceState);

        // Native Android Back Event handling: Fully intercept hardware button & predictive back gesture
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    final WebView webView = getBridge().getWebView();
                    webView.post(new Runnable() {
                        @Override
                        public void run() {
                            webView.evaluateJavascript(
                                "(function() { " +
                                "  if (window.navigationManager && typeof window.navigationManager.handleBack === 'function') { " +
                                "    return window.navigationManager.handleBack('native'); " +
                                "  } else if (window.history && window.history.length > 1) { " +
                                "    window.history.back(); " +
                                "    return true; " +
                                "  } " +
                                "  return false; " +
                                "})()", null);
                        }
                    });
                }
            }
        });

        // Native Android Status Bar & System Navigation Bar setup
        setupDarkGreenSystemBars();

        try {
            Window window = getWindow();
            if (window != null) {
                window.setBackgroundDrawable(new ColorDrawable(splashGreen));
                if (window.getDecorView() != null) {
                    window.getDecorView().setBackgroundColor(splashGreen);
                }
            }
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.setBackgroundColor(splashGreen);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    webView.setForceDarkAllowed(false);
                }
                if (webView.getParent() instanceof View) {
                    ((View) webView.getParent()).setBackgroundColor(splashGreen);
                }

                // Purge any stale cached index.html from WebView disk cache
                SharedPreferences prefs = getSharedPreferences("bnb_native_prefs", Context.MODE_PRIVATE);
                if (!prefs.getBoolean("cache_purged_v56", false)) {
                    webView.clearCache(true);
                    prefs.edit().putBoolean("cache_purged_v56", true).apply();
                }
                WebSettings settings = webView.getSettings();
                if (settings != null) {
                    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                }
            }
        } catch (Exception ignored) {}
    }

    private void setupDarkGreenSystemBars() {
        try {
            Window window = getWindow();
            if (window == null) return;

            // Ensure window enables status bar & navigation bar drawing
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);

            int darkGreenColor = Color.parseColor("#06822e");
            window.setStatusBarColor(darkGreenColor);
            window.setNavigationBarColor(darkGreenColor);

            // Icon & Navigation Bar Handle Contrast Management
            WindowInsetsControllerCompat insetsController =
                WindowCompat.getInsetsController(window, window.getDecorView());

            if (insetsController != null) {
                insetsController.setAppearanceLightStatusBars(false);
                insetsController.setAppearanceLightNavigationBars(false);
            }

            // Android 15+ (API 35+) Enforce Contrast Override to prevent gray overlay on navigation bar
            if (Build.VERSION.SDK_INT >= 35) {
                try {
                    window.getClass().getMethod("setEnforceNavigationBarContrast", boolean.class)
                        .invoke(window, false);
                    window.getClass().getMethod("setEnforceStatusBarContrast", boolean.class)
                        .invoke(window, false);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}