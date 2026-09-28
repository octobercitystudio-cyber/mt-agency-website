package com.multitaskagency.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import java.util.Locale;

/** Notification delivery is invoked by the verified browser even when no activity is open. */
public class StaffDelegationService extends DelegationService {
    @Override
    public synchronized boolean onNotifyNotificationWithChannel(String tag, int id,
            Notification notification, String channelName) {
        getSharedPreferences("mta_push_status", MODE_PRIVATE).edit()
                .putLong("received_at", System.currentTimeMillis()).apply();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            boolean posted = super.onNotifyNotificationWithChannel(tag, id, notification, channelName);
            recordDisplay(posted);
            return posted;
        }
        // Check the existing ABH channel before making any changes. Never bypass a user's block.
        if (!onAreNotificationsEnabled(channelName)) return false;
        NotificationManager manager = getSystemService(NotificationManager.class);
        // Keep android-browser-helper 2.7.2's high-priority ID so upgrades preserve user choices.
        String channelId = channelName.toLowerCase(Locale.ROOT).replace(' ', '_') + "_channel_id_high_pri";
        NotificationChannel channel = manager.getNotificationChannel(channelId);
        if (channel == null) {
            channel = new NotificationChannel(channelId, "إشعارات الإدارة", NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 220, 100, 220});
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        }
        channel.setName("إشعارات الإدارة");
        channel.setDescription("الحجوزات والطلبات وتحديثات الإدارة، مع الصوت وشارة التطبيق وشاشة القفل");
        manager.createNotificationChannel(channel);
        Notification publicVersion = new Notification.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_notification_icon).setContentTitle("MTA Team")
                .setContentText("لديك تحديث جديد في إدارة الشركة").build();
        Notification display = Notification.Builder.recoverBuilder(this, notification)
                .setChannelId(channelId).setSmallIcon(R.drawable.ic_notification_icon)
                .setNumber(1).setBadgeIconType(Notification.BADGE_ICON_SMALL)
                .setOnlyAlertOnce(false).setAutoCancel(true)
                .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicVersion)
                .setGroupAlertBehavior(Notification.GROUP_ALERT_ALL).build();
        try { manager.notify(tag, id, display); recordDisplay(true); return true; }
        catch (SecurityException denied) { return false; }
    }

    private void recordDisplay(boolean posted) {
        if (posted) getSharedPreferences("mta_push_status", MODE_PRIVATE).edit()
                .putLong("posted_at", System.currentTimeMillis()).apply();
    }
}
