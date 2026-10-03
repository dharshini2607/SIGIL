from app.models.event import Event
from app.models.alert import Alert

class InvestigationTools:
    @staticmethod
    def get_alert_context(db, alert_id):
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise ValueError(f"Alert {alert_id} not found.")
        return {
            "title": alert.title,
            "rule": alert.rule,
            "severity": alert.severity,
            "entities": alert.entities,
            "related_event_ids": alert.related_event_ids
        }

    @staticmethod
    def get_timeline(db, allowed_event_ids):
        events = db.query(Event).filter(Event.id.in_(allowed_event_ids)).order_by(Event.timestamp.asc()).all()
        return [{"id": e.id, "type": e.event_type, "action": e.action, "timestamp": str(e.timestamp), "details": InvestigationTools._extract_details(e)} for e in events]
        
    @staticmethod
    def _extract_details(e):
        details = {}
        if e.src_ip: details["src_ip"] = e.src_ip
        if e.dst_ip: details["dst_ip"] = e.dst_ip
        if e.domain: details["domain"] = e.domain
        if e.username: details["username"] = e.username
        return details

    @staticmethod
    def validate_evidence(passed_ids, valid_ids):
        """Ensures the AI does not hallucinate scenario evidence"""
        valid_set = set(valid_ids)
        validated = [eid for eid in passed_ids if eid in valid_set]
        return validated
