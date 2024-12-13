import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = Math.random().toString(36).substr(2, 9);
    
    const newNotification = {
      id,
      title: notification.title || 'Notificación',
      message: notification.message,
      type: notification.type || 'info',
      duration: notification.duration || 5000,
      action: notification.action,
      show: true
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto remove notification after duration
    setTimeout(() => {
      removeNotification(id);
    }, newNotification.duration);

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, show: false }
          : notification
      )
    );

    // Remove from DOM after animation
    setTimeout(() => {
      setNotifications(prev => 
        prev.filter(notification => notification.id !== id)
      );
    }, 300);
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        addNotification, 
        removeNotification,
        clearAllNotifications 
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;