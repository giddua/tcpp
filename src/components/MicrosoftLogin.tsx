import React, { useEffect, useState, useCallback } from 'react';
import { Shield, Lock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthStatus {
  success: boolean;
  message?: string;
  error?: string;
}

interface MicrosoftLoginProps {
  onLoginSuccess: (name: string, email: string, jobTitle: string, role: string) => void;
}

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default function MicrosoftLogin({ onLoginSuccess }: MicrosoftLoginProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<AuthStatus | null>(null);

  const handleAuthResult = useCallback((event: MessageEvent) => {
    if (!event.data || event.data.type !== 'MICROSOFT_AUTH_RESULT') {
      return;
    }

    setIsProcessing(false);
    const { success, error, token, displayName, email, jobTitle, role } = event.data;

    if (success && token) {
      setStatus({ success: true, message: 'Login Successful' });
      localStorage.setItem('tcpp_jwt_token', token);
      localStorage.setItem('tcpp_user_name', displayName || '');
      localStorage.setItem('tcpp_user_email', email || '');
      localStorage.setItem('tcpp_user_job_title', jobTitle || '');
      localStorage.setItem('tcpp_user_role', role || 'User');
      onLoginSuccess(displayName || '', email || '', jobTitle || '', role || 'User');
    } else {
      setStatus({ success: false, error: error || 'Login Unsuccessful' });
    }
  }, [onLoginSuccess]);

  useEffect(() => {
    window.addEventListener('message', handleAuthResult);
    return () => window.removeEventListener('message', handleAuthResult);
  }, [handleAuthResult]);

  const handleMicrosoftLogin = async () => {
    setIsProcessing(true);
    setStatus(null);

    try {
      const response = await fetch('/api/auth/microsoft/url');
      const result = await response.json();

      if (!response.ok || !result.url) {
        setIsProcessing(false);
        setStatus({ success: false, error: result.error || 'Unable to start Microsoft sign-in.' });
        return;
      }

      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        result.url,
        'Microsoft Sign In',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        setIsProcessing(false);
        setStatus({ success: false, error: 'Popup blocked. Please allow popups for this site and try again.' });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setStatus({ success: false, error: err.message });
    }
  };

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[600px] max-w-xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="bg-[#003461] p-6 text-white flex items-center space-x-3">
          <Shield className="w-8 h-8" />
          <div>
            <h2 className="text-xl font-bold uppercase tracking-widest">Login</h2>
            <p className="text-blue-200 text-xs mt-1">Sign in with your Vollrath Microsoft account</p>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <button
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={isProcessing}
            className="w-full bg-white text-[#191c1e] border border-slate-300 py-4 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center space-x-3 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Waiting for Microsoft sign-in...</span>
              </>
            ) : (
              <>
                <MicrosoftLogo />
                <span>Sign in with Microsoft</span>
              </>
            )}
          </button>

          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className={`p-4 rounded-xl border flex items-start space-x-3 ${status.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {status.success ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <XCircle className="w-5 h-5 mt-0.5" />}
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider">
                      {status.success ? 'Login Successful' : 'Login Unsuccessful'}
                    </h4>
                    {status.error && <p className="text-xs mt-1 opacity-80">{status.error}</p>}
                    {status.message && <p className="text-xs mt-1 opacity-80">{status.message}</p>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 text-center border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center">
            <Lock className="w-3 h-3 mr-2" />
            Single Sign-On via Microsoft Entra ID
          </p>
        </div>
      </motion.div>
    </div>
  );
}
