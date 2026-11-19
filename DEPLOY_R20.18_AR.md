# تعليمات نشر صدى العراق V3.2 R20.18

## سبب التصحيح

النسخة R20.17 ضبطت Railway على `npm test`. هذا الأمر يشغّل ملفات مثل `tests/smoke.js` وملفات اختبارات إضافية. عند رفع ملفات المشروع إلى GitHub من دون مجلد `tests`، يحاول Node تشغيل ملف اختبار غير موجود وينتهي بـ `MODULE_NOT_FOUND` مع `requireStack: []`، وهو متوافق مع رسالة لقطة الشاشة.

تمت مقارنة ذلك مع إعداد R20.15 الذي كان يعمل: `railway.json` فيها `buildCommand: npm run build`. أعيد هذا السلوك في R20.18.

## إعداد Railway

- Builder: `RAILPACK`
- Build command: `npm run build`
- Start command: `npm start`
- Health check: `/healthz`
- Node: `>=22.23.5 <23` كما كان في خط المشروع السابق.

لا يعتمد `npm run build` على مجلد `tests`؛ يفحص ملفات التشغيل الأساسية وعلامات الإصدار وتطابق إعداد Railway.

## الاختبارات

- `npm test`: تدقيق كامل محلياً عند وجود مجلد `tests`.
- `npm run build`: أمر النشر الذي تنفذه Railway ولا يحتاج ملفات الاختبار.

## الحفاظ على البيانات

لا تحذف Railway Volume أو تغيّر رابط Firebase أو بيانات حساب الخدمة. لم تتم أي كتابة على قاعدة الإنتاج من هذه البيئة.

بعد النشر، افحص `GET /healthz` وتأكد من ظهور Build ID الموجود في `BUILD_ID.txt`. إذا استمر فشل البناء، افتح Build Logs كاملة وأرسل أول سطر يبدأ بـ `Error: Cannot find module` لأن لقطة الشاشة الحالية تقطع اسم الملف المفقود.
