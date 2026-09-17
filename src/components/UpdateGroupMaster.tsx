import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  RefreshCw, 
  Database, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight,
  Info,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SyncStatus {
  status: 'idle' | 'fetching_snowflake' | 'syncing_sqlserver' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  error?: string;
  startTime?: string;
  endTime?: string;
}

export default function UpdateGroupMaster() {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'idle',
    totalRecords: 0,
    processedRecords: 0
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch the initial last updated timestamp
  const fetchLastUpdate = async () => {
    try {
      const res = await fetch('/api/group-master/last-update');
      if (res.ok) {
        const data = await res.json();
        setLastUpdated(data.lastUpdatedDate);
      }
    } catch (err) {
      console.error('Error fetching last update date:', err);
    }
  };

  // Fetch current synchronization status
  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/group-master/sync-status');
      if (res.ok) {
        const data: SyncStatus = await res.json();
        setSyncStatus(data);

        const active = data.status === 'fetching_snowflake' || data.status === 'syncing_sqlserver';
        setIsSyncing(active);

        if (data.status === 'completed') {
          setSuccessMessage(`Synchronization finished successfully! Processed ${data.totalRecords.toLocaleString()} records.`);
          setIsSyncing(false);
          stopPolling();
          fetchLastUpdate(); // Refresh last updated timestamp
        } else if (data.status === 'failed') {
          setError(data.error || 'The synchronization process failed. Please check Snowflake & SQL Server connection secrets.');
          setIsSyncing(false);
          stopPolling();
        }
      }
    } catch (err) {
      console.error('Error fetching sync status:', err);
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(fetchSyncStatus, 1000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Clean up polling on unmount
  useEffect(() => {
    fetchLastUpdate();
    fetchSyncStatus(); // check if there is an active sync already running

    return () => {
      stopPolling();
    };
  }, []);

  // Monitor status to handle polling start/stop
  useEffect(() => {
    if (isSyncing) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [isSyncing]);

  const handleStartSync = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSyncing(true);

    const userName = localStorage.getItem('tcpp_user_name') || 'None';
    const userEmail = localStorage.getItem('tcpp_user_email') || 'None';

    try {
      const response = await fetch('/api/group-master/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-name': userName,
          'x-user-email': userEmail
        }
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to start synchronization.');
      }

      // Sync started successfully; polling will monitor progress
      setSyncStatus(prev => ({
        ...prev,
        status: 'fetching_snowflake',
        processedRecords: 0,
        totalRecords: 0
      }));
      startPolling();

    } catch (err: any) {
      setError(err.message || 'An error occurred while launching sync.');
      setIsSyncing(false);
    }
  };

  const getStatusBadgeColor = (status: SyncStatus['status']) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'failed': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'fetching_snowflake': return 'bg-sky-50 text-sky-700 border-sky-200 animate-pulse';
      case 'syncing_sqlserver': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: SyncStatus['status']) => {
    switch (status) {
      case 'fetching_snowflake': return 'Downloading from Snowflake';
      case 'syncing_sqlserver': return 'Inserting into SQL Server';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Idle';
    }
  };

  // Calculate dynamic percentage
  const percentage = syncStatus.totalRecords > 0 
    ? Math.min(100, Math.round((syncStatus.processedRecords / syncStatus.totalRecords) * 100)) 
    : 0;

  return (
    <div className="p-8 flex-1 max-w-7xl mx-auto w-full" id="group-master-sync-root">
      {/* Breadcrumb & Title */}
      <div className="mb-8">
        <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          <span className="hover:text-[#003461]">Administration</span>
          <span className="mx-2">/</span>
          <span className="text-[#003461]">Update Group Master</span>
        </nav>
        <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400 flex items-center">
          Update Group Master
        </h2>
        <p className="text-slate-500 mt-2 text-sm max-w-2xl">
          Execute background data synchronization pipelines. Pull group categorizations directly from Snowflake and batch overwrite ref.GroupMaster structures in SQL Server.
        </p>
      </div>

      {/* Alert Notices */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-3 shadow-sm"
          >
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Synchronization Error</h4>
              <p className="text-xs mt-1 text-rose-700 font-medium leading-relaxed">{error}</p>
            </div>
          </motion.div>
        )}

        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-start space-x-3 shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Process Succeeded</h4>
              <p className="text-xs mt-1 text-emerald-700 font-medium leading-relaxed">{successMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Core Controls Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Sync Controller Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-[#003461] dark:text-blue-400 mb-4 flex items-center space-x-2">
              <Database className="w-5 h-5 text-[#003461] dark:text-blue-400" />
              <span>Data Connection Mapping</span>
            </h3>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4 mb-6 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">Snowflake JDE Master</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">PRD_STAGE_JDE90</p>
                </div>
              </div>

              <div className="text-slate-300 dark:text-slate-700 flex flex-col items-center">
                <span className="text-[10px] font-mono font-bold text-blue-500 uppercase">Extract & Transform</span>
                <ArrowRight className="w-5 h-5 mt-1 animate-bounce" />
              </div>

              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">SQL Server Target</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">ref.GroupMaster</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  This execution fetches unique <strong>GroupId (CATEGORY_CODE_ADDRESS_BOOK_08)</strong> and <strong>GroupName (CATEGORY_CODE_ADDRESS_BOOK_08_DESCRIPTION)</strong> pairings.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  Queries are retrieved as a background pipeline and inserted into SQL Server in batch packets to ensure fast performance and prevent socket timeouts.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-400">Current Task Status:</span>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border ${getStatusBadgeColor(syncStatus.status)}`}>
                  {getStatusLabel(syncStatus.status)}
                </span>
              </div>

              <button
                disabled={isSyncing}
                onClick={handleStartSync}
                className={`w-full sm:w-auto px-6 py-3 rounded-lg flex items-center justify-center space-x-2 font-bold text-xs uppercase tracking-widest transition-all ${
                  isSyncing 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                    : 'bg-[#003461] hover:bg-blue-800 text-white shadow-md shadow-blue-900/15 cursor-pointer'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Synchronizing Master...' : 'Start Update Process'}</span>
              </button>
            </div>
          </div>

          {/* Running Counter & Progress Visualizer */}
          {syncStatus.status !== 'idle' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-[#003461] dark:text-blue-400 uppercase tracking-wider flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-slate-400 animate-spin" />
                  <span>Background Pipeline Progress</span>
                </h3>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                  {percentage}%
                </span>
              </div>

              <div className="w-full bg-slate-100 dark:bg-slate-850 rounded-full h-3 mb-6 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Processed Records</p>
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                    {syncStatus.processedRecords.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Est. Records</p>
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                    {syncStatus.totalRecords > 0 ? syncStatus.totalRecords.toLocaleString() : 'Counting...'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Elapsed / Start</p>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-2.5 font-mono">
                    {syncStatus.startTime ? new Date(syncStatus.startTime).toLocaleTimeString() : '--:--:--'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Audit / Last Updates Sidebar Card */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-[#003461] dark:text-blue-400 mb-6 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              <span>Audit Logging</span>
            </h3>

            <div className="space-y-6">
              <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Group Master Last Sync</p>
                {lastUpdated ? (
                  <div className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {new Date(lastUpdated).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-500 font-medium font-mono mt-0.5">
                        {new Date(lastUpdated).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                        No Record Found
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Please start the sync process above.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-3">Table Targets & Keys</h4>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Log Entry Table:</span>
                    <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded">ref.LastUpdates</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Log Row ID:</span>
                    <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded">GroupMaster</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">DDL Key SS_ID:</span>
                    <span className="text-[10px] font-bold text-blue-500 uppercase bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">IDENTITY(1,1)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
