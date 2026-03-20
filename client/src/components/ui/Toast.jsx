import { useToast } from '../../context/ToastContext';

export default function Toast() {
  const { message, type, visible, hiding } = useToast();

  return (
    <div
      className={`toast toast-${type}${hiding ? ' toast-hide' : ''}${!visible ? ' hidden' : ''}`}
    >
      {message}
    </div>
  );
}
