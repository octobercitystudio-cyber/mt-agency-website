# تطبيق MT Agency لأندرويد

التطبيق مبني كتطبيق Android موثوق يعرض الموقع الحي `https://multitaskagency.com`، ولذلك تظهر تحديثات الموقع داخله فور نشرها من دون إصدار APK جديد. يلزم إصدار جديد فقط عند تغيير اسم التطبيق أو الأيقونة أو معرّف الحزمة أو صلاحيات Android الأصلية.

## الملفات الحساسة

- احتفظ بنسخة آمنة من `android-twa/android.keystore` وكلمة مروره خارج الجهاز.
- لا تُرفع ملفات التوقيع إلى GitHub أو Hostinger.
- يجب توقيع كل تحديث مستقبلي بالمفتاح نفسه وإلا سيرفض Android تثبيته كتحديث.

## الثقة بين الموقع والتطبيق

ملف `public/.well-known/assetlinks.json` يربط نطاق الموقع بمعرّف الحزمة `com.multitaskagency.app` وبصمة مفتاح التوقيع. يجب نشره كما هو وبنوع محتوى JSON، ثم يمكن فحصه من:

`https://multitaskagency.com/.well-known/assetlinks.json`

## تفعيل إشعارات Firebase

1. أنشئ مشروع Firebase وأضف Web App باسم MT Agency.
2. فعّل Cloud Messaging وأنشئ Web Push certificate للحصول على مفتاح VAPID العام.
3. أنشئ Service Account للتطبيق، ونزّل ملف JSON وضعه خارج `public_html`.
4. في `api/config.php` فعّل قسم `push` وانسخ إعدادات Web App ومفتاح VAPID ومسار Service Account ومفتاح عامل طويلًا وعشوائيًا.
5. شغّل الترحيل `database/mysql/029_android_push_notifications.sql` على قاعدة Hostinger.
6. أضف Cron Job كل دقيقة:

```bash
curl -sS -X POST -H "X-Worker-Key: YOUR_LONG_PUSH_WORKER_KEY" https://multitaskagency.com/api/cron/push-queue
```

7. افتح التطبيق وسجّل الدخول واضغط **تفعيل الإشعارات**. تظهر نقطة/شارة على أيقونة التطبيق عند وجود إشعار نشط على أجهزة Android الداعمة.

إذا بقي `push.enabled` بقيمة `false` فلن يظهر طلب الإذن ولن تتأثر إشعارات البرنامج الداخلية الحالية.

## بناء APK جديد

1. غيّر `appVersionCode` و`appVersion` داخل `android-twa/twa-manifest.json` عند إصدار نسخة جديدة.
2. شغّل `npm run build` ثم `npm run android:update`.
3. اضبط متغيري `BUBBLEWRAP_KEYSTORE_PASSWORD` و`BUBBLEWRAP_KEY_PASSWORD` ثم شغّل `npm run android:build`.
4. اختبر التوقيع والرابط الكامل قبل التوزيع أو الرفع إلى Google Play.
