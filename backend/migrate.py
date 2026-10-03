import sqlite3
import sys

def migrate():
    conn = sqlite3.connect("sigil.db")
    try:
        print("Adding failure_reason constraint...")
        conn.execute("ALTER TABLE investigations ADD COLUMN failure_reason VARCHAR")
    except Exception as e:
        print("Skipped failure_reason:", str(e))
        
    try:
        print("Adding attempt_number tracking...")
        conn.execute("ALTER TABLE investigations ADD COLUMN attempt_number INTEGER DEFAULT 1")
    except Exception as e:
        print("Skipped attempt_number:", str(e))
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
    print("Migration sequence completed successfully.")
