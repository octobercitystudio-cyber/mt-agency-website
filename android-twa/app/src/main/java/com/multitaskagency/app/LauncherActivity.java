/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.multitaskagency.app;

import android.Manifest;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final int NOTIFICATION_PERMISSION = 104;
    private static final String WAITING_KEY = "mta.notification.permission.waiting";
    private boolean waitingForPermission;
    private boolean launched;

    @Override
    protected boolean shouldLaunchImmediately() { return false; }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (isFinishing()) return;
        setRequestedOrientation(Build.VERSION.SDK_INT > Build.VERSION_CODES.O
                ? ActivityInfo.SCREEN_ORIENTATION_PORTRAIT : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        waitingForPermission = savedInstanceState != null && savedInstanceState.getBoolean(WAITING_KEY);
        if (waitingForPermission) return;
        // Ask the system once at first launch, without an extra application button.
        // A previous refusal is never overridden or repeatedly prompted.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !getPreferences(MODE_PRIVATE).getBoolean("notification_permission_asked", false)) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("notification_permission_asked", true).apply();
            waitingForPermission = true;
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION);
        } else {
            continueLaunch();
        }
    }

    private void continueLaunch() {
        if (launched || isFinishing() || isDestroyed()) return;
        launched = true;
        launchTwa();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION) {
            waitingForPermission = false;
            continueLaunch(); // The application remains usable after Allow, Deny, or dismissal.
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putBoolean(WAITING_KEY, waitingForPermission);
    }
}
