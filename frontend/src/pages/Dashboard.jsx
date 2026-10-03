import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User as UserIcon } from 'lucide-react';

const API_URL = 'http://localhost:8000/api/v1';

export default function Dashboard() {
  const [alerts, setAlerts] = useState([]);
  const [analysts, setAnalysts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [alertRes] = await Promise.all([
          axios.get(`${API_URL}/alerts/`)
          // analysts fetch happens separately to prevent Viewer lockouts
        ]);
        setAlerts(alertRes.data);

        if (user?.role !== 'VIEWER') {
          try {
            const uRes = await axios.get(`${API_URL}/users/eligible_analysts`);
            setAnalysts(uRes.data);
          } catch (e) {
            console.warn("Viewer Role unable to list analysts");
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [user]);

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-critical/10 text-critical border-critical/30';
      case 'HIGH': return 'bg-high/10 text-high border-high/30';
      case 'MEDIUM': return 'bg-medium/10 text-medium border-medium/30';
      default: return 'bg-low/10 text-low border-low/30';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-critical';
      case 'HIGH': return 'bg-high';
      case 'MEDIUM': return 'bg-medium';
      default: return 'bg-low';
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'NEW': return 'text-low border-low/30 bg-low/10';
      case 'INVESTIGATING': return 'text-primary border-primary/30 bg-primary/10';
      case 'INVESTIGATED': return 'text-high border-high/30 bg-high/10';
      case 'FAILED': return 'text-critical border-critical/30 bg-critical/10';
      default: return 'text-textMuted border-border bg-border/20';
    }
  };

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    high: alerts.filter(a => a.severity === 'HIGH').length,
    medium: alerts.filter(a => a.severity === 'MEDIUM').length,
    low: alerts.filter(a => a.severity === 'LOW').length,
    investigating: alerts.filter(a => a.status === 'INVESTIGATING').length,
    investigated: alerts.filter(a => a.status === 'INVESTIGATED').length,
    failed: alerts.filter(a => a.status === 'FAILED').length,
  };

  const activeInvestigations = alerts.filter(a => a.status === 'INVESTIGATING').slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 font-mono text-sm">
      <div className="border-b border-border pb-4 mb-2">
        <h2 className="text-xl font-bold tracking-widest text-textMain uppercase">Security Operations Overview</h2>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'ALERTS', value: stats.total, color: 'text-textMain' },
          { label: 'CRITICAL', value: stats.critical, color: 'text-critical' },
          { label: 'HIGH', value: stats.high, color: 'text-high' },
          { label: 'MEDIUM', value: stats.medium, color: 'text-medium' },
          { label: 'INVESTIGATING', value: stats.investigating, color: 'text-primary' },
          { label: 'INVESTIGATED', value: stats.investigated, color: 'text-low' },
          { label: 'FAILED', value: stats.failed, color: 'text-critical text-opacity-80' },
          { label: 'LOW', value: stats.low, color: 'text-low text-opacity-80' }
        ].map(stat => (
          <div key={stat.label} className="card p-4 flex flex-col items-center justify-center border-border/50">
            <span className={`text-3xl font-bold mb-1 ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-textMuted uppercase tracking-widest">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <div className="card p-5 border-border/50 flex flex-col">
          <h3 className="text-textMuted uppercase tracking-wider mb-6 text-xs font-semibold">Risk Distribution</h3>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            {[
              { label: 'Critical', value: stats.critical, color: 'bg-critical' },
              { label: 'High', value: stats.high, color: 'bg-high' },
              { label: 'Medium', value: stats.medium, color: 'bg-medium' },
              { label: 'Low', value: stats.low, color: 'bg-low' }
            ].map(tier => (
              <div key={tier.label} className="flex items-center gap-4">
                <span className="w-20 text-textMain">{tier.label}</span>
                <div className="flex-1 h-3 bg-background rounded-full overflow-hidden border border-border">
                  <div
                    className={`h-full ${tier.color}`}
                    style={{ width: `${stats.total > 0 ? (tier.value / stats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-textMuted">{tier.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Investigations */}
        <div className="card p-5 border-border/50 flex flex-col">
          <h3 className="text-textMuted uppercase tracking-wider mb-4 text-xs font-semibold">Active Investigations</h3>
          <div className="flex flex-col gap-2 flex-1">
            {activeInvestigations.length === 0 ? (
              <div className="text-textMuted text-center my-auto">No active investigations.</div>
            ) : (
              activeInvestigations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-background/50 border border-border rounded">
                  <Link to={`/alerts/${inv.id}`} className="hover:text-primary transition-colors flex items-center gap-3">
                    <span className="text-primary font-bold">{inv.id.substring(0, 8)}</span>
                    <span className="text-textMain truncate max-w-[200px]">{inv.title}</span>
                  </Link>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded uppercase tracking-wider">
                    INVESTIGATING
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Alerts Table */}
      <div className="card overflow-hidden border-border/50 mt-2">
        <div className="p-4 border-b border-border bg-surface flex justify-between items-center">
          <h3 className="text-textMuted uppercase tracking-wider text-xs font-semibold">Recent Alerts</h3>
        </div>
        <table className="w-full text-left text-sm font-mono">
          <thead className="bg-background text-textMuted uppercase tracking-widest text-xs border-b border-border">
            <tr>
              <th className="px-6 py-3 font-medium">Severity</th>
              <th className="px-6 py-3 font-medium w-full">Alert Description</th>
              <th className="px-6 py-3 font-medium text-left">Assignee</th>
              <th className="px-6 py-3 font-medium text-right">Risk</th>
              <th className="px-6 py-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr><td colSpan="4" className="px-6 py-8 text-center text-textMuted">Loading alerts...</td></tr>
            ) : alerts.length === 0 ? (
              <tr><td colSpan="4" className="px-6 py-8 text-center text-textMuted">No alerts found.</td></tr>
            ) : (
              alerts.slice(0, 10).map(alert => (
                <tr key={alert.id} className="hover:bg-border/20 transition-colors group">
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold border uppercase tracking-wider ${getSeverityStyle(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/alerts/${alert.id}`} className="block">
                      <div className="text-textMain group-hover:text-primary transition-colors">
                        {alert.title}
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs">
                      {alert.assigned_to_id ? (
                        <>
                          <UserIcon size={12} className="text-primary" />
                          <span className="text-primary tracking-wider uppercase">
                            {analysts.find(a => a.id === alert.assigned_to_id)?.username || 'Assigned'}
                          </span>
                        </>
                      ) : (
                        <span className="text-textMuted tracking-wider uppercase opacity-50">Unassigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-textMain font-bold">{alert.risk_score != null ? alert.risk_score.toFixed(0) : 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusStyle(alert.status)}`}>
                      {alert.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
