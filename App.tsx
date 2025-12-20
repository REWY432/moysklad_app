import React, { useState } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AppView, MoySkladCredentials } from './types';

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  const [credentials, setCredentials] = useState<MoySkladCredentials | null>(null);

  const handleLoginSuccess = (creds: MoySkladCredentials) => {
    setCredentials(creds);
    setCurrentView(AppView.DASHBOARD);
  };

  return (
    <div className="h-full">
      {currentView === AppView.LOGIN && <Login onLoginSuccess={handleLoginSuccess} />}
      {currentView === AppView.DASHBOARD && <Dashboard />}
    </div>
  );
}

export default App;