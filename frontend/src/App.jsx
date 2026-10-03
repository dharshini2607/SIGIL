import React, { useState, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Shield, Activity, Bell, Settings, Search, Info, X, Moon, Sun, Key, LogOut, Users } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AlertDetail from './pages/AlertDetail';
import Login from './pages/Login';
import UsersManagement from './pages/UsersManagement';
import { AuthProvider, AuthContext } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const [toastMessage, setToastMessage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // For demo, if they search, we can try to route to an alert ID if it matches, 
      // or just close it and show a toast. Let's route if it starts with ALT
      if (searchQuery.toUpperCase().startsWith('ALT-')) {
        navigate(`/alerts/${searchQuery.toUpperCase()}`);
      } else {
        showToast(`Searching for: ${searchQuery}`);
      }
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-textMain overflow-hidden font-sans relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute bottom-8 right-8 bg-surface border border-border text-textMain px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 z-50">
          <Info size={18} className="text-primary" />
          {toastMessage}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center font-mono">
          <div className="bg-surface border border-border p-6 shadow-2xl w-full max-w-md animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
              <h2 className="text-lg font-bold text-textMain tracking-widest uppercase flex items-center gap-2"><Settings size={18} /> Platform Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-textMuted hover:text-primary transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-textMuted mb-2 flex items-center gap-2"><Key size={14} /> Gemini API Key</label>
                <input type="password" placeholder="AI functionality is mocked globally for now..." disabled className="w-full bg-background border border-border p-2 text-sm text-textMuted cursor-not-allowed" />
                <p className="text-xs text-ai mt-2">Provided via backend .env file.</p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-textMuted mb-2 flex items-center gap-2"><Moon size={14} /> Interface Theme</label>
                <div className="flex gap-2">
                  <button className="flex-1 bg-primary/10 text-primary border border-primary/50 py-2 text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2">
                    <Moon size={14} /> Warm SOC
                  </button>
                  <button onClick={() => showToast("Light mode is disabled for SOC environments.")} className="flex-1 bg-background border border-border py-2 text-xs uppercase tracking-wider text-textMuted hover:text-textMain transition-colors flex items-center justify-center gap-2">
                    <Sun size={14} /> Light
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Overlay */}
      {showSearch && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center pt-24">
          <div className="w-full max-w-2xl animate-in slide-in-from-top-10">
            <form onSubmit={handleSearch} className="relative">
              <Search size={24} className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alerts (e.g. ALT-12345), entities, or IPs... Press Enter to search."
                className="w-full bg-background border border-primary/50 text-textMain rounded py-4 pl-12 pr-4 text-sm font-mono shadow-xl focus:outline-none focus:border-primary"
              />
              <button type="button" onClick={() => setShowSearch(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain p-1">
                <X size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-16 flex flex-col items-center py-6 bg-surface border-r border-border gap-8 shrink-0 relative z-40">
        <div className="text-primary">
          <Shield size={32} />
        </div>
        <div className="flex flex-col gap-6 mt-4">
          <Link to="/" className="text-primary hover:text-primary transition-colors p-2 bg-primary/10 border border-primary/20 rounded">
            <Activity size={24} />
          </Link>
          <button onClick={() => showToast("0 New Critical Alerts in the last hour.")} className="text-textMuted hover:text-textMain transition-colors p-2 cursor-pointer outline-none relative">
            <Bell size={24} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          </button>
          <button onClick={() => setShowSearch(true)} className="text-textMuted hover:text-textMain transition-colors p-2 cursor-pointer outline-none">
            <Search size={24} />
          </button>
        </div>
        <div className="mt-auto">
          <button onClick={() => setShowSettings(true)} className="text-textMuted hover:text-textMain transition-colors p-2 cursor-pointer outline-none">
            <Settings size={24} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center px-6 border-b border-border bg-surface shrink-0 justify-between font-mono">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-primary tracking-widest uppercase">
              SIGIL
            </h1>
            <span className="flex items-center gap-2 text-xs text-ai font-bold tracking-widest uppercase">
              <span className="w-2 h-2 rounded-full bg-ai animate-pulse"></span> SYSTEM ONLINE
            </span>
          </div>

          <div className="flex items-center gap-6">
            <AuthBadge />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background p-6 relative">
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/alerts/:id" element={<ProtectedRoute><AlertDetail /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute reqRole="SECURITY_ADMIN"><UsersManagement /></ProtectedRoute>} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function AuthBadge() {
  const { user, logout } = useContext(AuthContext);
  if (!user) return <span className="text-xs text-textMuted tracking-widest uppercase">SIGIL v1.0</span>;

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end">
        <span className="text-xs font-bold text-textMain">{user.full_name}</span>
        <span className="text-[10px] text-textMuted uppercase tracking-widest">{user.role}</span>
      </div>
      {user.role === 'SECURITY_ADMIN' && (
        <Link to="/admin/users" className="text-primary hover:text-textMain transition-colors p-1" title="User Management">
          <Users size={18} />
        </Link>
      )}
      <button onClick={logout} className="text-critical hover:text-textMain transition-colors p-1 ml-2 border-l border-border pl-4" title="Logout">
        <LogOut size={18} />
      </button>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
