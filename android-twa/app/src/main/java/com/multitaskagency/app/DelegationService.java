package com.multitaskagency.app;

import android.app.Notification;
import android.media.RingtoneManager;

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
        if (notification.sound == null) {
            notification.sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        // Keep Android's channel permissions, sound choices and lock-screen privacy intact.
        return super.onNotifyNotificationWithChannel(platformTag, platformId, notification, channelName);
    }
}
