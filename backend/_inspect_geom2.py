import json
import sqlite3

conn = sqlite3.connect(r"d:\FRA-atlas-and-DSS\backend\fra_atlas.db")
c = conn.cursor()
c.execute("SELECT geometry FROM fra_geometries WHERE id=1")
obj = json.loads(c.fetchone()[0])
print(json.dumps(obj, indent=2))
c.execute("SELECT id, claim_id, applicant_name, village, district, status FROM fra_claims")
print("claims", c.fetchall())
