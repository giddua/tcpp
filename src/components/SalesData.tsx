import React, { useEffect, useState } from 'react';
import { Database, Download, Filter, RefreshCw, Search } from 'lucide-react';

interface SalesDataProps {
  onSync?: () => void;
  isSyncing?: boolean;
}

export default function SalesData({ onSync, isSyncing }: SalesDataProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const userEmail = localStorage.getItem('tcpp_user_email') || 'None';
      const response = await fetch('/api/sales-data', {
        headers: {
          'x-user-email': userEmail
        }
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || 'Failed to fetch sales data');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 flex-1">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            <a className="hover:text-[#003461]" href="#">Parameters</a>
            <span className="mx-2">/</span>
            <span className="text-[#003461]">Sales Data</span>
          </nav>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400">Sales Data (Snowflake)</h2>
          <p className="text-slate-500 mt-2 max-w-2xl text-sm">
            Real-time sales records fetched directly from Snowflake (limited to the first 500 rows to ensure optimal application performance and memory stability). Use the synchronize button to push these records to the SQL Server production environment.
          </p>
        </div>

        {onSync && (
          <button 
            onClick={onSync}
            disabled={isSyncing}
            className="bg-[#003461] text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 font-bold text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{isSyncing ? 'Synchronizing...' : 'Synchronize Now'}</span>
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 gap-1">
            <h3 className="font-bold text-[#003461] dark:text-blue-400 text-sm uppercase tracking-wider">Source Data Matrix</h3>
            {!loading && !error && data.length > 0 && (
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700/50">
                {data.length} Records Retrieved {data.length >= 500 && '— Limit 500 rows'}
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            <button className="p-1.5 text-slate-400 hover:text-[#003461] transition-colors"><Filter className="w-5 h-5" /></button>
            <button className="p-1.5 text-slate-400 hover:text-[#003461] transition-colors"><Download className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Database className="w-12 h-12 mx-auto mb-4 animate-pulse opacity-20" />
              <p className="font-bold uppercase tracking-widest text-xs">Loading Snowflake Data...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">
              <p className="font-bold uppercase tracking-widest text-xs mb-2">Connection Error</p>
              <p className="text-sm">{error}</p>
              <button 
                onClick={fetchSalesData}
                className="mt-4 text-xs font-bold underline underline-offset-4"
              >
                Retry Connection
              </button>
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p className="font-bold uppercase tracking-widest text-xs">No data found in Snowflake table 'sales_data'</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                  {Object.keys(data[0]).map((key) => (
                    <th key={key} className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-400">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="px-6 py-4 text-sm text-slate-600 font-medium">
                        {val?.toString() || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
