# تعليمات نشر R20.22 على Railway

1. احتفظ بنسخة احتياطية من ملفات المشروع وRailway Volume قبل النشر.
2. لا تغيّر متغيرات Firebase ولا تحذف Volume.
3. ارفع محتويات ZIP كاملة إلى GitHub/مصدر النشر، لا ترفع `index.html` وحده.
4. تأكد أن أمر البناء `npm run build` وأمر التشغيل `npm start` كما في `railway.json`.
5. استخدم Node `>=22.23.5 <23` كما هو محدد في `package.json`.
6. بعد النشر تحقق من نجاح Build، ثم افتح `/healthz` وافحص `/api/release` لمطابقة Build ID.
7. افتح صفحة إنشاء الطلب: يجب أن ترى شريط منصات يدوي التمرير بلا حركة تلقائية أو بطاقة خطوات كبيرة. تأكد أن اختيار المنصة والفئة والخدمة والطلب يعمل.
8. افتح القائمة الجانبية وتحقق من الملصقات الصغيرة، ومن بقاء روابط العناصر كما هي.

ملاحظة: إعداد Firebase القديم `config/siteEffects/platformCarousel` لا يتم حذفه؛ الإصدار لم يعد يقرأه أو يكتبه. لا توجد هجرة بيانات مطلوبة لهذا التغيير.

Build ID: SADA-3.2-R20.7-ORIGINAL-BASE-R20.15-R20.19-FIREBASE-CATALOG-EMPTY-ROOT-RECOVERY-R20.22-ORDER-UI-ROLLBACK-SIDEBAR-STICKERS-20261119
