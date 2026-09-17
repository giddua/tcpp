import React, { useState, useEffect } from 'react';
import { Shield, Save, Key, Database, Server, CheckCircle2 } from 'lucide-react';

export default function SecretsManager() {
  const [secrets, setSecrets] = useState({
    JWT_PHRASE: '',
    SNOWFLAKE_ACCOUNT: '',
    SNOWFLAKE_USERNAME: '',
    SNOWFLAKE_PASSWORD: '',
    SNOWFLAKE_DATABASE: '',
    SNOWFLAKE_SCHEMA: '',
    SNOWFLAKE_WAREHOUSE: '',
    SQL_SERVER_USER: '',
    SQL_SERVER_PASSWORD: '',
    SQL_SERVER_SERVER: '',
    SQL_SERVER_DATABASE: '',
    SQL_SERVER_PORT: '1433',
    SQL_SERVER_TRUST_CERT: true,
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USER: '',
    SMTP_PASS: '',
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState<{
    snowflake: { status: 'idle' | 'loading' | 'success' | 'error'; message?: string; details?: string };
    sql: { status: 'idle' | 'loading' | 'success' | 'error'; message?: string; details?: string };
  }>({
    snowflake: { status: 'idle' },
    sql: { status: 'idle' },
  });

  useEffect(() => {
    fetchSecrets();
  }, []);

  const fetchSecrets = async () => {
    try {
      const response = await fetch('/api/secrets');
      if (response.ok) {
        const data = await response.json();
        setSecrets(prev => {
          const next = { ...prev };
          Object.keys(data).forEach(key => {
            if (key in next) {
              if (data[key] !== undefined && data[key] !== null) {
                (next as any)[key] = data[key];
              }
            }
          });
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to fetch secrets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSecrets(prev => ({ ...prev, [name]: value }));
    setIsSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(false);
    
    try {
      // Map UI keys to backend env keys if necessary
      const payload = {
        ...secrets,
        SQL_SERVER_TRUST_SERVER_CERTIFICATE: secrets.SQL_SERVER_TRUST_CERT ? 'true' : 'false'
      };

      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      } else {
        alert('Failed to save secrets');
      }
    } catch (error) {
      console.error('Error saving secrets:', error);
      alert('Error saving secrets');
    }
  };

  const testConnection = async (type: 'snowflake' | 'sql') => {
    setTestResults(prev => ({
      ...prev,
      [type]: { status: 'loading' }
    }));

    try {
      let endpoint = '';
      if (type === 'snowflake') {
        endpoint = '/api/test-snowflake';
      } else {
        endpoint = '/api/test-sql';
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(secrets),
      });

      const result = await response.json();

      if (response.ok) {
        setTestResults(prev => ({
          ...prev,
          [type]: { status: 'success', message: result.message }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [type]: { status: 'error', message: result.error, details: result.details }
        }));
      }
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        [type]: { status: 'error', message: 'Network error', details: error.message }
      }));
    }
  };

  return (
    <div className="p-8 flex-1 max-w-4xl">
      <div className="mb-8">
        <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          <a className="hover:text-[#003461]" href="#">System</a>
          <span className="mx-2">/</span>
          <span className="text-[#003461]">Secrets Configuration</span>
        </nav>
        <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400">Secrets Configuration</h2>
        <p className="text-slate-500 mt-2 text-sm">
          Manage your credentials for JWT Authentication, Snowflake, SQL Server, and SMTP. These values are used for security, data synchronization, and reporting.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* JWT Section */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center">
            <Key className="w-5 h-5 text-[#003461] mr-2" />
            <h3 className="font-bold text-[#003461] dark:text-blue-400 text-sm uppercase tracking-wider">JWT Configuration</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 col-span-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">JWT Secret Phrase (JWT_PHRASE)</label>
                <input 
                  name="JWT_PHRASE"
                  value={secrets.JWT_PHRASE}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="e.g. VOLLRATH_TCPP_202609"
                  type="password"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              This secret phrase is used by the server to sign and verify JWT authentication tokens.
            </p>
          </div>
        </div>

        {/* Snowflake Section */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center">
              <Database className="w-5 h-5 text-[#003461] mr-2" />
              <h3 className="font-bold text-[#003461] dark:text-blue-400 text-sm uppercase tracking-wider">Snowflake Credentials</h3>
            </div>
            <button 
              type="button"
              onClick={() => testConnection('snowflake')}
              disabled={testResults.snowflake.status === 'loading'}
              className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {testResults.snowflake.status === 'loading' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Account</label>
              <input 
                name="SNOWFLAKE_ACCOUNT"
                value={secrets.SNOWFLAKE_ACCOUNT}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="e.g. xy12345.us-east-1"
                type="text"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Username</label>
              <input 
                name="SNOWFLAKE_USERNAME"
                value={secrets.SNOWFLAKE_USERNAME}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                type="text"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Password</label>
              <input 
                name="SNOWFLAKE_PASSWORD"
                value={secrets.SNOWFLAKE_PASSWORD}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                type="password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Database</label>
              <input 
                name="SNOWFLAKE_DATABASE"
                value={secrets.SNOWFLAKE_DATABASE}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                type="text"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Schema</label>
              <input 
                name="SNOWFLAKE_SCHEMA"
                value={secrets.SNOWFLAKE_SCHEMA}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="e.g. PUBLIC"
                type="text"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Warehouse</label>
              <input 
                name="SNOWFLAKE_WAREHOUSE"
                value={secrets.SNOWFLAKE_WAREHOUSE}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="e.g. COMPUTE_WH"
                type="text"
              />
            </div>
          </div>
        </div>
          
          {testResults.snowflake.status !== 'idle' && (
            <div className={`px-6 py-3 text-xs border-t ${
              testResults.snowflake.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
              testResults.snowflake.status === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'
            }`}>
              <div className="font-bold uppercase tracking-widest text-[9px] mb-1">
                Test Result: {testResults.snowflake.status.toUpperCase()}
              </div>
              <p>{testResults.snowflake.message}</p>
              {testResults.snowflake.details && (
                <p className="mt-1 font-mono text-[10px] opacity-80">{testResults.snowflake.details}</p>
              )}
            </div>
          )}
        </div>

        {/* SQL Server Section */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center">
              <Server className="w-5 h-5 text-[#003461] mr-2" />
              <h3 className="font-bold text-[#003461] dark:text-blue-400 text-sm uppercase tracking-wider">SQL Server Credentials</h3>
            </div>
            <button 
              type="button"
              onClick={() => testConnection('sql')}
              disabled={testResults.sql.status === 'loading'}
              className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {testResults.sql.status === 'loading' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Server Address</label>
              <input 
                name="SQL_SERVER_SERVER"
                value={secrets.SQL_SERVER_SERVER}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="e.g. sqlserver.example.com"
                type="text"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Database Name</label>
              <input 
                name="SQL_SERVER_DATABASE"
                value={secrets.SQL_SERVER_DATABASE}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                type="text"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">User</label>
              <input 
                name="SQL_SERVER_USER"
                value={secrets.SQL_SERVER_USER}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                type="text"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Password</label>
              <input 
                name="SQL_SERVER_PASSWORD"
                value={secrets.SQL_SERVER_PASSWORD}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                type="password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Port</label>
              <input 
                name="SQL_SERVER_PORT"
                value={secrets.SQL_SERVER_PORT}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="1433"
                type="text"
              />
            </div>
            <div className="flex items-center space-x-2 pt-4">
              <input 
                id="SQL_SERVER_TRUST_CERT"
                name="SQL_SERVER_TRUST_CERT"
                type="checkbox"
                checked={secrets.SQL_SERVER_TRUST_CERT}
                onChange={(e) => setSecrets(prev => ({ ...prev, SQL_SERVER_TRUST_CERT: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="SQL_SERVER_TRUST_CERT" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer">
                Trust Server Certificate (Fixes self-signed cert errors)
              </label>
            </div>
          </div>
        </div>

          {testResults.sql.status !== 'idle' && (
            <div className={`px-6 py-3 text-xs border-t ${
              testResults.sql.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
              testResults.sql.status === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'
            }`}>
              <div className="font-bold uppercase tracking-widest text-[9px] mb-1">
                Test Result: {testResults.sql.status.toUpperCase()}
              </div>
              <p>{testResults.sql.message}</p>
              {testResults.sql.details && (
                <p className="mt-1 font-mono text-[10px] opacity-80">{testResults.sql.details}</p>
              )}
            </div>
          )}
        </div>

        {/* SMTP Section */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center">
            <Server className="w-5 h-5 text-[#003461] mr-2" />
            <h3 className="font-bold text-[#003461] dark:text-blue-400 text-sm uppercase tracking-wider">SMTP Server (Email)</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SMTP Host</label>
                <input 
                  name="SMTP_HOST"
                  value={secrets.SMTP_HOST}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="e.g. smtp.gmail.com"
                  type="text"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SMTP Port</label>
                <input 
                  name="SMTP_PORT"
                  value={secrets.SMTP_PORT}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="587"
                  type="text"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SMTP User (Email)</label>
                <input 
                  name="SMTP_USER"
                  value={secrets.SMTP_USER}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="your-email@gmail.com"
                  type="text"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SMTP Password / App Password</label>
                <input 
                  name="SMTP_PASS"
                  value={secrets.SMTP_PASS}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  type="password"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Note: For Gmail, use an "App Password" if you have 2FA enabled.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            type="submit"
            className="flex items-center space-x-2 bg-[#003461] text-white px-8 py-3 rounded hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 font-bold text-sm"
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Configuration Saved</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Secrets</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3">
        <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Security Notice</h4>
          <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
            These secrets are used to establish secure connections to your data sources. In a production environment, these values are stored in a secure vault and are never exposed to the client-side application.
          </p>
        </div>
      </div>
    </div>
  );
}
