import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedRoute({ children, reqRole }) {
    const { user, loading } = useContext(AuthContext);

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-primary gap-4 font-mono">
                <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                <span className="text-xs uppercase tracking-widest animate-pulse">Initializing SIGIL Identity Protocols...</span>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (reqRole && user.role !== reqRole && user.role !== 'SECURITY_ADMIN') {
        return <Navigate to="/" replace />;
    }

    return children;
}
