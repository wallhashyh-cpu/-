صدى العراق — الإصدار 4.0
معرّف البناء: SADA-4.0-R21.4-OFFER-CATEGORY-SERVICES-FIX-20261121

مشروع Node.js للنشر على Railway.

أوامر التشغيل:
- البناء والفحص: npm run build
- الاختبارات: npm test
- التشغيل: npm start

إعدادات Railway:
- Builder: RAILPACK
- Build: npm run build
- Start: npm start
- Health check: /healthz
- Node: >=22.23.5 <23

الملفات المهمة:
- server.js: خادم التطبيق وواجهات API.
- index.html: الواجهة الأمامية.
- config.json وpackage.json: إعدادات الإصدار.
- BUILD_ID.txt وversion.txt: مؤشرات الإصدار والبناء.
- admin-auth.json: تجزئة اعتماد الإدارة؛ لا تشارك هذا الملف منفرداً.
- bundled-assets.json والوسائط: أصول التطبيق.
- catalog-backup.js: أدوات استعادة الكتالوج.
- tests/: اختبارات الإصدار والأرشيف التاريخي.

راجع RELEASE_REPORT_AR.md للتفاصيل وDEPLOY_R40_AR.md للنشر والتحقق.

تنبيه: لا تحذف Railway Volume ولا تغيّر متغيرات Firebase والمزودين عند التحديث. خذ نسخة احتياطية. لم يتم نشر هذه الحزمة على Railway الإنتاجي ضمن عملية إعدادها؛ يلزم التحقق من /api/release والواجهة بعد الرفع.


إصلاح R21.4 الإضافي: عند اختيار فئة مرتبطة بمنصة عروض صدى العراق لا تُستبعد خدماتها بسبب أن شبكة التنفيذ المسجلة Instagram أو TikTok. تم إصلاح ظهور شعار صدى العراق في أيقونات الفئة والخدمات داخل العروض فقط. اختبارات npm test: 22 مجموعة تحقق. لم يتم اختبار بيانات Firebase أو Railway الإنتاجية من هذه البيئة.
