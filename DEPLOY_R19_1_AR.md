# تعليمات رفع صدى العراق R19.1

1. فك ضغط `SadaIraq_v3.2_R19_1_BUILD_FIX.zip`.
2. ارفع محتويات ZIP مباشرة إلى جذر مستودع GitHub المتصل بخدمة Railway، مع الحفاظ على أسماء المجلدات.
3. تأكد أن `package.json` و`server.js` و`index.html` و`config.json` موجودة في الجذر.
4. البناء لم يعد يعتمد على وجود مجلد `scripts/`؛ ومع ذلك ارفع كل المحتويات كما هي.
5. اترك Railway Builder على RAILPACK، وأمر البناء `npm run build`، وأمر التشغيل `npm start`.
6. لا تغيّر متغيرات البيئة، ولا تحذف Firebase أو Railway Volume.
7. بعد النشر افتح `/api/release` وتأكد من ظهور: `SADA-3.2-R19.1-INLINE-BUILD-PREFLIGHT-20261118`.
8. اختبر تسجيل دخول المدير، وفتح الإعدادات، والثلج التلقائي، ثم اختبر وظيفة غير مالية قبل أي طلب مدفوع.

## لماذا يصلح هذا الخطأ؟
في R17 كان الفحص داخل `package.json`. في R18.6/R19 صار يعتمد على `node scripts/preflight.js`. رسالة `MODULE_NOT_FOUND` مع `requireStack: []` أثناء أمر build تتوافق مع عدم وجود ملف الدخول المشار إليه في بيئة البناء. R19.1 يعيد الفحص إلى `package.json` حتى لا يتوقف البناء إذا لم يرفع مجلد `scripts/`.
