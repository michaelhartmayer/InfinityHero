import { useState, useEffect } from 'react';
import { GamePage } from './pages/GamePage';
import { AdminPage } from './pages/AdminPage';
import './App.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Simple routing logic
  if (currentPath.startsWith('/admin')) {
    return <AdminPage />;
  }

  return <GamePage />;
}

export default App;
