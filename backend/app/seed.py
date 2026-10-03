import datetime
import uuid
import random
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models.event import Event
from app.models.alert import Alert
from app.models.user import User
from app.core.security import get_password_hash

# Create tables without dropping strictly enforcing idempotence natively 
Base.metadata.create_all(bind=engine)

def generate_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}"

def seed():
    db = SessionLocal()
    now = datetime.datetime.utcnow()
    # SEED USERS Idempotently First!
    demo_users = [
        User(username="admin", email="admin@sigil.local", full_name="System Admin", 
             password_hash=get_password_hash("sigiladmin123"), role="SECURITY_ADMIN", is_active=True),
        User(username="analyst", email="analyst@sigil.local", full_name="Priya Dharshini", 
             password_hash=get_password_hash("analyst123"), role="SOC_ANALYST", is_active=True),
        User(username="senior", email="senior@sigil.local", full_name="Jane Doe", 
             password_hash=get_password_hash("senior123"), role="SENIOR_ANALYST", is_active=True),
        User(username="viewer", email="viewer@sigil.local", full_name="Guest Viewer", 
             password_hash=get_password_hash("viewer123"), role="VIEWER", is_active=True)
    ]
    for u in demo_users:
        db_user = db.query(User).filter(User.username == u.username).first()
        if not db_user:
            db.add(u)
        else:
            db_user.is_active = True
            db_user.role = u.role
    db.commit()
    
    print("Database mapped active users.")

    if db.query(Alert).first() is not None:
        print("Alerts exist. Skipping seed.")
        return

    events = []
    alerts = []

    # SCENARIO 1 — Account Compromise
    # Failed authentication -> repeated failures -> successful login -> suspicious activity -> related alert
    u1_now = now - datetime.timedelta(hours=2)
    s1_events = []
    for i in range(4):
        s1_events.append(Event(id=generate_id("EVT"), timestamp=u1_now + datetime.timedelta(seconds=i*30), event_type="Authentication", source="ActiveDirectory", action="LoginFailed", status="Failure", src_ip="192.168.1.45", username="svc_backup", hostname="DB-Server-01"))
    
    s1_events.append(Event(id=generate_id("EVT"), timestamp=u1_now + datetime.timedelta(seconds=150), event_type="Authentication", source="ActiveDirectory", action="LoginSuccess", status="Success", src_ip="192.168.1.45", username="svc_backup", hostname="DB-Server-01"))
    s1_events.append(Event(id=generate_id("EVT"), timestamp=u1_now + datetime.timedelta(seconds=160), event_type="Process", source="Sysmon", action="ProcessLaunch", status="Success", src_ip="192.168.1.45", username="svc_backup", hostname="DB-Server-01"))
    
    events.extend(s1_events)
    alerts.append(Alert(
        id=generate_id("ALT"), title="Account Compromise: Brute Force followed by Login", rule="brute_force_success",
        severity="CRITICAL", status="NEW", created_at=u1_now + datetime.timedelta(seconds=165),
        risk_score=94.0, confidence=95.0, entities=["192.168.1.45", "svc_backup", "DB-Server-01"],
        related_event_ids=[e.id for e in s1_events]
    ))

    # SCENARIO 2 — DNS / C2 Activity
    # Suspicious DNS query -> suspicious domain -> external connection -> endpoint activity -> DNS anomaly alert
    u2_now = now - datetime.timedelta(minutes=45)
    s2_events = []
    s2_events.append(Event(id=generate_id("EVT"), timestamp=u2_now, event_type="DNS", source="DNS-Server", action="Query", status="Success", src_ip="10.0.5.12", domain="rx.badserver.net"))
    s2_events.append(Event(id=generate_id("EVT"), timestamp=u2_now + datetime.timedelta(seconds=5), event_type="Network", source="Firewall", action="Connection", status="Success", src_ip="10.0.5.12", dst_ip="185.12.33.44", dst_port=443))
    s2_events.append(Event(id=generate_id("EVT"), timestamp=u2_now + datetime.timedelta(seconds=12), event_type="File", source="EndpointProtection", action="FileWrite", status="Success", src_ip="10.0.5.12", hostname="Workstation-HR"))
    
    events.extend(s2_events)
    alerts.append(Alert(
        id=generate_id("ALT"), title="Suspicious DNS Activity (C2 Beaconing)", rule="dns_c2_beacon",
        severity="HIGH", status="NEW", created_at=u2_now + datetime.timedelta(seconds=20),
        risk_score=88.0, confidence=82.0, entities=["10.0.5.12", "rx.badserver.net", "185.12.33.44", "Workstation-HR"],
        related_event_ids=[e.id for e in s2_events]
    ))

    # SCENARIO 3 — Lateral Movement
    # Initial compromise -> authentication to another host -> SMB/RDP activity -> second host accessed -> lateral movement alert
    u3_now = now - datetime.timedelta(minutes=90)
    s3_events = []
    s3_events.append(Event(id=generate_id("EVT"), timestamp=u3_now, event_type="Authentication", source="Windows", action="LoginSuccess", status="Success", src_ip="192.168.1.115", dst_ip="192.168.1.200", username="j.doe"))
    s3_events.append(Event(id=generate_id("EVT"), timestamp=u3_now + datetime.timedelta(seconds=10), event_type="Network", source="Firewall", action="Connection", status="Success", src_ip="192.168.1.115", dst_ip="192.168.1.200", dst_port=445))
    s3_events.append(Event(id=generate_id("EVT"), timestamp=u3_now + datetime.timedelta(seconds=15), event_type="Process", source="Windows", action="ServiceInstall", status="Success", src_ip="192.168.1.200", username="j.doe"))
    s3_events.append(Event(id=generate_id("EVT"), timestamp=u3_now + datetime.timedelta(seconds=20), event_type="Network", source="Firewall", action="Connection", status="Success", src_ip="192.168.1.115", dst_ip="192.168.1.200", dst_port=3389))
    
    events.extend(s3_events)
    alerts.append(Alert(
        id=generate_id("ALT"), title="Lateral Movement: Remote Service Installation", rule="lateral_movement_smb",
        severity="HIGH", status="NEW", created_at=u3_now + datetime.timedelta(seconds=30),
        risk_score=83.0, confidence=91.0, entities=["192.168.1.115", "192.168.1.200", "j.doe"],
        related_event_ids=[e.id for e in s3_events]
    ))

    # SCENARIO 4 — Privilege Escalation
    # Normal user activity -> suspicious privilege change -> privileged account activity -> privilege escalation alert
    u4_now = now - datetime.timedelta(minutes=15)
    s4_events = []
    s4_events.append(Event(id=generate_id("EVT"), timestamp=u4_now, event_type="Authentication", source="Windows", action="LoginSuccess", status="Success", src_ip="10.0.1.55", username="guest_user"))
    s4_events.append(Event(id=generate_id("EVT"), timestamp=u4_now + datetime.timedelta(seconds=10), event_type="Process", source="Sysmon", action="ProcessLaunch", status="Success", src_ip="10.0.1.55", username="guest_user"))
    s4_events.append(Event(id=generate_id("EVT"), timestamp=u4_now + datetime.timedelta(seconds=12), event_type="Account", source="ActiveDirectory", action="GroupModification", status="Success", src_ip="10.0.1.55", username="guest_user", hostname="DC-01"))
    s4_events.append(Event(id=generate_id("EVT"), timestamp=u4_now + datetime.timedelta(seconds=20), event_type="Authentication", source="Windows", action="LoginSuccess", status="Success", src_ip="10.0.1.55", username="Administrator"))
    
    events.extend(s4_events)
    alerts.append(Alert(
        id=generate_id("ALT"), title="Privilege Escalation: Local Group Modification", rule="privilege_escalation",
        severity="MEDIUM", status="NEW", created_at=u4_now + datetime.timedelta(seconds=25),
        risk_score=75.0, confidence=85.0, entities=["10.0.1.55", "guest_user", "Administrator", "DC-01"],
        related_event_ids=[e.id for e in s4_events]
    ))

    # SCENARIO 5 — Possible Data Exfiltration
    # Suspicious process -> external connection -> unusually large outbound transfer -> exfiltration alert
    u5_now = now - datetime.timedelta(hours=1)
    s5_events = []
    s5_events.append(Event(id=generate_id("EVT"), timestamp=u5_now, event_type="Process", source="Sysmon", action="ProcessLaunch", status="Success", src_ip="172.16.0.42", username="m.smith"))
    s5_events.append(Event(id=generate_id("EVT"), timestamp=u5_now + datetime.timedelta(seconds=5), event_type="Network", source="Firewall", action="Connection", status="Success", src_ip="172.16.0.42", dst_ip="85.44.11.2", dst_port=443))
    s5_events.append(Event(id=generate_id("EVT"), timestamp=u5_now + datetime.timedelta(seconds=300), event_type="Network", source="Firewall", action="Transfer", status="Success", src_ip="172.16.0.42", dst_ip="85.44.11.2", dst_port=443, bytes_transferred=850040000)) # 850MB
    
    events.extend(s5_events)
    alerts.append(Alert(
        id=generate_id("ALT"), title="Data Exfiltration: Large Outbound Transfer", rule="large_outbound_transfer",
        severity="LOW", status="NEW", created_at=u5_now + datetime.timedelta(seconds=305),
        risk_score=60.0, confidence=78.0, entities=["172.16.0.42", "85.44.11.2", "m.smith"],
        related_event_ids=[e.id for e in s5_events]
    ))

    # Add all to db
    for evt in events:
        db.add(evt)
    for alt in alerts:
        db.add(alt)
    
    db.commit()
    
    print(f"Database seeded with {len(events)} events, {len(alerts)} alerts, and validated 4 mapped active users.")

if __name__ == "__main__":
    seed()
