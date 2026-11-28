# دليل نشر R21.53

1. خذ نسخة احتياطية من قاعدة Firebase وبيانات Railway Volume قبل الاستبدال.
2. تأكد من إعداد Node.js `>=22.23.0 <23` في Railway.
3. ارفع كامل محتويات الحزمة إلى جذر المشروع.
4. تحقق من `/healthz` و`/api/release` ومن أن `deploymentConsistent` تساوي `true` ومعرّف البناء ينتهي بـ `R21.53-ADMIN-INTERACTION-RESET-DEDUPED-LOADS-MOBILE-PERFORMANCE`.
5. باستخدام حساب الإدارة الفعلي، اختبر: نظرة عامة، المدفوعات، الطلبات، المستخدمون، الخدمات، إعدادات الخدمات، استرداد الخدمات، ثم اختبار إنشاء طلب تجريبي صغير.
6. راقب سجلات Railway/Firebase لأي `permission_denied` أو `401/403/5xx` أو `operation was aborted`. لا تعتمد النشر قبل نجاح هذه الفحوص الفعلية.

لا ترفع مفاتيح Firebase أو API داخل المحادثة.
