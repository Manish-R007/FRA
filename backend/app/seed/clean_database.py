import os
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.document import Document, DocumentField
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic, Asset
from app.models.scheme import Scheme, SchemeRecommendation
from app.models.audit import AuditLog, Notification
from app.seed.seed_data import seed_system_essentials

def clean_database(purge_all_claims: bool = True):
    """
    Cleans the database by removing all dummy claims, polygons, satellite analyses,
    documents, and recommendations, and ensuring system essentials (users, schemes, RAG docs)
    are properly initialized and ready for real-time data upload.
    """
    print("--- Cleaning Database (Purging Dummy/Sample Data) ---")
    db: Session = SessionLocal()
    try:
        if purge_all_claims:
            print("Purging detected assets...")
            db.query(Asset).delete()

            print("Purging land cover statistics...")
            db.query(LandCoverStatistic).delete()

            print("Purging satellite analyses...")
            db.query(SatelliteAnalysis).delete()

            print("Purging boundary geometries...")
            db.query(FRAGeometry).delete()

            print("Purging document fields...")
            db.query(DocumentField).delete()

            print("Purging uploaded documents...")
            db.query(Document).delete()

            print("Purging scheme recommendations...")
            db.query(SchemeRecommendation).delete()

            print("Purging notifications...")
            db.query(Notification).delete()

            print("Purging FRA claims...")
            db.query(FRAClaim).delete()

            db.commit()
            print("Successfully purged all claims and geospatial records.")

        # Ensure essential RBAC users, schemes, and policy guidelines exist
        seed_system_essentials(db)
        print("--- Database is now CLEAN and ready for real-time data! ---")

    except Exception as e:
        db.rollback()
        print(f"Error during clean: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    clean_database(purge_all_claims=True)
