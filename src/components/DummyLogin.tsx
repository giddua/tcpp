import React, { useState } from 'react';
import { 
  Shield, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle,
  Loader2,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthStatus {
  success: boolean;
  message?: string;
  error?: string;
}

interface DummyLoginProps {
  onLoginSuccess: (name: string, email: string, jobTitle: string, role: string) => void;
}

export default function DummyLogin({ onLoginSuccess }: DummyLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [step, setStep] = useState<'email' | 'otp'>('email');

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus(null);

    try {
      const response = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setStep('otp');
        setStatus({ success: true, message: result.message });
      } else {
        setStatus({ 
          success: false, 
          error: result.error || 'Login Unsuccessful',
          details: result.details 
        } as any);
      }
    } catch (err: any) {
      setStatus({ success: false, error: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus(null);

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setStatus({ success: true, message: 'Login Successful' });
        if (result.token) {
          localStorage.setItem('tcpp_jwt_token', result.token);
        }
        localStorage.setItem('tcpp_user_name', result.displayName);
        localStorage.setItem('tcpp_user_email', result.email);
        localStorage.setItem('tcpp_user_job_title', result.jobTitle);
        localStorage.setItem('tcpp_user_role', result.role || 'User');
        onLoginSuccess(result.displayName, result.email, result.jobTitle, result.role || 'User');
      } else {
        setStatus({ 
          success: false, 
          error: result.error || 'Login Unsuccessful',
          details: result.details 
        } as any);
      }
    } catch (err: any) {
      setStatus({ success: false, error: err.message });
    } finally {
      setIsProcessing(false);
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
            <p className="text-blue-200 text-xs mt-1">EMail OTP Authentication</p>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <AnimatePresence mode="wait">
            {step === 'email' ? (
              <motion.form 
                key="email-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleRequestOTP} 
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center">
                      <Mail className="w-3 h-3 mr-2" />
                      Email Address
                    </label>
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="e.g. user@example.com"
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-[#003461] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-blue-800 transition-all flex items-center justify-center space-x-3 shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Request OTP</span>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="otp-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOTP} 
                className="space-y-6"
              >
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start space-x-3 text-blue-800">
                  <KeyRound className="w-5 h-5 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider">OTP Sent</h4>
                    <p className="text-xs mt-1 opacity-80">A 6-digit code has been sent to <strong>{email}</strong>.</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    6-Digit One-Time Password
                  </label>
                  <input 
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="000000"
                    required
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-[#003461] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-blue-800 transition-all flex items-center justify-center space-x-3 shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying OTP...</span>
                    </>
                  ) : (
                    <span>Verify & Login</span>
                  )}
                </button>

                <button 
                  type="button"
                  onClick={() => { setStep('email'); setStatus(null); }}
                  className="w-full text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-[#003461] transition-colors"
                >
                  Change Email
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {status && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2"
              >
                <div className={`p-4 rounded-xl border flex items-start space-x-3 ${status.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {status.success ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <XCircle className="w-5 h-5 mt-0.5" />}
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider">
                      {status.success 
                        ? (status.message?.toLowerCase().includes('otp') ? 'OTP Sent Successfully' : 'Login Successful') 
                        : 'Login Unsuccessful'}
                    </h4>
                    {status.error && <p className="text-xs mt-1 opacity-80">{status.error}</p>}
                    {status.message && <p className="text-xs mt-1 opacity-80">{status.message}</p>}
                    {/* Display additional details if available for troubleshooting */}
                    {(status as any).details && (
                      <p className="text-[10px] mt-2 p-2 bg-black/5 dark:bg-white/5 rounded font-mono break-all opacity-60">
                        Details: {(status as any).details}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 text-center border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center">
            <Lock className="w-3 h-3 mr-2" />
            End-to-End Encryption Enabled
          </p>
        </div>
      </motion.div>
    </div>
  );
}
