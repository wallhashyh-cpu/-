صدى العراق — الإصدار 4.0
معرّف البناء: SADA-4.0-R21.6-OFFER-SECTION-LOGO-SELECTABLE-20261121

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
