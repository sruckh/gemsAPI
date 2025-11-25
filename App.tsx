import React, { useState, useEffect } from 'react';
import { ViewMode, Gem, AppConfig } from './types';
import { getGems, initSupabase, testSupabaseConnection } from './services/dbService';
import GemManager from './components/GemManager';
import GemChat from './components/GemChat';
import { LayoutGrid, MessageSquare, Settings, CheckCircle2, XCircle, AlertCircle, Sparkles, Moon, Sun } from 'lucide-react';
import Input from './components/Input';
import Button from './components/Button';
import Modal from './components/Modal';

const App: React.FC = () => {
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
      geminiApiKey: process.env.API_KEY || '', 
      supabaseUrl: '',
      supabaseKey: '',
      useLocalStorage: true
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
    initSupabase(config.supabaseUrl, config.supabaseKey);
    refreshGems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.supabaseUrl, config.supabaseKey, config.useLocalStorage]);

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

  useEffect(() => {
    if (!config.geminiApiKey && !isConfigOpen) {
      setIsConfigOpen(true);
    }
  }, []);

  return (
    <div className="flex h-screen bg-[#f8f9fa] dark:bg-gray-900 text-gray-800 dark:text-gray-200 overflow-hidden font-sans transition-colors duration-200">
      
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors duration-200">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6">
          <div className="flex items-center gap-2">
             <Sparkles className="text-[#1a73e8] dark:text-blue-400" size={24} />
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

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2">
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
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(initialConfig);
      setTestStatus('idle');
    }
  }, [isOpen, initialConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localConfig);
  };

  const handleTestConnection = async () => {
    if (!localConfig.supabaseUrl || !localConfig.supabaseKey) return;
    setTestStatus('testing');
    const success = await testSupabaseConnection(localConfig.supabaseUrl, localConfig.supabaseKey);
    setTestStatus(success ? 'success' : 'failure');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Gemini API</h3>
            <Input
              label="API Key"
              type="password"
              value={localConfig.geminiApiKey}
              onChange={(e) => setLocalConfig({...localConfig, geminiApiKey: e.target.value})}
              placeholder="Enter your Gemini API Key"
              required
            />
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Storage Backend</h3>
               <div className="flex items-center gap-2">
                 <label className="text-xs text-gray-600 dark:text-gray-400">Source:</label>
                 <select 
                   className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs px-2 py-1 text-gray-700 dark:text-gray-200 focus:ring-blue-500 focus:border-blue-500"
                   value={localConfig.useLocalStorage ? 'local' : 'supabase'}
                   onChange={(e) => setLocalConfig({...localConfig, useLocalStorage: e.target.value === 'local'})}
                 >
                   <option value="local">Browser Storage</option>
                   <option value="supabase">Supabase</option>
                 </select>
               </div>
            </div>

            {!localConfig.useLocalStorage && (
              <div className="space-y-4">
                <Input
                  label="Supabase URL"
                  value={localConfig.supabaseUrl}
                  onChange={(e) => setLocalConfig({...localConfig, supabaseUrl: e.target.value})}
                  placeholder="https://xyz.supabase.co"
                />
                <Input
                  label="Supabase Anon Key"
                  type="password"
                  value={localConfig.supabaseKey}
                  onChange={(e) => setLocalConfig({...localConfig, supabaseKey: e.target.value})}
                  placeholder="Key..."
                />
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2">
                    {testStatus === 'testing' && <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1"><AlertCircle size={14}/> Testing...</span>}
                    {testStatus === 'success' && <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 size={14}/> Connected</span>}
                    {testStatus === 'failure' && <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><XCircle size={14}/> Failed</span>}
                  </div>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="text-xs h-8 px-3" 
                    onClick={handleTestConnection}
                    disabled={!localConfig.supabaseUrl || !localConfig.supabaseKey}
                  >
                    Test Connection
                  </Button>
                </div>
              </div>
            )}
            {localConfig.useLocalStorage && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Data is saved in your browser's local storage and will not be accessible via the FastAPI backend.
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

export default App;