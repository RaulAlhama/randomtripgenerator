import { useToast } from '../../context/ToastContext';

const IconSuccess = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconError = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

const IconInfo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

const ICONS = { success: IconSuccess, error: IconError, info: IconInfo };

export default function Toast() {
  const { toast } = useToast();
  const { message, type, visible, hiding } = toast;

  if (!visible) return null;

  const ToastIcon = ICONS[type] || IconInfo;

  return (
    <div
      role="status"
      aria-live="polite"
      className={'toast toast-' + type + (hiding ? ' toast-hide' : '')}
    >
      <span className="toast-icon"><ToastIcon /></span>
      <span className="toast-message">{message}</span>
    </div>
  );
}
