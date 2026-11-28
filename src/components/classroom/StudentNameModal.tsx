'use client';

import React, { useState } from 'react';
import { User, ArrowRight, Sparkles } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';

export interface StudentNameModalProps {
  isOpen: boolean;
  initialName?: string;
  onJoin: (name: string) => void;
}

export const STUDENT_NAME_STORAGE_KEY = 'injasraj_student_name';
export const STUDENT_DEVICE_ID_STORAGE_KEY = 'injasraj_student_device_id';

export function getOrCreateStudentDeviceId(): string {
  if (typeof window === 'undefined') return 'server_student_device';
  try {
    let deviceId = localStorage.getItem(STUDENT_DEVICE_ID_STORAGE_KEY);
    if (!deviceId || !deviceId.trim()) {
      deviceId = `student_dev_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
      localStorage.setItem(STUDENT_DEVICE_ID_STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return 'fallback_student_device';
  }
}

export const StudentNameModal: React.FC<StudentNameModalProps> = ({
  isOpen,
  initialName = '',
  onJoin,
}) => {
  const [name, setName] = useState<string>(initialName);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to join the classroom.');
      return;
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STUDENT_NAME_STORAGE_KEY, trimmed);
      } catch {}
    }
    onJoin(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-name-title"
      data-testid="student-name-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-md bg-stone-900 border border-stone-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 animate-modal-scale">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            <User className="w-6 h-6" />
          </div>
          <h2
            id="student-name-title"
            className="text-xl font-bold tracking-tight text-stone-100"
          >
            Welcome to Class
          </h2>
          <p className="text-xs sm:text-sm text-stone-400">
            Please enter your name so your teacher and peers can recognize you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="student-display-name-input"
              className="block text-xs font-medium text-stone-300"
            >
              Your Name
            </label>
            <div className="relative">
              <input
                id="student-display-name-input"
                data-testid="student-display-name-input"
                type="text"
                autoFocus
                placeholder="e.g. Harpreet Kaur"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition-all"
              />
            </div>
            {error && (
              <p
                data-testid="student-name-error"
                className="text-xs text-rose-400 mt-1 font-medium"
              >
                {error}
              </p>
            )}
          </div>

          <GlassButton
            type="submit"
            variant="primary"
            data-testid="student-name-submit-btn"
            className="w-full py-2.5 text-sm font-semibold flex items-center justify-center space-x-2"
          >
            <span>Enter Classroom</span>
            <ArrowRight className="w-4 h-4" />
          </GlassButton>
        </form>

        <p className="text-[11px] text-center text-stone-500">
          Injasraj
        </p>
      </div>
    </div>
  );
};
