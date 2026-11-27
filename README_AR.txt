صدى العراق 4.0 — R21.43

الملخص:
إصدار تحسين الأداء والاستقرار وتجربة المستخدم وتقارير الإحصائيات.

المتطلبات:
- Node.js >=22.23.0 <23
- Railway Volume على /data
- SADA_DATA_DIR=/data/sada-data

البدء:
- npm install
- npm start

الفحص:
- npm test
- npm run test:load

مهم:
لا تحذف Railway Volume أو قاعدة Firebase عند تحديث الكود. ملفات البيانات الدائمة وسجلات المستخدمين والطلبات والأرصدة يجب أن تبقى كما هي.

راجع DEPLOY_R40_AR.md وتعليمات RELEASE_REPORT_AR.md للتفاصيل والقيود المعروفة.
