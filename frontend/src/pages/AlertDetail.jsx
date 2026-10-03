import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Play, AlertCircle, AlertTriangle, Cpu, Clock, CheckCircle, Search, Check, Activity, XCircle, User as UserIcon, Calendar } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { useAuth } from '../context/AuthContext';
import NotesPanel from '../components/NotesPanel';

const API_URL = 'http://localhost:8000/api/v1';

export default function AlertDetail() {
  const { id } = useParams();
  const [alert, setAlert] = useState(null);
  const [events, setEvents] = useState([]);
  const [investigation, setInvestigation] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [investigating, setInvestigating] = useState(false);
  const [activeTab, setActiveTab] = useState('report');
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoverNode, setHoverNode] = useState(null);

  // Analyst Assignment States
  const [analysts, setAnalysts] = useState([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    if (activeTab === 'graph' && containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight
      });

      const handleResize = () => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight
          });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (user && user.role !== 'VIEWER') {
      axios.get(`${API_URL}/users/eligible_analysts`)
        .then(res => setAnalysts(res.data))
        .catch(err => console.warn("Failed to fetch eligible analysts", err));
    }
  }, [user]);

  const [errorDetails, setErrorDetails] = useState(null);

  const fetchData = async () => {
    setErrorDetails(null);
    setLoading(true);
    try {
      const [alertRes, eventsRes] = await Promise.all([
        axios.get(`${API_URL}/alerts/${id}`),
        axios.get(`${API_URL}/events/by-alert/${id}`)
      ]);
      setAlert(alertRes.data);
      setEvents(eventsRes.data);

      try {
        const invRes = await axios.get(`${API_URL}/investigations/by-alert/${id}`);
        setInvestigation(invRes.data);

        if (invRes.data?.id) {
          try {
            const auditRes = await axios.get(`${API_URL}/investigations/${invRes.data.id}/audit`);
            setAuditLogs(auditRes.data || []);
          } catch (ae) {
            console.warn("Failed to fetch audit logs", ae);
          }
        }
      } catch (err) {
        if (err.response?.status !== 404) console.warn(err);
      }

    } catch (err) {
      console.error(err);
      setErrorDetails(err.response ? `API Error ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInvestigationData = async (alertId, invId) => {
    try {
      const [invRes, auditRes] = await Promise.all([
        axios.get(`${API_URL}/investigations/by-alert/${alertId}`),
        axios.get(`${API_URL}/investigations/${invId}/audit`)
      ]);
      setInvestigation(invRes.data);
      setAuditLogs(auditRes.data);
    } catch (err) {
      console.error("Failed to load investigation data", err);
    }
  };

  const handleInvestigate = async () => {
    setInvestigating(true);
    try {
      if (investigation && investigation.status === 'FAILED') {
        await axios.post(`${API_URL}/investigations/retry/${id}`);
      } else {
        await axios.post(`${API_URL}/investigations/run/${id}`);
      }
    } catch (err) {
      console.error(err);
      setErrorDetails(err.response ? `API Error ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message);
    } finally {
      await fetchData();
      setInvestigating(false);
    }
  };

  const [loadingAction, setLoadingAction] = useState(null); // Tracks 'mark', 'close', 'retry', etc.

  const handleMarkInvestigated = async () => {
    setLoadingAction('mark');
    try {
      await axios.post(`${API_URL}/alerts/${id}/mark_investigated`);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to mark as investigated");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCloseAlert = async () => {
    setLoadingAction('close');
    try {
      await axios.post(`${API_URL}/alerts/${id}/close`);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to close alert");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAssignAnalyst = async (userId) => {
    setLoadingAction('assign');
    try {
      await axios.post(`${API_URL}/alerts/${id}/assignment`, { user_id: userId });
      setAssignModalOpen(false);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Assignment failed");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUnassignAnalyst = async () => {
    setLoadingAction('unassign');
    try {
      await axios.delete(`${API_URL}/alerts/${id}/assignment`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Unassignment failed");
    } finally {
      setLoadingAction(null);
    }
  };

  const currentAssigneeObj = useMemo(() => {
    if (!alert?.assigned_to_id) return null;
    return analysts.find(a => a.id === alert.assigned_to_id) || { full_name: "Assigned Analyst", username: alert.assigned_to_id, role: "USER" };
  }, [alert?.assigned_to_id, analysts]);

  const graphData = useMemo(() => {
    if (!alert) return { nodes: [], links: [] };
    const nodesMap = new Map();
    const links = [];

    const addNode = (id, label, group) => {
      if (!id || nodesMap.has(id)) return;
      nodesMap.set(id, { id, label, group });
    };

    addNode(alert.id, alert.title, 'alert');

    events.forEach(evt => {
      if (evt.src_ip) addNode(evt.src_ip, evt.src_ip, 'ip');
      if (evt.dst_ip) addNode(evt.dst_ip, evt.dst_ip, 'ip');
      if (evt.domain) addNode(evt.domain, evt.domain, 'domain');
      if (evt.username) addNode(evt.username, evt.username, 'user');
      if (evt.hostname) addNode(evt.hostname, evt.hostname, 'host');
      if (evt.process_name) addNode(evt.process_name, evt.process_name, 'process');

      if (evt.event_type === 'Authentication' && evt.username && evt.src_ip) {
        links.push({ source: evt.username, target: evt.src_ip, label: 'authenticated_from' });
      }
      if (evt.event_type === 'Authentication' && evt.username && evt.hostname) {
        links.push({ source: evt.username, target: evt.hostname, label: 'authenticated_to' });
      }
      if (evt.event_type === 'Authentication' && evt.src_ip && evt.dst_ip) {
        links.push({ source: evt.src_ip, target: evt.dst_ip, label: 'authenticated' });
      }
      if (evt.event_type === 'Network' && evt.src_ip && evt.dst_ip) {
        links.push({ source: evt.src_ip, target: evt.dst_ip, label: 'connected_to' });
      }
      if (evt.event_type === 'Process' && evt.username && evt.process_name) {
        links.push({ source: evt.username, target: evt.process_name, label: 'executed' });
      }
      if (evt.event_type === 'Process' && evt.username && evt.src_ip) {
        links.push({ source: evt.username, target: evt.src_ip, label: 'executed_on' });
      }
      if (evt.event_type === 'DNS' && evt.src_ip && evt.domain) {
        links.push({ source: evt.src_ip, target: evt.domain, label: 'queried' });
      }
      if (evt.action === 'ServiceInstall' && evt.username && evt.src_ip) {
        links.push({ source: evt.username, target: evt.src_ip, label: 'installed_service' });
      }
      if (evt.action === 'FileWrite' && evt.src_ip && evt.hostname) {
        links.push({ source: evt.src_ip, target: evt.hostname, label: 'accessed_file' });
      }
      if (evt.action === 'GroupModification' && evt.username && evt.hostname) {
        links.push({ source: evt.username, target: evt.hostname, label: 'modified_group' });
      }
    });

    const entities = Array.isArray(alert?.entities) ? alert.entities : [];
    entities.forEach(ent => {
      if (nodesMap.has(ent)) {
        links.push({ source: alert.id, target: ent, label: 'triggered_by' });
      }
    });

    const nodes = Array.from(nodesMap.values());

    // Cross-link neighbors for instant hover highlighting performance
    nodes.forEach(n => { n.neighbors = []; n.links = []; });
    links.forEach(l => {
      const sourceNode = nodes.find(n => n.id === l.source);
      const targetNode = nodes.find(n => n.id === l.target);
      if (sourceNode && targetNode) {
        sourceNode.neighbors.push(targetNode);
        targetNode.neighbors.push(sourceNode);
        sourceNode.links.push(l);
        targetNode.links.push(l);
      }
    });

    return { nodes, links };
  }, [alert, events]);

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-critical/10 text-critical border-critical/30';
      case 'HIGH': return 'bg-high/10 text-high border-high/30';
      case 'MEDIUM': return 'bg-medium/10 text-medium border-medium/30';
      default: return 'bg-low/10 text-low border-low/30';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
        <div className="text-textMuted font-mono uppercase tracking-widest text-xs">Loading alert...</div>
      </div>
    );
  }

  if (errorDetails) {
    const is404 = errorDetails.includes("404");
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center font-mono space-y-6">
        <AlertTriangle size={48} className={is404 ? "text-low" : "text-critical"} />
        <div className="space-y-2">
          <h2 className="text-xl font-bold uppercase tracking-widest text-textMain">
            {is404 ? "Alert Not Found" : "Unable to load alert"}
          </h2>
          <p className="text-xs text-textMuted max-w-md break-all border border-border bg-surface p-3 rounded">
            Alert ID: {id}<br /><br />
            <span className="text-critical">{errorDetails?.toString()}</span>
          </p>
        </div>
        <div className="flex gap-4">
          <Link to="/" className="px-6 py-2 bg-surface border border-border hover:bg-border/30 rounded uppercase tracking-widest text-xs transition-colors">
            Return to Alert Queue
          </Link>
          {!is404 && (
            <button onClick={fetchData} className="px-6 py-2 bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 rounded uppercase tracking-widest text-xs transition-colors">
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!alert) {
    return <div className="p-8 text-center text-critical font-mono uppercase tracking-widest text-xs">Alert completely empty.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 h-full pb-8 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-start gap-4">
          <Link to="/" className="p-2 bg-surface hover:bg-border/30 rounded border border-border transition-colors mt-1">
            <ArrowLeft size={16} className="text-textMuted" />
          </Link>
          <div>
            <div className="text-sm font-semibold text-textMain uppercase tracking-widest mb-1">{alert.title}</div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${getSeverityStyle(alert.severity)}`}>
                {alert.severity}
              </span>
              <span className="text-textMuted text-xs">{alert.id}</span>
              {alert.status === 'INVESTIGATED' && (
                <span className="bg-high/10 text-high border border-high/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 tracking-widest">
                  <Check size={10} /> INVESTIGATED
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {alert?.status !== 'CLOSED' && user?.role !== 'VIEWER' && (
            <button
              onClick={handleMarkInvestigated}
              disabled={alert?.status === 'INVESTIGATED' || loadingAction || investigating}
              className="font-semibold text-xs tracking-widest uppercase py-2 px-4 rounded border transition-colors disabled:opacity-50 flex items-center gap-2 bg-surface border-border text-textMuted hover:text-textMain"
            >
              {loadingAction === 'mark' ? <Cpu size={14} className="animate-spin" /> : <CheckCircle size={14} />} Mark Inv.
            </button>
          )}

          {alert?.status !== 'CLOSED' && (user?.role === 'SENIOR_ANALYST' || user?.role === 'SECURITY_ADMIN') && (
            <button
              onClick={handleCloseAlert}
              disabled={loadingAction || investigating}
              className="font-semibold text-xs tracking-widest uppercase py-2 px-4 rounded border transition-colors disabled:opacity-50 flex items-center gap-2 bg-critical/10 border-critical/50 text-critical hover:bg-critical/20"
            >
              {loadingAction === 'close' ? <Cpu size={14} className="animate-spin" /> : <XCircle size={14} />} Close Alert
            </button>
          )}

          <button
            onClick={handleInvestigate}
            disabled={investigating || alert.status === 'INVESTIGATED' || alert.status === 'CLOSED'}
            className={`font-semibold text-xs tracking-widest uppercase py-2 px-6 rounded border transition-colors disabled:opacity-50 flex items-center gap-2 ${alert.status === 'INVESTIGATED' || alert.status === 'CLOSED' ? 'bg-surface border-border text-textMuted' : 'bg-primary/10 border-primary/50 text-primary hover:bg-primary/20'
              }`}
          >
            {investigating ? (
              <><Cpu size={14} className="animate-pulse" /> Investigating...</>
            ) : alert.status === 'INVESTIGATED' || alert.status === 'CLOSED' ? (
              <><CheckCircle size={14} /> Investigation Complete</>
            ) : (
              <><Play size={14} /> Run AI Investigation</>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">

        {/* Left Column: Context & Timeline */}
        <div className="col-span-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          <div className="card p-5 border-border/50">
            <h3 className="font-semibold text-xs uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-border pb-3 text-textMuted">
              <AlertCircle size={14} /> Investigation Overview
            </h3>
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-textMuted uppercase tracking-widest">Rule</span>
                <span className="text-textMain">{alert.rule}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-textMuted uppercase tracking-widest">Risk Score</span>
                <span className="text-textMain">{alert?.risk_score != null ? Number(alert.risk_score).toFixed(0) : 'N/A'}/100</span>
              </div>
              <div>
                <div className="text-textMuted uppercase tracking-widest mb-2 mt-4">Involved Entities</div>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(alert?.entities) && alert.entities.length > 0 ? alert.entities.map(ent => (
                    <span key={ent} className="bg-surface px-2 py-1 rounded text-[10px] border border-border text-textMain uppercase tracking-widest">
                      {ent}
                    </span>
                  )) : (
                    <span className="text-textMuted text-xs">No entities linked.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5 border-border/50">
            <h3 className="font-semibold text-xs uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-border pb-3 text-textMuted">
              <UserIcon size={14} /> Assigned Analyst
            </h3>
            <div className="space-y-4 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-textMuted uppercase tracking-widest">Assignee</span>
                {currentAssigneeObj ? (
                  <span className="text-primary font-bold uppercase tracking-widest bg-primary/10 px-2 py-1 rounded border border-primary/30">
                    {currentAssigneeObj.username}
                  </span>
                ) : (
                  <span className="text-textMuted/50 uppercase tracking-widest">UNASSIGNED</span>
                )}
              </div>

              {currentAssigneeObj && (
                <div className="flex justify-between items-center">
                  <span className="text-textMuted uppercase tracking-widest">Role</span>
                  <span className="text-textMain/80 uppercase tracking-widest">{currentAssigneeObj.role}</span>
                </div>
              )}

              {user?.role !== 'VIEWER' && (
                <div className="pt-3 border-t border-border/50 flex flex-col gap-2">
                  <button
                    onClick={() => setAssignModalOpen(true)}
                    disabled={loadingAction}
                    className="w-full bg-surface hover:bg-border/30 text-textMain border border-border py-2 rounded uppercase tracking-widest transition-colors font-semibold"
                  >
                    {currentAssigneeObj ? "Reassign" : "Assign"}
                  </button>
                  {currentAssigneeObj && (
                    <button
                      onClick={handleUnassignAnalyst}
                      disabled={loadingAction}
                      className="w-full bg-critical/10 hover:bg-critical/20 text-critical border border-critical/30 py-2 rounded uppercase tracking-widest transition-colors font-semibold"
                    >
                      Unassign
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card p-5 flex-1 border-border/50">
            <h3 className="font-semibold text-xs uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-border pb-3 text-textMuted">
              <Clock size={14} /> Investigation Timeline
            </h3>
            <div className="relative border-l border-border ml-2 space-y-6">
              {[...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map((evt, idx) => (
                <div key={evt.id} className="relative pl-6">
                  <div className="absolute -left-1.5 top-1.5 w-3 h-3 bg-background rounded-full border-2 border-border" />
                  <div className="text-[10px] text-textMuted mb-1 tracking-widest">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="bg-surface border border-border rounded p-3 text-xs">
                    <div className="font-semibold mb-2 text-primary tracking-widest uppercase">{evt.event_type} - {evt.action}</div>
                    <div className="text-textMuted space-y-1">
                      {evt.src_ip && <div>SRC: <span className="text-textMain">{evt.src_ip}</span></div>}
                      {evt.dst_ip && <div>DST: <span className="text-textMain">{evt.dst_ip}</span></div>}
                      {evt.domain && <div>DOMAIN: <span className="text-textMain">{evt.domain}</span></div>}
                      {evt.username && <div>USER: <span className="text-textMain">{evt.username}</span></div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI Workbench */}
        <div className="col-span-2 flex flex-col h-full card overflow-hidden border-border/50">
          <div className="border-b border-border flex bg-surface">
            <div
              onClick={() => setActiveTab('report')}
              className={`px-6 py-3 font-semibold text-xs tracking-widest uppercase cursor-pointer transition-colors border-b-2 ${activeTab === 'report' ? 'text-primary border-primary bg-background' : 'text-textMuted border-transparent hover:text-textMain'}`}
            >
              AI Investigation Report
            </div>
            <div
              onClick={() => setActiveTab('audit')}
              className={`px-6 py-3 font-semibold text-xs tracking-widest uppercase cursor-pointer transition-colors border-b-2 ${activeTab === 'audit' ? 'text-primary border-primary bg-background' : 'text-textMuted border-transparent hover:text-textMain'}`}
            >
              Agent Audit
            </div>
            <div
              onClick={() => setActiveTab('graph')}
              className={`px-6 py-3 font-semibold text-xs tracking-widest uppercase cursor-pointer transition-colors border-b-2 ${activeTab === 'graph' ? 'text-primary border-primary bg-background' : 'text-textMuted border-transparent hover:text-textMain'}`}
            >
              Entity Graph
            </div>
            <div
              onClick={() => setActiveTab('notes')}
              className={`px-6 py-3 font-semibold text-xs tracking-widest uppercase cursor-pointer transition-colors border-b-2 ${activeTab === 'notes' ? 'text-primary border-primary bg-background' : 'text-textMuted border-transparent hover:text-textMain'}`}
            >
              Analyst Notes
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-background">
            {activeTab === 'report' && (
              investigation ? (
                investigation.status === 'FAILED' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <AlertTriangle size={48} className="text-critical mx-auto" />
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold tracking-widest uppercase text-critical">Investigation Failed</h3>
                      <p className="text-xs text-textMuted max-w-sm rounded p-4 bg-surface border border-border">
                        The automated agent encountered a critical boundary or provider error. Please check the Agent Audit trace for specifics.
                      </p>
                    </div>
                    <button onClick={handleInvestigate} disabled={investigating} className="px-6 py-2 bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 rounded uppercase tracking-widest text-xs transition-colors flex items-center gap-2">
                      {investigating ? <><Cpu size={14} className="animate-spin" /> Retrying...</> : <><Play size={14} /> Retry Investigation</>}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">

                    {/* Report Header */}
                    <div className="flex gap-4">
                      <div className="flex-1 bg-surface border border-border p-4 rounded flex items-center justify-between">
                        <div>
                          <div className="text-textMuted text-[10px] uppercase tracking-widest mb-1">Verdict</div>
                          <div className={`text-lg font-bold uppercase tracking-widest ${investigation.verdict === 'Suspicious' ? 'text-critical' : 'text-low'}`}>
                            {investigation.verdict || "UNKNOWN"}
                          </div>
                        </div>
                        <AlertTriangle size={24} className={investigation.verdict === 'Suspicious' ? 'text-critical/50' : 'text-low/50'} />
                      </div>
                      <div className="flex-1 bg-surface border border-border p-4 rounded flex items-center justify-between">
                        <div>
                          <div className="text-textMuted text-[10px] uppercase tracking-widest mb-1">Risk Score</div>
                          <div className="text-lg font-bold text-high uppercase tracking-widest">
                            {investigation.risk_score || 0} / 100
                          </div>
                        </div>
                        <Activity size={24} className="text-high/50" />
                      </div>
                      <div className="flex-1 bg-surface border border-border p-4 rounded flex items-center justify-between">
                        <div>
                          <div className="text-textMuted text-[10px] uppercase tracking-widest mb-1">Confidence</div>
                          <div className="text-lg font-bold text-primary uppercase tracking-widest">
                            {investigation.confidence || 0}%
                          </div>
                        </div>
                        <CheckCircle size={24} className="text-primary/50" />
                      </div>
                    </div>

                    {/* Summary */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest border-b border-border pb-2 mb-3 text-textMuted">Executive Summary</h3>
                      <p className="text-textMain leading-relaxed text-sm">
                        {investigation.executive_summary || "Generating..."}
                      </p>
                    </div>

                    {/* MITRE */}
                    {investigation.mitre_mappings && investigation.mitre_mappings.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest border-b border-border pb-2 mb-3 flex items-center gap-2 text-textMuted">
                          <Search size={14} /> MITRE ATT&CK
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {investigation.mitre_mappings.map((m, i) => (
                            <div key={i} className="bg-surface border border-border p-3 rounded">
                              <div className="text-[10px] text-ai font-bold tracking-widest mb-1">{m.technique}</div>
                              <div className="font-semibold text-textMain text-sm uppercase tracking-wide">{m.name}</div>
                              <div className="text-[10px] text-textMuted mt-2 uppercase tracking-widest">{m.tactic}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {investigation.recommended_actions && investigation.recommended_actions.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest border-b border-border pb-2 mb-3 text-textMuted">Recommended Analyst Actions</h3>
                        <ul className="space-y-2 text-textMain text-sm">
                          {investigation.recommended_actions.map((act, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-primary">•</span>
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  </div>
                )
              ) : investigating ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-ai/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-ai border-t-transparent rounded-full animate-spin"></div>
                    <Cpu size={32} className="absolute inset-0 m-auto text-ai" />
                  </div>
                  <h3 className="text-lg font-bold tracking-widest uppercase text-textMain">Agent is Investigating...</h3>
                  <div className="text-xs text-textMuted space-y-3 font-mono text-left bg-surface p-6 rounded border border-border max-w-md w-full">
                    <div className="flex items-center gap-3"><span className="text-low">✓</span> Loaded alert context</div>
                    <div className="flex items-center gap-3 text-ai animate-pulse border-l-2 border-ai pl-2">Correlating events...</div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-textMuted">
                  <Cpu size={48} className="mx-auto mb-4 opacity-50" />
                  <h3 className="text-sm font-bold uppercase tracking-widest mb-2 text-textMain">Investigation Pending</h3>
                  <p className="text-xs max-w-sm tracking-wide">Click "Run AI Investigation" to let SIGIL analyze evidence, build an attack timeline, and map to MITRE ATT&CK techniques.</p>
                </div>
              )
            )}

            {activeTab === 'audit' && (
              investigation ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-widest border-b border-border pb-2 mb-4 text-textMuted">Agent Execution Trace</h3>
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log, i) => (
                      <div key={log.id} className="bg-surface border border-border rounded p-4 text-xs">
                        <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                          <span className="text-ai font-bold uppercase tracking-widest">{log.tool_name}</span>
                          <div className="flex items-center gap-2">
                            <span className={log.status === 'SUCCESS' ? 'text-primary' : 'text-critical'}>{log.status}</span>
                            <span className="text-textMuted">| {log.duration_ms}ms</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-3">
                          <span className="text-textMuted uppercase tracking-widest">Time</span>
                          <span className="text-textMain opacity-80">{new Date(log.timestamp + 'Z').toLocaleString()}</span>
                          <span className="text-textMuted uppercase tracking-widest">Action</span>
                          <span className="text-textMain">{log.action}</span>
                          <span className="text-textMuted uppercase tracking-widest">Input</span>
                          <span className="text-textMain break-all opacity-80">{log.input_summary}</span>
                          <span className="text-textMuted uppercase tracking-widest">Result</span>
                          <span className="text-primary">{log.result_summary}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-border rounded">
                      <p className="text-xs uppercase tracking-widest text-textMuted">No agent execution records available</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-textMuted">
                  <p className="text-xs uppercase tracking-widest">No audit logs available. Run investigation first.</p>
                </div>
              )
            )}

            {activeTab === 'notes' && (
              <NotesPanel alertId={id} />
            )}

            {activeTab === 'graph' && (
              graphData.nodes.length <= 1 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-textMuted p-8">
                  <Activity size={48} className="mx-auto mb-4 opacity-30" />
                  <h3 className="text-sm font-bold uppercase tracking-widest mb-2 text-textMain">NO ENTITY RELATIONSHIPS</h3>
                  <p className="text-xs max-w-sm tracking-wide">No correlated entities or network events were mapped for this alert.</p>
                </div>
              ) : (
                <div ref={containerRef} className="h-full w-full bg-background rounded border border-border overflow-hidden relative">
                  <div className="absolute top-6 left-6 z-10 bg-surface/90 backdrop-blur border border-border p-4 rounded shadow-lg text-[10px] uppercase tracking-widest space-y-3 pointer-events-none">
                    <div className="text-textMuted border-b border-border/50 pb-2 mb-2 font-bold">Investigation Topology</div>
                    <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded bg-primary"></div> Alert Node</div>
                    <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded bg-textMuted"></div> IP / Domain</div>
                    <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded bg-critical"></div> User / Account</div>
                    <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 bg-low/50"></div> Host / Asset</div>
                  </div>
                  {dimensions.width > 0 && (
                    <ForceGraph2D
                      width={dimensions.width}
                      height={dimensions.height}
                      graphData={graphData}
                      nodeLabel={() => null} // We use a custom tooltip or draw text below!
                      nodeColor={node => {
                        if (node.group === 'alert') return '#D6A84F'; // Gold primary
                        if (node.group === 'user') return '#B64A4A'; // Critical red
                        if (node.group === 'ip' || node.group === 'domain') return '#AFA49A'; // TextMuted
                        if (node.group === 'host') return '#6F665E'; // Border
                        if (node.group === 'process') return '#8B7355'; // Darker gold
                        return '#4A443E';
                      }}
                      linkColor={link => {
                        // Highlight the link if we are hovering over its source/target
                        if (hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id)) {
                          return 'rgba(214, 168, 79, 0.8)'; // Primary glowing link
                        }
                        return 'rgba(175, 164, 154, 0.2)'; // Subtle link otherwise
                      }}
                      linkWidth={link => (hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id)) ? 2 : 1}
                      linkDirectionalArrowLength={3.5}
                      linkDirectionalArrowRelPos={1}
                      backgroundColor="#0F0D0C" // Very dark clean background
                      d3VelocityDecay={0.3}
                      d3AlphaDecay={0.02}
                      d3Force="charge"
                      onNodeHover={node => setHoverNode(node || null)}
                      onNodeClick={(node) => window.alert(`Entity Type: ${node.group.toUpperCase()}\nEntity Value: ${node.label}`)}
                      nodeCanvasObject={(node, ctx, globalScale) => {
                        // Check if node is dimmed based on hover
                        const isHovered = hoverNode === node;
                        const isNeighbor = hoverNode && hoverNode.neighbors.includes(node);
                        const isDimmed = hoverNode && !isHovered && !isNeighbor;

                        const baseFontSize = isHovered ? 14 : 10;
                        const fontSize = baseFontSize / Math.max(globalScale, 0.5);
                        ctx.font = `${fontSize}px "Inter", sans-serif`;

                        const nodeRadius = isHovered ? 6 : 4;
                        const alpha = isDimmed ? 0.3 : 1;

                        // Node Circle Rendering
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
                        ctx.fillStyle = node.color || '#AFA49A';
                        ctx.globalAlpha = alpha;
                        ctx.fill();

                        // Always draw a subtle border for contrast
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = '#0F0D0C';
                        ctx.stroke();

                        // Label Drawing
                        // Truncate logic
                        let displayLabel = node.label;
                        if (displayLabel.length > 22) {
                          displayLabel = displayLabel.substring(0, 20) + '...';
                        }

                        // Measure text to draw background plate
                        const textWidth = ctx.measureText(displayLabel).width;
                        const bgPadding = fontSize * 0.4;

                        // Only draw labels if we're hovered, neighbors, or if it's the main alert (or if no hover is active)
                        if (!hoverNode || isHovered || isNeighbor || node.group === 'alert') {
                          ctx.fillStyle = `rgba(15, 13, 12, ${isHovered ? 0.9 : 0.7})`;
                          ctx.fillRect(
                            node.x - (textWidth / 2) - bgPadding,
                            node.y + nodeRadius + 3,
                            textWidth + (bgPadding * 2),
                            fontSize + bgPadding
                          );

                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'top';
                          ctx.fillStyle = node.color ? node.color : '#E6DED5';
                          ctx.globalAlpha = isDimmed ? 0.3 : 0.9;
                          ctx.fillText(displayLabel, node.x, node.y + nodeRadius + 4);

                          // If hovered, explicitly show the exact Type above it
                          if (isHovered) {
                            ctx.font = `bold ${fontSize * 0.7}px "JetBrains Mono", monospace`;
                            ctx.fillStyle = '#E6DED5';
                            ctx.fillText(node.group.toUpperCase(), node.x, node.y - nodeRadius - (fontSize * 1.5));
                          }
                        }

                        ctx.globalAlpha = 1; // Reset
                      }}
                      linkCanvasObjectMode={() => 'after'}
                      linkCanvasObject={(link, ctx, globalScale) => {
                        // Only draw the relationship text tag if hovering! 
                        if (!link.label) return;
                        if (!hoverNode || (link.source.id !== hoverNode.id && link.target.id !== hoverNode.id)) return;

                        const start = link.source;
                        const end = link.target;
                        if (typeof start !== 'object' || typeof end !== 'object') return;

                        const textPos = {
                          x: start.x + (end.x - start.x) * 0.5,
                          y: start.y + (end.y - start.y) * 0.5
                        };

                        const relLink = { x: end.x - start.x, y: end.y - start.y };
                        let textAngle = Math.atan2(relLink.y, relLink.x);
                        if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
                        if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

                        const fontSize = 9 / globalScale;
                        ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
                        ctx.save();
                        ctx.translate(textPos.x, textPos.y);
                        ctx.rotate(textAngle);
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        const labelWidth = ctx.measureText(link.label).width;
                        ctx.fillStyle = 'rgba(15, 13, 12, 0.95)';
                        ctx.fillRect(-labelWidth / 2 - 2, -(fontSize / 2) - 2, labelWidth + 4, fontSize + 4);

                        ctx.fillStyle = '#D6A84F';
                        ctx.fillText(link.label, 0, 0);
                        ctx.restore();
                      }}
                    />
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center font-mono">
          <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold uppercase tracking-widest mb-4 border-b border-border pb-2 flex justify-between items-center">
              <span>Select Alert Assignee</span>
              <button onClick={() => setAssignModalOpen(false)} className="text-textMuted hover:text-textMain"><XCircle size={18} /></button>
            </h2>

            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2 mb-6">
              {analysts.map(analyst => (
                <button
                  key={analyst.id}
                  onClick={() => handleAssignAnalyst(analyst.id)}
                  disabled={loadingAction === 'assign' || currentAssigneeObj?.id === analyst.id}
                  className={`w-full text-left p-3 rounded border flex justify-between items-center transition-colors ${currentAssigneeObj?.id === analyst.id
                    ? 'bg-border/30 border-border text-textMuted cursor-not-allowed'
                    : 'bg-background hover:bg-border/30 border-border/50 hover:border-border text-textMain'
                    }`}
                >
                  <div>
                    <div className="font-bold uppercase tracking-widest text-xs">{analyst.username}</div>
                    <div className="text-[10px] text-textMuted">{analyst.full_name}</div>
                  </div>
                  <div className="text-[10px] bg-surface px-2 py-1 rounded border border-border/50 uppercase tracking-widest">
                    {analyst.role}
                  </div>
                </button>
              ))}
              {analysts.length === 0 && (
                <div className="text-center p-4 text-xs text-textMuted uppercase tracking-widest border border-dashed border-border rounded">
                  No eligible analysts found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
