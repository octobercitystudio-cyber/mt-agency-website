package com.multitaskagency.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;



public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();

        
    }

    @Override
    public synchronized boolean onNotifyNotificationWithChannel(
            String platformTag,
            int platformId,
            Notification notification,
            String channelName) {
        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        int activeCount = 0;
        try {
            if (manager != null) activeCount = manager.getActiveNotifications().length;
        } catch (SecurityException ignored) {
            // Permission checks are handled by the trusted activity service.
        }
        notification.number = Math.max(1, activeCount + 1);
        notification.defaults |= Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE;
        return super.onNotifyNotificationWithChannel(platformTag, platformId, notification, channelName);
    }
}

