'use client';

import React, { useState } from 'react';
import { Lock, ShieldCheck, X, AlertCircle } from 'lucide-react';
import { loginTeacherAsync, DEFAULT_TEACHER_NAME } from '@/lib/auth/teacher-auth';

export interface TeacherLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (teacherName: string) => void;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [passcode, setPasscode] = useState('');
  const [teacherName, setTeacherName] = useState(DEFAULT_TEACHER_NAME);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const session = await loginTeacherAsync(passcode, teacherName);
      if (session && session.isAuthenticated) {
        onLoginSuccess(teacherName);
        onClose();
      } else {
        setErrorMsg('Invalid teacher passcode. Please try again.');
      }
    } catch {
      setErrorMsg('An unexpected error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-login-title"
      data-testid="teacher-login-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md p-6 rounded-2xl bg-stone-900/95 border border-stone-800 text-stone-100 shadow-2xl space-y-5 animate-modal-scale"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 24px 48px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Login Modal"
          data-testid="close-login-modal-btn"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 id="teacher-login-title" className="text-base font-semibold text-stone-100">
              Teacher Authentication
            </h2>
            <p className="text-xs text-stone-400">
              Enter passcode to unlock teaching tools, controls, and management.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div
            data-testid="login-error-alert"
            className="flex items-center space-x-2 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-300">
              Teacher Name
            </label>
            <input
              type="text"
              data-testid="teacher-name-input"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="e.g. Injasraj"
              className="w-full px-3.5 py-2 rounded-xl bg-stone-950/80 border border-stone-800 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-300">
              Teacher Passcode
            </label>
            <input
              type="password"
              data-testid="teacher-passcode-input"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter teacher passcode"
              autoFocus
              className="w-full px-3.5 py-2 rounded-xl bg-stone-950/80 border border-stone-800 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 transition-colors font-mono"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800/80 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="submit-login-btn"
              disabled={isSubmitting || !passcode}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-stone-950 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Verifying...' : 'Unlock Teacher Hub'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
