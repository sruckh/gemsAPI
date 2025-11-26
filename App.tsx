import React, { useState, useEffect } from 'react';
import { ViewMode, Gem, AppConfig } from './types';
import { getGems } from './services/dbService';
import GemManager from './components/GemManager';
import GemChat from './components/GemChat';
import { LayoutGrid, MessageSquare, Settings, Moon, Sun, LogIn, LogOut, User } from 'lucide-react';
import Button from './components/Button';
import Modal from './components/Modal';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const AppContent: React.FC = () => {
  const { authState, signIn, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ViewMode>('manager');
  const [gems, setGems] = useState<Gem[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('gemini_app_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('gemini_app_config');
    return saved ? JSON.parse(saved) : {
      useLocalStorage: false // Default to API now
    };
  });

  // Apply Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('gemini_app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    refreshGems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.useLocalStorage]);

  const refreshGems = async () => {
    try {
      const data = await getGems(config);
      setGems(data);
    } catch (e) {
      console.error("Failed to load gems", e);
    }
  };

  const saveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    localStorage.setItem('gemini_app_config', JSON.stringify(newConfig));
    setIsConfigOpen(false);
    setTimeout(refreshGems, 100); 
  };

  // Show loading state while checking authentication
  if (authState.loading) {
    return (
      <div className="flex h-screen bg-[#f8f9fa] dark:bg-gray-900 text-gray-800 dark:text-gray-200 overflow-hidden font-sans transition-colors duration-200">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!authState.user) {
    return (
      <div className="flex h-screen bg-[#f8f9fa] dark:bg-gray-900 text-gray-800 dark:text-gray-200 overflow-hidden font-sans transition-colors duration-200">
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md mx-auto p-8">
             <img src="/android-chrome-192x192.png" alt="GeminiGems" className="w-16 h-16 mx-auto mb-4" />
             <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
               Gemini<span className="text-google-blue">A</span>
               <span className="text-google-red">P</span>
               <span className="text-google-yellow">I</span>
             </h1>
             <p className="text-gray-600 dark:text-gray-400 mb-8">
               Sign in to manage your AI gems and prompts
             </p>
             <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
               First user to sign in becomes administrator
             </p>
             <Button
               onClick={signIn}
               disabled={authState.loading}
               className="w-full"
             >
               <LogIn size={20} className="mr-2" />
               {authState.loading ? 'Signing in...' : 'Sign in with Google'}
             </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#f8f9fa] dark:bg-gray-900 text-gray-800 dark:text-gray-200 overflow-hidden font-sans transition-colors duration-200">

      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors duration-200">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6">
          <div className="flex items-center gap-2">
             <img src="/android-chrome-192x192.png" alt="GeminiGems" className="w-8 h-8" />
             <span className="hidden lg:block font-normal text-xl text-gray-600 dark:text-gray-300 tracking-tight">
               Gemini<span className="font-medium text-gray-800 dark:text-white">Gems</span>
               <span className="ml-1 font-bold flex-inline text-sm align-top">
                <span className="text-google-blue">A</span>
                <span className="text-google-red">P</span>
                <span className="text-google-yellow">I</span>
               </span>
             </span>
          </div>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
          <button
            onClick={() => setCurrentView('manager')}
            className={`flex items-center p-3 rounded-full transition-all ${
              currentView === 'manager' 
                ? 'bg-[#e8f0fe] dark:bg-blue-900/30 text-[#1967d2] dark:text-blue-300' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <LayoutGrid size={22} />
            <span className="hidden lg:block ml-4 font-medium text-sm">Gem Manager</span>
          </button>

          <button
            onClick={() => setCurrentView('chat')}
            className={`flex items-center p-3 rounded-full transition-all ${
              currentView === 'chat' 
                ? 'bg-[#e8f0fe] dark:bg-blue-900/30 text-[#1967d2] dark:text-blue-300' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <MessageSquare size={22} />
            <span className="hidden lg:block ml-4 font-medium text-sm">Execute Gem</span>
          </button>
        </nav>

        <div className="flex-1 p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400">
            <User size={16} />
            <span className="text-sm font-medium truncate">
              {authState.user?.email}
            </span>
          </div>

          <button
            onClick={toggleTheme}
            className="flex items-center justify-center lg:justify-start w-full p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span className="hidden lg:block ml-4 text-sm font-medium">
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </button>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center justify-center lg:justify-start w-full p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <Settings size={20} />
            <span className="hidden lg:block ml-4 text-sm font-medium">Settings</span>
          </button>

          <button
            onClick={signOut}
            disabled={authState.loading}
            className="flex items-center justify-center lg:justify-start w-full p-2 text-red-500 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
          >
            <LogOut size={20} />
            <span className="hidden lg:block ml-4 text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa] dark:bg-gray-900 relative transition-colors duration-200">
        <div className="flex-1 overflow-hidden p-4 lg:p-6 max-w-screen-2xl mx-auto w-full">
           {currentView === 'manager' && (
             <GemManager gems={gems} config={config} onRefresh={refreshGems} />
           )}
           {currentView === 'chat' && (
             <GemChat gems={gems} config={config} />
           )}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
        initialConfig={config}
        onSave={saveConfig}
      />
    </div>
  );
};

// Sub-component for Settings
const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialConfig: AppConfig;
  onSave: (c: AppConfig) => void;
}> = ({ isOpen, onClose, initialConfig, onSave }) => {
  const [localConfig, setLocalConfig] = useState(initialConfig);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(initialConfig);
    }
  }, [isOpen, initialConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localConfig);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Data Source</h3>
               <div className="flex items-center gap-2">
                 <select 
                   className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs px-2 py-1 text-gray-700 dark:text-gray-200 focus:ring-blue-500 focus:border-blue-500"
                   value={localConfig.useLocalStorage ? 'local' : 'api'}
                   onChange={(e) => setLocalConfig({...localConfig, useLocalStorage: e.target.value === 'local'})}
                 >
                   <option value="api">Server (Supabase)</option>
                   <option value="local">Browser Storage (Demo)</option>
                 </select>
               </div>
            </div>

            {localConfig.useLocalStorage ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Data is saved in your browser's local storage. The backend API is not used.
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Data and AI generation are handled by the secure backend server.
              </p>
            )}
          </div>
        </div>
        
        <div className="mt-8 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Main App wrapper with AuthProvider
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;