import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { CandidateList } from './pages/CandidateList';
import { VoterList } from './pages/VoterList';
import { VoterImport } from './pages/VoterImport';
import { DataEntry } from './pages/DataEntry';
import { ResultCalculation } from './pages/ResultCalculation';
import { AccountManagement } from './pages/AccountManagement';
import { SystemLogs } from './pages/SystemLogs';
import { Reports } from './pages/Reports';
import { DesignSystem } from './pages/DesignSystem';
import { Login } from './pages/Login';
import { PageType } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { StatusModal } from './components/StatusModal';

// Component con để tách logic hook useAuth
const AppContent: React.FC = () => {
  const { session, isLoading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [isLargeText, setIsLargeText] = useState(() => {
    return localStorage.getItem('global-pref-large-text') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('global-pref-large-text', isLargeText.toString());
  }, [isLargeText]);

  const renderPage = () => {
    const commonProps = { isLargeText };

    switch (currentPage) {
      case 'dashboard': return <Dashboard {...commonProps} />;
      case 'candidates': return <CandidateList {...commonProps} />;
      case 'voters': return <VoterList onImportClick={() => setCurrentPage('voter-import')} isLargeText={isLargeText} setIsLargeText={setIsLargeText} />;
      case 'voter-import': return <VoterImport onBack={() => setCurrentPage('voters')} {...commonProps} />;
      case 'data-entry': return <DataEntry {...commonProps} />;
      case 'calculation': return <ResultCalculation {...commonProps} />;
      case 'reports': return <Reports {...commonProps} />;
      case 'accounts': return <AccountManagement {...commonProps} />;
      case 'logs': return <SystemLogs {...commonProps} />;
      case 'design-system': return <DesignSystem {...commonProps} />;
      default: return <Dashboard {...commonProps} />;
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span></div>;
  }

  if (!session) {
    return (
      <Login onLogin={() => { }} />
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-background-light dark:bg-background-dark ${isLargeText ? 'text-lg' : 'text-base'}`}>
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isLargeText={isLargeText}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onLogout={signOut}
          isLargeText={isLargeText}
          setIsLargeText={setIsLargeText}
        />

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
          <div className={`${isLargeText ? 'max-w-full' : 'max-w-[1400px]'} mx-auto animate-in fade-in duration-500`}>
            {renderPage()}
          </div>
        </main>
        <StatusModal />
      </div>
    </div>
  );
};

import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
