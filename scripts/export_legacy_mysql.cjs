const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const source = path.resolve(process.argv[2] || 'company_ultra_v3.db');
const output = path.resolve(process.argv[3] || 'database/mysql/900_legacy_data.sql');
const reportPath = path.resolve(process.argv[4] || 'database/mysql/900_legacy_report.json');

if (!fs.existsSync(source)) {
  console.error(`SQLite backup not found: ${source}`);
  process.exit(1);
}

const quote = (value) => {
  if (value === null || value === undefined || value === '') return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\u0000/g, '')}'`;
};

const dateOnly = (value) => {
  if (!value) return null;
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
};

const timeOnly = (value) => {
  if (!value) return null;
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}:00`;
};

const roleMap = { 'مدير': 'owner', 'موظف': 'staff', owner: 'owner', admin: 'admin', staff: 'staff' };
const statusMap = {
  'مؤكد': 'confirmed', 'منتهي': 'completed', 'ملغي': 'cancelled', 'مرفوض': 'rejected',
  pending: 'pending', confirmed: 'confirmed', completed: 'completed', cancelled: 'cancelled',
};

const all = (db, sql) => new Promise((resolve, reject) => db.all(sql, [], (error, rows) => error ? reject(error) : resolve(rows)));

(async () => {
  const db = new sqlite3.Database(source, sqlite3.OPEN_READONLY);
  try {
    const [clients, services, bookings, finance, reminders, config, users] = await Promise.all([
      all(db, 'SELECT * FROM clients ORDER BY id'), all(db, 'SELECT * FROM services ORDER BY id'),
      all(db, 'SELECT * FROM bookings ORDER BY id'), all(db, 'SELECT * FROM finance ORDER BY id'),
      all(db, 'SELECT * FROM reminders ORDER BY id'), all(db, 'SELECT * FROM app_config ORDER BY key'),
      all(db, 'SELECT * FROM users ORDER BY id'),
    ]);

    const clientByName = new Map(clients.map(item => [String(item.name).trim(), item]));
    const serviceByName = new Map(services.map(item => [String(item.name).trim(), item]));
    const unresolvedClients = new Set();
    const lines = [
      '-- Generated from the legacy SQLite backup. Review the report before importing.',
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      'START TRANSACTION;',
    ];

    for (const item of clients) {
      lines.push(`INSERT INTO clients (id,organization_id,name,phone1,phone2,job,color,debt,credit,points,points_updated_at,dismissed_alerts,status) VALUES (${item.id},1,${quote(item.name)},${quote(item.phone1)},${quote(item.phone2)},${quote(item.job)},${quote(item.color || '#6D28D9')},${Number(item.debt || 0)},${Number(item.credit || 0)},${Number(item.points || 0)},${quote(dateOnly(item.points_updated_at))},${quote(item.dismissed_alerts)},'active') ON DUPLICATE KEY UPDATE name=VALUES(name),phone1=VALUES(phone1),phone2=VALUES(phone2),job=VALUES(job),color=VALUES(color),debt=VALUES(debt),credit=VALUES(credit),points=VALUES(points),dismissed_alerts=VALUES(dismissed_alerts);`);
    }

    for (const item of services) {
      const category = item.category || item.type || 'خدمة إضافية';
      const unit = category.includes('ريل') ? 'reel' : category.includes('يومية') ? 'day' : category.includes('شهرية') ? 'hour' : 'hour';
      lines.push(`INSERT INTO services (id,organization_id,name,category,billing_unit,price,total_hours,payment_due_hours,total_reels,validity_days,is_active) VALUES (${item.id},1,${quote(item.name)},${quote(category)},${quote(unit)},${Number(item.price || 0)},${Number(item.total_hours || 0)},${Number(item.payment_due_hours || 0)},${Number(item.total_reels || 0)},${Number(item.validity_days || 90)},1) ON DUPLICATE KEY UPDATE category=VALUES(category),billing_unit=VALUES(billing_unit),price=VALUES(price),total_hours=VALUES(total_hours),payment_due_hours=VALUES(payment_due_hours),total_reels=VALUES(total_reels),validity_days=VALUES(validity_days);`);
    }

    for (const item of bookings) {
      const client = clientByName.get(String(item.client_name || '').trim());
      if (!client) { unresolvedClients.add(item.client_name || '(empty)'); continue; }
      const service = serviceByName.get(String(item.service || '').replace(' (مؤرشف)', '').trim());
      const start = timeOnly(item.start_time); const end = timeOnly(item.end_time);
      let minutes = 0;
      if (start && end) {
        const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number);
        minutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      }
      const status = item.status === 'دفعة' ? 'payment_legacy' : (statusMap[item.status] || 'confirmed');
      lines.push(`INSERT INTO bookings (id,organization_id,client_id,service_id,resource_id,client_name,service,date,start_time,end_time,duration_minutes,requested_quantity,actual_hours,actual_reels,status,delivery_date,custom_price,discount,discount_reason,payment,notes,created_by) VALUES (${item.id},1,${client.id},${service ? service.id : 'NULL'},1,${quote(item.client_name)},${quote(item.service)},${quote(dateOnly(item.date))},${quote(start)},${quote(end)},${minutes},${minutes / 60},${Number(item.actual_hours || 0)},${Number(item.actual_reels || 0)},${quote(status)},${quote(dateOnly(item.delivery_date))},${item.custom_price == null ? 'NULL' : Number(item.custom_price)},${Number(item.discount || 0)},${quote(item.discount_reason)},${Number(item.payment || 0)},${quote(item.notes)},NULL) ON DUPLICATE KEY UPDATE client_id=VALUES(client_id),service_id=VALUES(service_id),status=VALUES(status),payment=VALUES(payment),notes=VALUES(notes);`);
    }

    for (const item of finance) {
      lines.push(`INSERT INTO finance (id,organization_id,type,amount,method,detail,date,entity,created_by) VALUES (${item.id},1,${quote(item.type)},${Number(item.amount || 0)},${quote(item.method)},${quote(item.detail)},${quote(dateOnly(item.date) || '2000-01-01')},${quote(item.entity || 'الشركة')},NULL) ON DUPLICATE KEY UPDATE type=VALUES(type),amount=VALUES(amount),method=VALUES(method),detail=VALUES(detail),date=VALUES(date),entity=VALUES(entity);`);
    }

    for (const item of reminders) {
      const due = item.due_date ? String(item.due_date).replace('T', ' ').replace('Z', '').slice(0, 19) : '2000-01-01 12:00:00';
      lines.push(`INSERT INTO reminders (id,organization_id,title,type,due_date,notify_before,is_recurring,status,amount,created_by) VALUES (${item.id},1,${quote(item.title)},${quote(item.type || 'task')},${quote(due)},${Number(item.notify_before || 0)},${item.is_recurring ? 1 : 0},${quote(item.status || 'pending')},${Number(item.amount || 0)},NULL) ON DUPLICATE KEY UPDATE title=VALUES(title),type=VALUES(type),due_date=VALUES(due_date),notify_before=VALUES(notify_before),is_recurring=VALUES(is_recurring),status=VALUES(status),amount=VALUES(amount);`);
    }

    for (const item of config) {
      if (item.key === 'admin_users') continue;
      lines.push(`INSERT INTO app_config (organization_id,\`key\`,value,type) VALUES (1,${quote(item.key)},${quote(item.value)},'text') ON DUPLICATE KEY UPDATE value=VALUES(value);`);
    }

    lines.push('COMMIT;', 'SET FOREIGN_KEY_CHECKS = 1;');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
    fs.writeFileSync(reportPath, JSON.stringify({
      source, generatedAt: new Date().toISOString(), counts: { clients: clients.length, services: services.length, bookings: bookings.length, finance: finance.length, reminders: reminders.length, config: config.length },
      unresolvedClientNames: [...unresolvedClients], skippedLegacyUsers: users.map(item => ({ username: item.username, full_name: item.full_name, legacyRole: item.role, mappedRole: roleMap[item.role] || 'staff', reason: 'Passwords are intentionally not migrated; create accounts through the secure owner screen.' })),
    }, null, 2), 'utf8');
    console.log(`Exported ${lines.length} SQL statements. Review: ${reportPath}`);
  } finally {
    db.close();
  }
})().catch(error => { console.error(error.message); process.exit(1); });
