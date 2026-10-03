import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("React Error Boundary Caught Exception:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-full flex flex-col items-center justify-center bg-background text-textMain font-mono p-8 text-center animate-in fade-in zoom-in-95">
                    <div className="bg-critical/10 border border-critical/50 p-6 rounded-lg max-w-lg w-full flex flex-col items-center gap-6 shadow-2xl">
                        <AlertTriangle size={48} className="text-critical animate-pulse" />
                        <div>
                            <h2 className="text-xl font-bold uppercase tracking-widest text-critical">Application Error</h2>
                            <p className="text-xs text-textMuted mt-2 tracking-wide">
                                The investigation workspace encountered an unexpected error during rendering.
                            </p>
                        </div>
                        <div className="w-full text-left bg-background border border-border p-3 rounded text-[10px] overflow-auto max-h-32 text-critical font-bold mt-2">
                            {this.state.error && this.state.error.toString()}
                        </div>
                        <div className="flex gap-4 mt-2">
                            <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-4 py-2 border border-border bg-surface hover:bg-border/30 rounded text-xs uppercase tracking-widest transition-colors font-bold">
                                <RotateCcw size={14} /> Retry
                            </button>
                            <Link to="/" onClick={() => this.setState({ hasError: false })} className="flex items-center gap-2 px-4 py-2 border border-primary/50 text-primary bg-primary/10 hover:bg-primary/20 rounded text-xs uppercase tracking-widest transition-colors font-bold">
                                <Home size={14} /> Back to Alerts
                            </Link>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
