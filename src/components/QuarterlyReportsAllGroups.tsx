import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Download, 
  FolderCheck,
  FolderDown,
  Info,
  RefreshCw
} from 'lucide-react';

interface GroupTableInfo {
  TABLE_NAME: string;
  ROW_COUNT: number;
}

export default function QuarterlyReportsAllGroups() {
  const [tables, setTables] = useState<GroupTableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);

  // Batch Export process state
  const [exporting, setExporting] = useState(false);
  const [currentProgressIndex, setCurrentProgressIndex] = useState<number>(0);
  const [currentTableName, setCurrentTableName] = useState<string>('');
  const [completedTables, setCompletedTables] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    setLoadingTables(true);
    setTablesError(null);
    try {
      const response = await fetch('/api/reports/quarterly/all-groups-tables');
      if (!response.ok) {
        throw new Error('Failed to retrieve list of group tables from Snowflake Information Schema.');
      }
      const data = await response.json();
      const rawTables: GroupTableInfo[] = data.tables || [];
      
      // Standardize field names if lowercase
      const formattedTables = rawTables.map((t: any) => ({
        TABLE_NAME: t.TABLE_NAME || t.table_name || Object.values(t)[0],
        ROW_COUNT: t.ROW_COUNT !== undefined ? Number(t.ROW_COUNT) : (t.row_count !== undefined ? Number(t.row_count) : 0)
      }));

      setTables(formattedTables);
    } catch (err: any) {
      console.error('Error fetching all group tables:', err);
      setTablesError(err.message || 'An error occurred while fetching table names from Snowflake.');
    } finally {
      setLoadingTables(false);
    }
  };

  const handleExportAllGroups = async () => {
    if (tables.length === 0) return;

    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    setCompletedTables([]);
    setCurrentProgressIndex(0);

    let dirHandle: any = null;

    // Prompt user for preferred directory via showDirectoryPicker or fallback
    try {
      if (typeof (window as any).showDirectoryPicker === 'function') {
        dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
      }
    } catch (pickerErr: any) {
      if (pickerErr.name === 'AbortError') {
        setExporting(false);
        return;
      }
      console.warn('showDirectoryPicker was cancelled or unsupported. Falling back to direct browser downloads.', pickerErr);
    }

    const processedList: string[] = [];

    try {
      for (let i = 0; i < tables.length; i++) {
        const tableItem = tables[i];
        const tableName = tableItem.TABLE_NAME;
        
        setCurrentProgressIndex(i + 1);
        setCurrentTableName(tableName);

        // Fetch populated xlsm blob from server
        const response = await fetch(`/api/reports/quarterly/all-groups-export?tableName=${encodeURIComponent(tableName)}`);
        
        if (!response.ok) {
          const errorResult = await response.json().catch(() => ({}));
          throw new Error(errorResult.details || errorResult.error || `Failed to generate report for ${tableName}.`);
        }

        const blob = await response.blob();
        const filename = `${tableName}.xlsm`;

        if (dirHandle) {
          // Save directly into the user's selected directory without prompting again
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } else if (typeof (window as any).showSaveFilePicker === 'function' && i === 0) {
          // Fallback to showSaveFilePicker if showDirectoryPicker failed/unsupported
          try {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: filename,
              types: [{
                description: 'Excel Macro-Enabled Workbook (.xlsm)',
                accept: {
                  'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm']
                }
              }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
          } catch (e: any) {
            // Anchor fallback
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }
        } else {
          // Standard browser download anchor fallback
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          // Small delay to prevent browser from throttling rapid downloads
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        processedList.push(tableName);
        setCompletedTables([...processedList]);
      }

      setExportSuccess(`Successfully populated and saved ${processedList.length} group report spreadsheet(s) to your preferred directory!`);
    } catch (err: any) {
      console.error('Error during batch quarterly report export:', err);
      setExportError(err.message || 'An error occurred during report generation.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#003461] to-[#004b87] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase border border-white/20">
            <FolderDown className="w-4 h-4 text-blue-200" />
            <span>Quarterly Reports Automation</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Quarterly Reports - All Groups</h1>
          <p className="text-blue-100 text-sm leading-relaxed">
            Query all active Group report tables from Snowflake (<span className="font-mono text-xs bg-white/20 px-1.5 py-0.5 rounded">PRD_DATA_EXPORTS</span>), populate each group's data into <span className="font-mono text-xs bg-white/20 px-1.5 py-0.5 rounded">Quarterly_Report_Template.xlsm</span>, and download all generated group spreadsheets into your preferred directory.
          </p>
        </div>
        
        {/* Background decorative element */}
        <FileSpreadsheet className="absolute -right-8 -bottom-8 w-64 h-64 text-white/5 pointer-events-none transform rotate-12" />
      </div>

      {/* Control / Refresh & Status Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-slate-200 text-lg flex items-center space-x-2">
            <Database className="w-5 h-5 text-[#003461]" />
            <span>Snowflake Data Export Schema</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Querying <span className="font-mono font-semibold">INFORMATION_SCHEMA.TABLES</span> where <span className="font-mono font-semibold">ROW_COUNT &gt; 0</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchTables}
            disabled={loadingTables || exporting}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingTables ? 'animate-spin' : ''}`} />
            <span>Refresh List</span>
          </button>

          <button
            onClick={handleExportAllGroups}
            disabled={loadingTables || exporting || tables.length === 0}
            className="flex items-center space-x-2 px-6 py-2.5 bg-[#003461] hover:bg-[#002545] text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting All Groups ({currentProgressIndex}/{tables.length})...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download All Group Reports ({tables.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Box during export */}
      {exporting && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-6 h-6 text-[#003461] animate-spin" />
              <div>
                <h3 className="font-bold text-[#003461] dark:text-blue-300 text-base">
                  Processing Group Reports Batch ({currentProgressIndex} of {tables.length})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Populating <span className="font-mono font-semibold">{currentTableName}.xlsm</span> from Snowflake...
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#003461] bg-blue-100 dark:bg-blue-900/50 px-3 py-1 rounded-full">
              {Math.round((currentProgressIndex / tables.length) * 100)}%
            </span>
          </div>

          {/* Progress bar line */}
          <div className="w-full bg-blue-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-[#003461] h-2 transition-all duration-300 rounded-full"
              style={{ width: `${(currentProgressIndex / tables.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Success banner */}
      {exportSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-6 flex items-start space-x-4 shadow-sm">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-emerald-900 dark:text-emerald-300 text-lg">
              Batch Export Completed Successfully!
            </h3>
            <p className="text-emerald-700 dark:text-emerald-400 text-sm">
              {exportSuccess}
            </p>
            {completedTables.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                {completedTables.map((t) => (
                  <div key={t} className="flex items-center space-x-1.5 bg-emerald-100/50 dark:bg-emerald-900/30 px-2.5 py-1 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="truncate">{t}.xlsm</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error banner */}
      {(tablesError || exportError) && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-6 flex items-start space-x-4">
          <div className="p-2 bg-red-100 dark:bg-red-950/50 rounded-lg text-red-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-red-800 dark:text-red-400 text-lg">An Error Occurred</h3>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">{tablesError || exportError}</p>
          </div>
        </div>
      )}

      {/* Table List / Loading State */}
      {loadingTables ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <Loader2 className="w-10 h-10 text-[#003461] animate-spin mb-4" />
          <p className="text-base font-bold text-slate-700 dark:text-slate-300">Querying Snowflake Information Schema</p>
          <p className="text-xs text-slate-500 mt-1">Retrieving list of tables with row_count &gt; 0 in PRD_DATA_EXPORTS...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">
                Group Data Export Tables ({tables.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                The following Snowflake tables contain active quarterly report records:
              </p>
            </div>

            {tables.length > 0 && (
              <span className="inline-flex items-center px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-[#003461] dark:text-blue-300 font-bold text-xs rounded-full border border-blue-200 dark:border-blue-900">
                {tables.length} Groups Ready
              </span>
            )}
          </div>

          {tables.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No tables with row_count &gt; 0 found in PRD_DATA_EXPORTS.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3.5 px-6">#</th>
                    <th className="py-3.5 px-6">Table Name</th>
                    <th className="py-3.5 px-6 text-right">Row Count</th>
                    <th className="py-3.5 px-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {tables.map((item, index) => {
                    const isDone = completedTables.includes(item.TABLE_NAME);
                    const isCurrent = exporting && currentTableName === item.TABLE_NAME;

                    return (
                      <tr 
                        key={item.TABLE_NAME}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isCurrent ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''
                        }`}
                      >
                        <td className="py-3.5 px-6 text-slate-400 font-mono text-xs">{index + 1}</td>
                        <td className="py-3.5 px-6 font-mono font-semibold text-[#003461] dark:text-blue-400 flex items-center space-x-2">
                          <FileSpreadsheet className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span>{item.TABLE_NAME}</span>
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono text-slate-600 dark:text-slate-400">
                          {item.ROW_COUNT.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-6 text-center">
                          {isDone ? (
                            <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Saved</span>
                            </span>
                          ) : isCurrent ? (
                            <span className="inline-flex items-center space-x-1 text-xs font-bold text-[#003461] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-900">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Generating</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Ready</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
