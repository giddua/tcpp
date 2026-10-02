import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SkippedRow {
  row: number;
  customerId: string;
  reason: string;
}

interface UploadResult {
  message: string;
  inserted: number;
  updated: number;
  skipped: SkippedRow[];
}

export default function CustomerRebateBulkUpload() {
  const [permission] = useState<'READ_WRITE' | 'READ_ONLY' | 'NO_ACCESS'>('READ_WRITE');
  const [programYear, setProgramYear] = useState<string>(String(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    setError(null);
    setFile(e.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose a spreadsheet to upload.');
      return;
    }
    const year = parseInt(programYear, 10);
    if (isNaN(year)) {
      setError('Please enter a valid Program Year.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ProgramYear', String(year));

      const userName = localStorage.getItem('tcpp_user_name') || 'None';
      const userEmail = localStorage.getItem('tcpp_user_email') || 'None';

      const response = await fetch('/api/customer-rebates/bulk-upload', {
        method: 'POST',
        headers: {
          'x-user-name': userName,
          'x-user-email': userEmail,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.details || data.error || 'Upload failed.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (permission === 'NO_ACCESS') {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-slate-500">
        <AlertTriangle className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-bold uppercase tracking-widest">Access Denied</h3>
        <p className="text-sm mt-2">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400 flex items-center">
          <FileSpreadsheet className="w-7 h-7 mr-3 text-[#003461]" />
          Customer Rebate Bulk Upload
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload a spreadsheet to update Tier and Rebate Percent for many customers at once. Only the{' '}
          <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">COMBINED</span> sheet is read.
          Column A is Customer ID, column E is Specific Rebate Code, column G is Tier, and column H is Rebate
          Percent.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-none" />
          <span>
            Customer ID must be unique in the spreadsheet. If the same Customer ID appears on more than one row,
            only the first occurrence is applied, and every later row for that Customer ID is skipped and listed
            below as a duplicate.
          </span>
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Program Year
          </label>
          <input
            type="number"
            value={programYear}
            onChange={(e) => setProgramYear(e.target.value)}
            disabled={permission === 'READ_ONLY'}
            className="w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-slate-400">Every row in the spreadsheet is applied to this Program Year.</p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Spreadsheet (.xlsx)
          </label>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            disabled={permission === 'READ_ONLY'}
            className="block w-full text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
          />
        </div>

        {permission === 'READ_WRITE' && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || !file}
            className="w-full bg-[#003461] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-blue-800 transition-all flex items-center justify-center space-x-3 shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-5 h-5" />
                <span>Upload and Apply</span>
              </>
            )}
          </button>
        )}

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="p-4 rounded-xl border bg-red-50 border-red-200 text-red-800 flex items-start space-x-3">
                <XCircle className="w-5 h-5 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider">Upload Failed</h4>
                  <p className="text-xs mt-1 opacity-80">{error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider">Upload Complete</h4>
                  <p className="text-xs mt-1 opacity-80">{result.message}</p>
                </div>
              </div>

              {result.skipped.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center space-x-2 text-amber-800 border-b border-amber-200">
                    <AlertTriangle className="w-4 h-4" />
                    <h4 className="font-bold text-xs uppercase tracking-wider">
                      {result.skipped.length} Row{result.skipped.length === 1 ? '' : 's'} Skipped
                    </h4>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-100 text-amber-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left font-bold uppercase tracking-wider">Row</th>
                          <th className="px-4 py-2 text-left font-bold uppercase tracking-wider">Customer ID</th>
                          <th className="px-4 py-2 text-left font-bold uppercase tracking-wider">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.skipped.map((s, i) => (
                          <tr key={i} className="border-t border-amber-100">
                            <td className="px-4 py-2">{s.row}</td>
                            <td className="px-4 py-2 font-mono">{s.customerId}</td>
                            <td className="px-4 py-2">{s.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
