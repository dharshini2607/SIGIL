from app.agent.provider import GroqProvider
from app.agent.tools import InvestigationTools
from app.models.investigation import Investigation, AgentAudit, InvestigationFinding, Evidence
from app.models.alert import Alert
from app.core.config import settings
import datetime
import uuid
import logging

class InvestigationOrchestrator:
    @staticmethod
    def _create_audit(db, inv_id, tool, action, in_sum, res_sum, status, duration):
        log = AgentAudit(
            id=f"AUD-{uuid.uuid4().hex[:8]}", investigation_id=inv_id, timestamp=datetime.datetime.utcnow(),
            tool_name=tool, action=action, input_summary=in_sum, result_summary=res_sum,
            status=status, duration_ms=duration
        )
        db.add(log)
        db.commit()
        
    @staticmethod
    def determine_deterministic_defaults(rule, event_ids):
        """Fallback defaults mirroring the initial codebase logic without external LLM."""
        mappings = []
        if rule == "privilege_escalation":
            mappings.append({"technique": "T1078", "name": "Valid Accounts", "tactic": "Privilege Escalation", "evidence_ids": event_ids})
        elif rule == "dns_c2_beacon":
            mappings.append({"technique": "T1071.004", "name": "Application Layer Protocol: DNS", "tactic": "Command and Control", "evidence_ids": event_ids})
        elif rule == "brute_force_success":
            mappings.append({"technique": "T1110", "name": "Brute Force", "tactic": "Credential Access", "evidence_ids": event_ids})
        elif rule == "lateral_movement_smb":
            mappings.append({"technique": "T1021.002", "name": "Remote Services: SMB/Windows Admin Shares", "tactic": "Lateral Movement", "evidence_ids": event_ids})
        elif rule == "large_outbound_transfer":
            mappings.append({"technique": "T1048", "name": "Exfiltration Over Alternative Protocol", "tactic": "Exfiltration", "evidence_ids": event_ids})
            
        return mappings

    @staticmethod
    def run_investigation(db, alert_id):
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise ValueError("Alert not found")
            
        inv_id = alert.investigation_id
        if inv_id:
            existing = db.query(Investigation).filter(Investigation.id == inv_id).first()
            if existing and existing.status in ["INVESTIGATING", "INVESTIGATED", "COMPLETED"]:
                # Custom exception string so router handles 409 safely
                raise ValueError("HTTP_409: Active or Completed Investigation already exists for this alert")
            elif existing and existing.status == "FAILED":
                # Do NOT delete existing investigations or audit logs! Preserve the attempt metrics natively!
                existing.status = "INVESTIGATING"
                existing.attempt_number += 1
                existing.failure_reason = None
                investigation = existing
                db.commit()
        else:
            inv_id = f"INV-{uuid.uuid4().hex[:8]}"
            investigation = Investigation(
                id=inv_id, alert_id=alert_id, status="INVESTIGATING", attempt_number=1,
                created_at=datetime.datetime.utcnow()
            )
            db.add(investigation)
            alert.investigation_id = inv_id
            
        alert.status = "INVESTIGATING"
        db.commit()

        try:
            # Tool Execute: get_alert_context
            start_time = datetime.datetime.utcnow()
            context = InvestigationTools.get_alert_context(db, alert_id)
            dur = int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000)
            InvestigationOrchestrator._create_audit(db, inv_id, "get_alert_context", "Load Context", alert_id, "SUCCESS", "SUCCESS", dur)

            # Tool Execute: get_timeline
            start_time = datetime.datetime.utcnow()
            timeline = InvestigationTools.get_timeline(db, context["related_event_ids"])
            dur = int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000)
            InvestigationOrchestrator._create_audit(db, inv_id, "get_timeline", "Build Timeline", f"Mapped {len(timeline)} events", "SUCCESS", "SUCCESS", dur)

            # Prepare Provider
            schema = ["verdict", "executive_summary", "mitre_mappings", "recommended_actions", "findings"]
            
            prompt = f"""
            Analyze the following isolated investigation context.
            Alert Title: {context['title']}
            Rule: {context['rule']}
            Severity: {context['severity']}
            Entities: {context['entities']}
            Scope Limited Timeline: {timeline}
            
            Respond only with a JSON object matching this schema exactly:
            {{
                "verdict": "Suspicious" or "Benign",
                "executive_summary": "Summary of action",
                "findings": [
                   {{"title": "Title", "description": "Desc", "evidence_ids": ["EVT-XXX"]}}
                ],
                "mitre_mappings": [
                   {{"technique": "TXXXX", "name": "Name", "tactic": "Tactic", "evidence_ids": ["EVT-XXX"]}}
                ],
                "recommended_actions": ["Action 1", "Action 2"]
            }}
            """
            
            start_time = datetime.datetime.utcnow()
            try:
                ai_result = GroqProvider.generate(prompt, settings.GROQ_API_KEY, model_name="openai/gpt-oss-20b", is_json=True, required_fields=schema)
                dur = int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000)
                InvestigationOrchestrator._create_audit(db, inv_id, "report_generation", "Call Groq API", "Structured output generation", "API executed.", "SUCCESS", dur)
            except Exception as ai_e:
                dur = int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000)
                InvestigationOrchestrator._create_audit(db, inv_id, "report_generation", "Call Groq API", str(ai_e), "AI provider failed or returned invalid format.", "FAILED", dur)
                raise RuntimeError(f"PROVIDER_ERROR: {str(ai_e)}")

            # Evidence Validation Step (Crucial as requested by User)
            start_time = datetime.datetime.utcnow()
            valid_ids = context["related_event_ids"]
            
            # Sanitize findings
            for finding in ai_result["findings"]:
                finding["evidence_ids"] = InvestigationTools.validate_evidence(finding["evidence_ids"], valid_ids)
                
            # Sanitize mitre
            for mapping in ai_result["mitre_mappings"]:
                mapping["evidence_ids"] = InvestigationTools.validate_evidence(mapping["evidence_ids"], valid_ids)
            
            dur = int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000)
            InvestigationOrchestrator._create_audit(db, inv_id, "evidence_validation", "Validate Evidence IDs", f"Total events: {len(valid_ids)}", "SUCCESS", "SUCCESS", dur)
            
            # DB Persistence
            investigation.status = "INVESTIGATED"
            investigation.completed_at = datetime.datetime.utcnow()
            investigation.verdict = ai_result["verdict"]
            investigation.risk_score = alert.risk_score
            investigation.confidence = alert.confidence
            investigation.executive_summary = ai_result["executive_summary"]
            investigation.mitre_mappings = ai_result["mitre_mappings"]
            investigation.recommended_actions = ai_result["recommended_actions"]
            
            alert.status = "INVESTIGATED"
            
            # Findings linking
            for f in ai_result["findings"]:
                fid = f"FND-{uuid.uuid4().hex[:8]}"
                db.add(InvestigationFinding(id=fid, investigation_id=inv_id, title=f["title"], description=f["description"]))
                for eid in f["evidence_ids"]:
                    db.add(Evidence(id=f"EVD-{uuid.uuid4().hex[:8]}", finding_id=fid, event_id=eid))
                    
            db.commit()
            return {"status": "success", "investigation_id": inv_id}
            
        except Exception as e:
            err_msg = str(e)
            fail_reason = "INTERNAL_ERROR"
            if "PROVIDER_ERROR" in err_msg:
                fail_reason = "PROVIDER_ERROR"
            elif "TIMEOUT" in err_msg:
                fail_reason = "TIMEOUT"
            
            logging.error(f"Orchestrator Exception: {err_msg}")
            investigation.status = "FAILED"
            investigation.failure_reason = fail_reason
            investigation.completed_at = datetime.datetime.utcnow()
            alert.status = "FAILED"
            db.commit()
            InvestigationOrchestrator._create_audit(db, inv_id, "orchestrator_failure", "Process Transaction", err_msg, "Investigation halted due to exception", "FAILED", 0)
            raise e
