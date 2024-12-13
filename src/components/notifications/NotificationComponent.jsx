import React from 'react';
import { Warning, CheckCircle, Info, Error as ErrorIcon, Close } from '@mui/icons-material';
import { useNotification } from '../../context/NotificationContext';

const NotificationComponent = () => {
  const { notifications, removeNotification } = useNotification();

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'warning':
        return <Warning className="h-6 w-6 text-yellow-500" />;
      case 'error':
        return <ErrorIcon className="h-6 w-6 text-red-500" />;
      default:
        return <Info className="h-6 w-6 text-blue-500" />;
    }
  };

  const getBorderColor = (type) => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-green-500';
      case 'warning':
        return 'border-l-4 border-yellow-500';
      case 'error':
        return 'border-l-4 border-red-500';
      default:
        return 'border-l-4 border-blue-500';
    }
  };

  return (
    <div 
      aria-live="assertive" 
      className="fixed inset-0 flex items-start justify-end px-4 py-6 pointer-events-none sm:p-6 z-50"
    >
      <div className="flex flex-col space-y-4 w-full max-w-sm">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`${
              notification.show ? 'transform translate-x-0 opacity-100' : 'transform translate-x-full opacity-0'
            } transition-all duration-300 ease-in-out max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ${getBorderColor(notification.type)}`}
          >
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {getIcon(notification.type)}
                </div>
                <div className="ml-3 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {notification.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {notification.message}
                  </p>
                  {notification.action && (
                    <div className="mt-3 flex space-x-7">
                      <button
                        onClick={notification.action.onClick}
                        className="bg-white text-sm font-medium text-yellow-600 hover:text-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                      >
                        {notification.action.text}
                      </button>
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    onClick={() => removeNotification(notification.id)}
                    className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    <span className="sr-only">Close</span>
                    <Close className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationComponent;