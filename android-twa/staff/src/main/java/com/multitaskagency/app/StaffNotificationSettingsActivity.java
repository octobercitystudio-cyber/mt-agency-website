package com.multitaskagency.app;

import android.app.Activity;
import android.Manifest;
import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.text.DateFormat;
import java.util.Date;
import java.util.Locale;

/** Read real Android state; never claim that sending a push proves audible delivery. */
public class StaffNotificationSettingsActivity extends Activity {
    private LinearLayout content;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
    }

    @Override
    protected void onResume() {
        super.onResume();
        render(); // Refresh after returning from any system setting.
    }

    private void render() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(249, 247, 253));
        scroll.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(22), dp(22), dp(22), dp(30));
        scroll.addView(content);
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(scroll);
        scroll.requestApplyInsets();
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        logo.setContentDescription("Multi Task Agency");
        content.addView(logo, new LinearLayout.LayoutParams(dp(64), dp(64)));
        line("إشعارات MTA Team", 24, Color.rgb(76, 29, 149));
        line("الصوت، شاشة القفل وشارة التطبيق", 18, Color.DKGRAY);

        NotificationManager manager = getSystemService(NotificationManager.class);
        boolean permitted = (Build.VERSION.SDK_INT < 24 || manager.areNotificationsEnabled())
                && (Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
        status(permitted ? "السماح بالإشعارات: مفعّل" : "السماح بالإشعارات: مغلق", permitted);
        AudioManager audio = getSystemService(AudioManager.class);
        boolean audible = audio.getRingerMode() == AudioManager.RINGER_MODE_NORMAL
                && audio.getStreamVolume(AudioManager.STREAM_NOTIFICATION) > 0;
        status(audible ? "صوت إشعارات الهاتف: مسموع" : "الهاتف صامت أو مستوى صوت الإشعارات صفر", audible);
        boolean dnd = manager.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_ALL;
        if (dnd) status("وضع عدم الإزعاج قد يمنع الصوت", false);
        if (Build.VERSION.SDK_INT >= 28 && getSystemService(ActivityManager.class).isBackgroundRestricted())
            status("النظام يقيّد عمل MTA Team في الخلفية", false);
        PowerManager power = getSystemService(PowerManager.class);
        if (power.isPowerSaveMode()) status("توفير البطارية مفعّل وقد يؤخّر وصول التنبيهات", false);

        button("الصوت وشاشة القفل وشارة الأيقونة", () -> {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    && shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 202);
            } else open(Build.VERSION.SDK_INT >= 26
                    ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                    : appDetails(getPackageName()));
        });
        if (Build.VERSION.SDK_INT >= 26) {
            for (NotificationChannel channel : manager.getNotificationChannels()) {
                boolean sound = channel.getSound() != null && channel.getImportance() >= NotificationManager.IMPORTANCE_DEFAULT;
                line("قناة «" + channel.getName() + "»: "
                        + (channel.getImportance() == NotificationManager.IMPORTANCE_NONE ? "مغلقة" : sound ? "بصوت" : "صامتة")
                        + " · الشارة " + (channel.canShowBadge() ? "مفعّلة" : "مغلقة"), 16, Color.DKGRAY);
                button("ضبط قناة «" + channel.getName() + "»", () -> open(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID, channel.getId())));
            }
        }
        line("العمل أثناء إغلاق الشاشة", 21, Color.rgb(76, 29, 149));
        String maker = Build.MANUFACTURER.toLowerCase(Locale.ROOT);
        if (maker.contains("xiaomi") || maker.contains("redmi") || maker.contains("poco"))
            line("شاومي: فعّل التشغيل التلقائي في الخلفية، واضبط توفير بطارية التطبيق على «بدون قيود». من الإشعارات فعّل الصوت، شاشة القفل، الإشعارات العائمة وشارات الأيقونة.", 17, Color.DKGRAY);
        else if (maker.contains("oppo") || maker.contains("realme") || maker.contains("oneplus"))
            line("أوبو: من استخدام البطارية اسمح بالنشاط في الخلفية، وفعّل التشغيل التلقائي إذا كان متاحًا. من الإشعارات فعّل الصوت، شاشة القفل، البانر والشارة الرقمية إن كانت مدعومة.", 17, Color.DKGRAY);
        else line("راجع السماح بالنشاط في الخلفية والتشغيل التلقائي من إعدادات الهاتف. تختلف أسماء الخيارات حسب الجهاز.", 17, Color.DKGRAY);
        button("بطارية التطبيق والتشغيل في الخلفية", () -> open(appDetails(getPackageName())));
        button("مراجعة تحسين استهلاك البطارية", () -> open(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)));
        line("النسخة الحالية تستقبل الإشعارات عن طريق المتصفح أيضًا؛ لو تستخدم Chrome راجع قيود البطارية والإشعارات الخاصة به. لو عندك تطبيق العملاء بجانب الإدارة، حدّث التطبيقين لتفادي تداخل الإشعارات.", 16, Color.DKGRAY);
        button("إعدادات Chrome", () -> open(appDetails("com.android.chrome")));

        line("آخر وصول إلى تطبيق الإدارة", 21, Color.rgb(76, 29, 149));
        SharedPreferences history = getSharedPreferences("mta_push_status", MODE_PRIVATE);
        long received = history.getLong("received_at", 0), posted = history.getLong("posted_at", 0);
        line(received == 0 ? "لم يستلم هذا الإصدار إشعارًا من المتصفح بعد. جرّب الإرسال من الخادم داخل البرنامج."
                : "استلم التطبيق إشعارًا: " + DateFormat.getDateTimeInstance().format(new Date(received)), 16, Color.DKGRAY);
        if (posted > 0) line("آخر طلب عرض لدى Android: " + DateFormat.getDateTimeInstance().format(new Date(posted)), 16, Color.DKGRAY);
        line("هذه الحالة لا تؤكد سماع الصوت. بعد ضبط الإعدادات اقفل الشاشة، وجرّب طلب حجز حقيقي من جهاز آخر. الإيقاف الإجباري، منع الإشعارات وعدم الإزعاج لا يمكن تجاوزها تلقائيًا. الرقم أو النقطة على الأيقونة تحددهما واجهة الهاتف والإشعارات النشطة.", 16, Color.DKGRAY);
        button("رجوع", this::finish);
    }

    private Intent appDetails(String packageName) {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + packageName));
    }

    private void open(Intent intent) {
        try { startActivity(intent); }
        catch (android.content.ActivityNotFoundException | SecurityException unavailable) {
            Toast.makeText(this, "هذا الاختصار غير متاح؛ افتح الإعداد المطلوب من إعدادات الهاتف.", Toast.LENGTH_LONG).show();
        }
    }

    private void status(String text, boolean ready) { line(text, 17, ready ? Color.rgb(18, 116, 82) : Color.rgb(170, 34, 48)); }
    private void line(String text, int size, int color) {
        TextView label = new TextView(this);
        label.setText(text); label.setTextSize(size); label.setTextColor(color);
        label.setPadding(0, dp(10), 0, dp(6)); label.setLineSpacing(dp(3), 1.1f);
        content.addView(label);
    }
    private void button(String text, Runnable action) {
        Button button = new Button(this);
        button.setText(text); button.setTextSize(16); button.setAllCaps(false);
        button.setMinHeight(dp(52)); button.setOnClickListener(view -> action.run());
        content.addView(button, new LinearLayout.LayoutParams(-1, -2));
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
