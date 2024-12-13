import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import AppRoutes from './routes/AppRoutes';
import NotificationComponent from './components/notifications/NotificationComponent';
import { Toaster } from 'react-hot-toast';
import './index.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <NotificationComponent />
          <Toaster position="top-right" />
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;