صدى العراق — الإصدار 3.2 / R20.9
Build: SADA-3.2-R20.9-COMPACT-RECEIPT-ALL-ONLY-IMPORT-DESCRIPTIONS-20261118

التشغيل:
- Node.js 22.x
- npm install
- npm run build
- npm test
- npm start

Railway:
- Builder: Railpack
- Build command: npm run build
- Start command: npm start
- Health endpoint: /healthz

يشمل هذا الإصدار: تصغير بطاقة استلام الطلب وإظهار أزرارها، تحسين إضاءة وحركة اختيار المنصة، جعل «عروض صدى العراق» وجهة عامة منفصلة تظهر في صفحة «الكل» فقط، تحسين إظهار أزرار لوحة الإدارة، وجلب أوصاف الخدمات والأقسام من بيانات المزود عند توفرها.

راجع DEPLOY_R20.9_AR.md وRELEASE_NOTES_3.2_R20.9_AR.md قبل النشر. لا تغيّر إعدادات Firebase أو Railway Volume ولا تحذف بيانات الإنتاج. لم تُنشر هذه النسخة إلى Railway من داخل هذه الجلسة.
