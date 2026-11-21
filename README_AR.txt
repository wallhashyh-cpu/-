صدى العراق — الإصدار 4.0
معرّف البناء: SADA-4.0-R21.1-ARABIC-CATALOG-ORDERS-WALLET-ADMIN-20261121

مشروع Node.js مخصص للنشر على Railway.

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
- admin-auth.json: بيانات اعتماد مجزأة؛ لا تنشر هذا الملف علناً.
- bundled-assets.json والوسائط: أصول التطبيق.
- catalog-backup.js: أدوات استعادة الكتالوج.

اقرأ RELEASE_REPORT_AR.md لتفاصيل التعديلات والاختبارات، وDEPLOY_R40_AR.md لخطوات النشر والتحقق بعد الرفع.

تنبيه: احتفظ بمتغيرات بيئة Railway الحالية وبـ Railway Volume. لا تحذف بيانات Firebase أو التخزين الدائم عند تحديث الإصدار. لم يتم نشر هذه النسخة على الإنتاج ضمن عملية تجهيز الحزمة.
