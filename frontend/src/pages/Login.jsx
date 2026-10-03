import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Shield, Key, User, Lock, AlertCircle } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useContext(AuthContext);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        const result = await login(username, password);
        if (!result.success) {
            setError(result.error || 'Invalid credentials');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="flex h-screen items-center justify-center bg-background font-mono text-textMain p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/30 via-background to-background"></div>

            <div className="w-full max-w-md card p-8 border-primary/30 shadow-[0_0_50px_rgba(204,136,34,0.1)] relative z-10 animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-full border border-primary bg-primary/10 flex items-center justify-center mb-4 text-primary shadow-[0_0_20px_rgba(204,136,34,0.3)]">
                        <Shield size={32} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-[0.2em] uppercase text-primary">SIGIL</h1>
                    <p className="text-xs tracking-widest text-textMuted uppercase mt-2">Security Operations Platform</p>
                </div>

                {error && (
                    <div className="bg-critical/10 border border-critical/50 text-critical text-xs p-3 rounded mb-6 flex items-center gap-2 animate-in slide-in-from-top-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-textMuted">Operator ID</label>
                        <div className="relative">
                            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/70" />
                            <input
                                autoFocus
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-surface border border-border focus:border-primary px-10 py-3 text-sm rounded outline-none transition-colors"
                                placeholder="analyst"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-textMuted">Passkey</label>
                        <div className="relative">
                            <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/70" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-surface border border-border focus:border-primary px-10 py-3 text-sm rounded outline-none transition-colors"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-primary text-background font-bold uppercase tracking-widest py-4 text-sm rounded hover:bg-primary/90 transition-all flex justify-center items-center gap-2 group disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                            <Lock size={16} className="group-hover:scale-110 transition-transform" />
                        )}
                        {isSubmitting ? 'Authenticating...' : 'Engage'}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-[10px] text-textMuted/50 uppercase tracking-widest">
                        Unauthorized access prohibited.<br />All actions are logged and audited.
                    </p>
                </div>
            </div>
        </div>
    );
}
