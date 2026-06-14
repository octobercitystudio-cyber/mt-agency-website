import sqlite3

db_file = 'company_ultra_v3.db'
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

print(f"--- Tables in {db_file} ---")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print([t[0] for t in tables])

for table in tables:
    table_name = table[0]
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    print(f"\n{table_name} has {count} records")
    
    if count > 0:
        cursor.execute(f"SELECT * FROM {table_name} LIMIT 1")
        print("Sample:", cursor.fetchone())
