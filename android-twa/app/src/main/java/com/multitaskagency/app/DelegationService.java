package com.multitaskagency.app;

import android.app.Notification;

public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public synchronized boolean onNotifyNotificationWithChannel(
            String platformTag,
            int platformId,
            Notification notification,
            String channelName) {
        // One event per stable tag. Summing cumulative counts inflates launcher badges.
        notification.number = 1;
        notification.priority = Notification.PRIORITY_HIGH;
        notification.visibility = Notification.VISIBILITY_PRIVATE;
        notification.defaults |= Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE;
        // Keep Android's channel permissions, sound choices and lock-screen privacy intact.
        return super.onNotifyNotificationWithChannel(platformTag, platformId, notification, channelName);
    }
}
