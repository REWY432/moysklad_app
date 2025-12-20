import React, { useState, useEffect } from 'react';
import { MoySkladCredentials } from '../types';
import { moysklad } from '../services/moyskladService';
import { Lock, User, AlertCircle, PlayCircle, Key, Globe, Settings, ChevronDown, ChevronUp, ArrowRight, CheckSquare, Square } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (creds: MoySkladCredentials) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [authMethod, setAuthMethod] = useState<'password' | 'token'>('password');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoOption, setShowDemoOption] = useState(false);

  useEffect(() => {
    // Load proxy
    const savedProxy = localStorage.getItem('ms_proxy_url');
    setProxyUrl(savedProxy || 'https://sweet-leaf-f3f1.supercell-help-2015.workers.dev');

    // Load credentials
    const savedCreds = localStorage.getItem('ms_credentials');
    if (savedCreds) {
      try {
        const parsed = JSON.parse(savedCreds);
        if (parsed.token) {
          setAuthMethod('token');
          setToken(parsed.token);
        } else if (parsed.login) {
          setAuthMethod('password');
          setLogin(parsed.login);
          setPassword(parsed.password || '');
        }
      } catch (e) {
        console.error("Failed to parse saved credentials", e);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowDemoOption(false);

    if (proxyUrl) {
      moysklad.setProxyUrl(proxyUrl);
    }

    let creds: MoySkladCredentials;
    if (authMethod === 'token') {
      if (!token) {
        setError("Необходимо указать токен");
        setLoading(false);
        return;
      }
      creds = { login: '', token };
    } else {
      if (!login || !password) {
         setError("Введите логин и пароль");
         setLoading(false);
         return;
      }
      creds = { login, password };
    }

    moysklad.setCredentials(creds);

    try {
      const isConnected = await moysklad.checkConnection();
      if (isConnected) {
        // Save or clear credentials based on Remember Me
        if (rememberMe) {
          localStorage.setItem('ms_credentials', JSON.stringify(creds));
        } else {
          localStorage.removeItem('ms_credentials');
        }
        
        onLoginSuccess(creds);
      } else {
        setError('Ошибка соединения. Проверьте данные или настройки прокси.');
        setShowSettings(true);
        setShowDemoOption(true);
      }
    } catch (err) {
      console.error(err);
      setError('Сетевая ошибка. Нет доступа к API.');
      setShowSettings(true);
      setShowDemoOption(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = () => {
    moysklad.enableDemoMode();
    onLoginSuccess({ login: 'demo@example.com' });
  };

  return (
    <div className="flex min-h-screen bg-[#f3f4f6]">
      {/* Abstract Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200 rounded-full blur-[120px] opacity-40"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-200 rounded-full blur-[120px] opacity-40"></div>
      </div>

      <div className="relative flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
        
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 shadow-glow mb-4 transform rotate-3 hover:rotate-6 transition-transform duration-300">
                <Lock className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">МойСклад Коннектор</h1>
            <p className="text-slate-500 mt-2 font-medium">Терминал упаковки и логистики</p>
        </div>

        {/* Card */}
        <div className="w-full bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-soft p-8 relative overflow-hidden">
          
          {/* Top Line Decor */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-primary-500"></div>

          {/* Auth Method Toggle */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6 relative">
            <button
              type="button"
              onClick={() => { setAuthMethod('password'); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                authMethod === 'password' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Логин / Пароль
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod('token'); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                authMethod === 'token' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              API Token
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
               <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
               <div>
                  <p className="text-sm text-red-700 font-semibold">{error}</p>
                  {showDemoOption && !proxyUrl && (
                    <p className="text-xs text-red-600 mt-1 opacity-80">
                      Подсказка: Для работы из браузера требуется Proxy.
                    </p>
                  )}
               </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {authMethod === 'password' ? (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Логин / Email</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-slate-400 font-medium"
                      placeholder="admin@company.ru"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Пароль</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-slate-400 font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Токен доступа</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-slate-400 font-medium"
                    placeholder="eyJhbGciOiJIUzI1..."
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
               <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className="flex items-center text-sm text-slate-600 hover:text-slate-800 transition-colors group"
               >
                  {rememberMe ? 
                    <CheckSquare className="w-5 h-5 mr-2 text-primary-600" /> : 
                    <Square className="w-5 h-5 mr-2 text-slate-300 group-hover:text-primary-500" />
                  }
                  <span className="font-medium">Запомнить меня</span>
               </button>

               <button 
                type="button" 
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center text-xs font-semibold text-slate-400 hover:text-primary-600 transition-colors group"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5 group-hover:rotate-90 transition-transform duration-300" />
                {showSettings ? "Скрыть настройки" : "Настройки сети"}
              </button>
            </div>
              
              {showSettings && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-1">
                   <label className="block text-xs font-bold text-slate-700 mb-1.5">URL Cloudflare Worker</label>
                   <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Globe className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="url"
                        value={proxyUrl}
                        onChange={(e) => setProxyUrl(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white"
                        placeholder="https://..."
                      />
                   </div>
                </div>
              )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg shadow-primary-500/30 text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>Войти в систему <ArrowRight className="ml-2 w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold">
              <span className="px-3 bg-white text-slate-400">или попробуйте</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDemoMode}
            className="w-full group flex justify-center items-center py-3 px-4 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-200 focus:outline-none transition-all"
          >
            <PlayCircle className="w-5 h-5 mr-2 text-primary-500 group-hover:scale-110 transition-transform" />
            Демо режим
          </button>
        </div>
        
        <p className="mt-8 text-xs text-slate-400 font-medium">© 2025 МойСклад Коннектор v2.0</p>
      </div>
    </div>
  );
};