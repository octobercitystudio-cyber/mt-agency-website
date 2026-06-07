import sqlite3

def check_db():
    try:
        conn = sqlite3.connect(r'\\MULTITASK1\d\حسابات الشركة\برنامج ادارة الشركة\agency.db')
        cursor = conn.cursor()
        cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        with open('db_schema.txt', 'w', encoding='utf-8') as f:
            for name, sql in tables:
                f.write(f"Table: {name}\n")
                f.write(f"{sql}\n")
                f.write("-" * 50 + "\n")
        conn.close()
    except Exception as e:
        with open('db_schema.txt', 'w', encoding='utf-8') as f:
            f.write(str(e))

if __name__ == '__main__':
    check_db()
