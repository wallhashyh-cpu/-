صدى العراق — الإصدار 4.0
معرّف البناء: SADA-4.0-R21.9-PROVIDER-SERVICE-FLOW-FREE-OFFERS-20261121

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

راجع RELEASE_REPORT_AR.md للتفاصيل وDEPLOY_R40_AR.md للنشر والتحقق.

تنبيه: لا تتضمن الحزمة بيانات المستخدمين أو الطلبات أو الأرصدة المحلية داخل data/؛ لا تستبدل مجلد Railway Volume ولا تغيّر إعدادات Firebase عند النشر. خذ نسخة احتياطية أولاً.


التحديث R21.9: إعادة بناء إضافة الخدمات برقم المزود مع الاسم والوصف القابلين للتعديل ونسبة الربح، إضافة منصة عروض صدى العراق إلى إدارة الخدمات المجانية، ربط اختيار الأقسام بنطاق المنصة، وحفظ شعار المنصة محلياً مع سجل الخدمة. راجع RELEASE_REPORT_AR.md وDEPLOY_R40_AR.md.
