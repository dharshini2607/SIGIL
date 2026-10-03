import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, UserPlus, UserX, User, Loader2, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

export default function UsersManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { user } = useAuth();

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/users/`);
            setUsers(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to fetch users');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const confirmDelete = async (userId) => {
        if (!window.confirm("Are you sure you want to deactivate this identity?")) return;
        try {
            await axios.delete(`${API_URL}/users/${userId}`);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error deactivating user');
        }
    };

    const getRoleStyle = (role) => {
        switch (role) {
            case 'SECURITY_ADMIN': return 'bg-critical/10 text-critical border-critical/30';
            case 'SENIOR_ANALYST': return 'bg-high/10 text-high border-high/30';
            case 'SOC_ANALYST': return 'bg-primary/10 text-primary border-primary/30';
            default: return 'bg-border/20 text-textMuted border-border/50';
        }
    };

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-6 font-mono text-sm">
            <div className="border-b border-border pb-4 mb-2 flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-bold tracking-widest text-primary uppercase flex items-center gap-2">
                        <Lock size={20} /> Identity & Access Management
                    </h2>
                    <p className="text-xs text-textMuted tracking-wider mt-1 uppercase">SECURITY_ADMIN Privilege Execution Context</p>
                </div>
                <button className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded uppercase tracking-wider text-xs flex items-center gap-2 transition-colors">
                    <UserPlus size={14} /> Provision Identity
                </button>
            </div>

            {error && (
                <div className="bg-critical/10 border border-critical/20 text-critical px-4 py-3 rounded mb-6 flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="card overflow-hidden border-border/50 shadow-xl">
                <table className="w-full text-left text-sm font-mono">
                    <thead className="bg-background text-textMuted uppercase tracking-widest text-xs border-b border-border">
                        <tr>
                            <th className="px-6 py-4 font-medium flex items-center gap-2"><User size={14} /> Operator ID</th>
                            <th className="px-6 py-4 font-medium">Full Identifier</th>
                            <th className="px-6 py-4 font-medium">Clearance Level</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium text-right">Directives</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {loading ? (
                            <tr><td colSpan="5" className="px-6 py-12 text-center text-textMuted flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin text-primary" /> Enumerating identities...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan="5" className="px-6 py-8 text-center text-textMuted">No identities extracted.</td></tr>
                        ) : (
                            users.map(u => (
                                <tr key={u.id} className={`transition-colors hover:bg-border/10 ${!u.is_active ? 'opacity-50' : ''}`}>
                                    <td className="px-6 py-4 font-bold text-textMain">{u.username}</td>
                                    <td className="px-6 py-4 text-textMain">{u.full_name}<br /><span className="text-[10px] text-textMuted tracking-widest uppercase">{u.email}</span></td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded text-[10px] font-bold border uppercase tracking-widest ${getRoleStyle(u.role)}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-textMuted">
                                            <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-primary' : 'bg-critical'}`}></span>
                                            {u.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {user && user.username !== u.username && u.role !== 'SECURITY_ADMIN' && (
                                            <button onClick={() => confirmDelete(u.id)} disabled={!u.is_active} className="text-critical hover:text-textMain transition-colors p-2 disabled:opacity-30 disabled:cursor-not-allowed">
                                                <UserX size={16} />
                                            </button>
                                        )}
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
