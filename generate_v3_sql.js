import sqlite3 from 'sqlite3';
import fs from 'fs';

const dbFile = 'company_ultra_v3.db';

const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  }
});

let sql = 'BEGIN;\n\n';

db.serialize(() => {
  db.all("SELECT type, amount, method, detail, date, entity FROM finance", (err, rows) => {
    if (rows && rows.length > 0) {
      sql += `SELECT setval(pg_get_serial_sequence('finance', 'id'), COALESCE((SELECT MAX(id) FROM finance) + 1, 1), false);\n`;
      sql += 'INSERT INTO public.finance (type, amount, method, detail, date, entity) VALUES\n';
      const values = rows.map((row) => {
        const type = row.type ? `'${row.type.replace(/'/g, "''")}'` : 'NULL';
        const amount = row.amount !== null ? row.amount : 'NULL';
        const method = row.method ? `'${row.method.replace(/'/g, "''")}'` : 'NULL';
        const detail = row.detail ? `'${row.detail.replace(/'/g, "''")}'` : 'NULL';
        const date = row.date ? `'${row.date.replace(/'/g, "''")}'` : 'NULL';
        const entity = row.entity ? `'${row.entity.replace(/'/g, "''")}'` : 'NULL';
        return `(${type}, ${amount}, ${method}, ${detail}, ${date}, ${entity})`;
      });
      sql += values.join(',\n') + ';\n\n';
    }

    db.all("SELECT title, type, due_date, notify_before, is_recurring, status, amount FROM reminders", (err, rRows) => {
      if (rRows && rRows.length > 0) {
        sql += `SELECT setval(pg_get_serial_sequence('reminders', 'id'), COALESCE((SELECT MAX(id) FROM reminders) + 1, 1), false);\n`;
        sql += 'INSERT INTO public.reminders (title, type, due_date, notify_before, is_recurring, status, amount) VALUES\n';
        const values = rRows.map((row) => {
          const title = row.title ? `'${row.title.replace(/'/g, "''")}'` : 'NULL';
          const type = row.type ? `'${row.type.replace(/'/g, "''")}'` : 'NULL';
          const due_date = row.due_date ? `'${row.due_date.replace(/'/g, "''")}'` : 'NULL';
          const notify_before = row.notify_before !== null ? row.notify_before : 0;
          const is_recurring = row.is_recurring ? 'true' : 'false';
          const status = row.status ? `'${row.status.replace(/'/g, "''")}'` : 'NULL';
          const amount = row.amount !== null ? row.amount : 'NULL';
          return `(${title}, ${type}, ${due_date}, ${notify_before}, ${is_recurring}, ${status}, ${amount})`;
        });
        sql += values.join(',\n') + ';\n\n';
      }

      sql += 'COMMIT;\n';
      fs.writeFileSync('v3_migration_transaction.sql', sql);
      console.log(`Generated v3_migration_transaction.sql`);
      db.close();
    });
  });
});
