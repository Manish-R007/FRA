from app.services.audit_service import record_audit, verify_audit_chain, calculate_block_hash
from app.models.audit import AuditLog

def test_cryptographic_audit_hash_chain(db_session):
    # Record multiple chained audit events
    log1 = record_audit(db_session, action="CREATE_CLAIM", entity="FRAClaim", entity_id="1", user_id=1, new_value={"test": "data1"})
    log2 = record_audit(db_session, action="UPDATE_GEOMETRY", entity="FRAGeometry", entity_id="1", user_id=1, new_value={"area": 2.4})
    log3 = record_audit(db_session, action="APPROVE_CLAIM", entity="FRAClaim", entity_id="1", user_id=1, new_value={"status": "APPROVED"})

    # Verify link: log2's previous_hash must equal log1's hash
    assert log2.previous_hash == log1.hash
    assert log3.previous_hash == log2.hash

    # Verify whole chain validity
    verif_res = verify_audit_chain(db_session)
    assert verif_res["is_valid"] is True
    assert verif_res["broken_block_id"] is None
