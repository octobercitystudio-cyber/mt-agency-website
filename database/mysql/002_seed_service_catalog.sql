SET NAMES utf8mb4;

INSERT INTO services (organization_id, name, category, billing_unit, price, total_hours, payment_due_hours, total_reels, validity_days)
VALUES
  (1, 'تصوير الاستديو بالساعة', 'تصوير بالساعة', 'hour', 0, 1, 0, 0, 90),
  (1, 'باقة تصوير يومية', 'باقة يومية', 'day', 0, 8, 0, 0, 30),
  (1, 'باقة استديو 10 ساعات', 'باقة شهرية', 'hour', 0, 10, 0, 0, 90),
  (1, 'تصوير ريل واحد', 'باقة ريلز', 'reel', 0, 0, 0, 1, 30),
  (1, 'باقة تصوير ريلز', 'باقة ريلز', 'reel', 0, 0, 0, 10, 90),
  (1, 'إدارة السوشيال ميديا', 'خدمة شهرية', 'month', 0, 0, 0, 0, 30),
  (1, 'إدارة الديجيتال ماركتنج', 'خدمة شهرية', 'month', 0, 0, 0, 0, 30),
  (1, 'تصوير إعلان', 'مشروع', 'project', 0, 0, 0, 0, 90)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  billing_unit = VALUES(billing_unit),
  validity_days = VALUES(validity_days);
