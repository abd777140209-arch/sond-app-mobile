/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  durationMs?: number;
}

type ToastListener = (toast: ToastMessage) => void;

const listeners = new Set<ToastListener>();

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showToast(
  message: string,
  type: ToastType = 'info',
  durationMs: number = 3800
): void {
  const toast: ToastMessage = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    durationMs,
  };
  listeners.forEach((fn) => {
    try {
      fn(toast);
    } catch (e) {
      console.warn('Toast listener error:', e);
    }
  });
}
