import { createContext, useState, useCallback, useContext, useRef } from 'react';

const ToastContext = createContext(null);

const DISPLAY_MS = 6000;   // visible duration
const HIDE_MS   = 350;     // slide-out animation duration

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false, hiding: false });
  const displayTimer = useRef(null);
  const hideTimer    = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    // Clear any in-flight timers
    if (displayTimer.current) clearTimeout(displayTimer.current);
    if (hideTimer.current)    clearTimeout(hideTimer.current);

    setToast({ message, type, visible: true, hiding: false });

    // After DISPLAY_MS, start the hide animation
    displayTimer.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, hiding: true }));
      displayTimer.current = null;

      // After animation completes, actually hide
      hideTimer.current = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false, hiding: false }));
        hideTimer.current = null;
      }, HIDE_MS);
    }, DISPLAY_MS);
  }, []);

  return (
    <ToastContext value={{ toast, showToast }}>
      {children}
    </ToastContext>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
