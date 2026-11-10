package com.psi.brickbreaker;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /* Capacitor 6 does not handle the back key and @capacitor/app is not a
       dependency, so Android closed the app on every press - mid-rally
       included. Route the key to the game instead: window.bbBack() returns
       true when it handled the press (pause, close a popup, go up a screen)
       and false only where leaving the app is the right answer (Home). */
    private static final String ASK_GAME =
        "(function(){try{return !!(window.bbBack&&window.bbBack());}catch(e){return false;}})()";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() != null ? getBridge().getWebView() : null;
                if (web == null) {
                    finish();
                    return;
                }
                web.evaluateJavascript(ASK_GAME, (handled) -> {
                    if (!"true".equals(handled)) finish();
                });
            }
        });
    }
}
