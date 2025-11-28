import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GamePage } from './pages/GamePage';
import { AdminPage } from './pages/AdminPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
