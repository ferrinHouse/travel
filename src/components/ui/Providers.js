'use client';

import { ToastProvider } from './Toast';
import { ConfirmProvider } from './ConfirmDialog';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
