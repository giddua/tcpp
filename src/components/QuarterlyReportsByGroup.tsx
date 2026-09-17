import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  TrendingUp,
  Layers,
  Download,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import Select from 'react-select';

interface GroupRecord {
  GroupId: number;
  GroupName: string;
}

export default function QuarterlyReportsByGroup() {
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);

  // Exporting state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const response = await fetch('/api/reports/finance/groups');
      if (!response.ok) {
        throw new Error('Failed to retrieve groups from SQL Server.');
      }
      const data = await response.json();
      setGroups(data);
    } catch (err: any) {
      console.error('Error fetching groups:', err);
      setGroupsError(err.message || 'An error occurred while fetching group masters.');
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleGroupChange = async (option: any) => {
    if (!option) {
      setSelectedGroupId(null);
      setSelectedGroupName('');
      setTableNames([]);
      setSelectedTableName(null);
      setHasQueried(false);
      setTableError(null);
      setExportError(null);
      setExportSuccess(null);
      return;
    }

    const groupId = option.value;
    setSelectedGroupId(groupId);
    setSelectedGroupName(option.labelName);
    
    setLoadingTable(true);
    setTableError(null);
    setTableNames([]);
    setSelectedTableName(null);
    setHasQueried(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const response = await fetch(`/api/reports/quarterly/group-table?groupId=${groupId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch group table name from Snowflake.');
      }
      const result = await response.json();
      const fetchedNames = result.tableNames || [];
      setTableNames(fetchedNames);
      
      // Auto-select if there is exactly one
      if (fetchedNames.length === 1) {
        const singleTableName = fetchedNames[0];
        setSelectedTableName(singleTableName);
      }
    } catch (err: any) {
      console.error('Error fetching group table:', err);
      setTableError(err.message || 'An error occurred while contacting Snowflake.');
    } finally {
      setLoadingTable(false);
    }
  };

  const handleExportExcel = async (tableName: string) => {
    if (!tableName) return;
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const response = await fetch(`/api/reports/quarterly/group-export?tableName=${encodeURIComponent(tableName)}`);
      
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({}));
        throw new Error(errorResult.details || errorResult.error || 'Export server request failed.');
      }

      const blob = await response.blob();
      const filename = `${tableName}.xlsm`;

      // Present the user with the File Dialog to select directory & name
      try {
        setUsedFallback(false);
        if (typeof (window as any).showSaveFilePicker === 'function') {
          const pickerOptions: any = {
            suggestedName: filename,
            types: [{
              description: 'Excel Macro-Enabled Workbook (.xlsm)',
              accept: {
                'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm']
              }
            }]
          };

          const handle = await (window as any).showSaveFilePicker(pickerOptions);
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setExportSuccess(`Successfully populated and saved spreadsheet to chosen directory!`);
        } else {
          // Fallback to classic anchor download
          setUsedFallback(true);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          setExportSuccess(`Downloaded spreadsheet successfully!`);
        }
      } catch (pickerErr: any) {
        if (pickerErr instanceof Error && pickerErr.name === 'AbortError') {
          // User cancelled the file dialog picker, which is normal behavior
          console.log('User cancelled the download dialog.');
          return;
        }
        console.warn('showSaveFilePicker failed or was blocked, falling back to standard download:', pickerErr);
        // Fallback to standard download
        setUsedFallback(true);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setExportSuccess(`Downloaded spreadsheet successfully!`);
      }
    } catch (err: any) {
      console.error('Failed to export metrics to target Excel Template:', err);
      setExportError(err.message || 'Unknown error during template population.');
    } finally {
      setExporting(false);
    }
  };

  const handleTableSelectionChange = (tableName: string) => {
    setSelectedTableName(tableName);
    setExportSuccess(null);
    setExportError(null);
  };

  const groupOptions = useMemo(() => {
    return groups.map(g => ({
      value: g.GroupId,
      label: `${g.GroupId} - ${g.GroupName}`,
      labelName: g.GroupName
    }));
  }, [groups]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8" id="quarterly-reports-by-group-container">
      {/* Breadcrumbs */}
      <div>
        <nav className="text-sm font-medium text-slate-500 mb-2">
          Reports / <span className="text-[#003461] font-semibold">Quarterly Reports by Group</span>
        </nav>
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <Layers className="h-6 w-6 text-[#003461] dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400">Quarterly Reports by Group</h2>
            <p className="text-slate-500 mt-1 max-w-2xl text-sm">
              Discover, query, and build custom excel spreadsheets from corresponding Snowflake data-export tables for rebate family groups.
            </p>
          </div>
        </div>
      </div>

      {/* Main Controls Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="max-w-xl">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Select Rebate Group
          </label>
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <Select
                options={groupOptions}
                isLoading={loadingGroups}
                onChange={handleGroupChange}
                isClearable
                placeholder={loadingGroups ? "Loading groups..." : "Select Group ID or Group Name..."}
                className="text-sm font-medium text-slate-700"
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    boxShadow: 'none',
                    minHeight: '42px',
                    '&:hover': { border: '1px solid #cbd5e1' }
                  }),
                  option: (base, state) => ({
                    ...base,
                    fontSize: '13px',
                    fontWeight: '600',
                    backgroundColor: state.isSelected ? '#003461' : base.backgroundColor,
                    '&:hover': { backgroundColor: state.isSelected ? '#003461' : '#f1f5f9' }
                  })
                }}
              />
            </div>
          </div>
          {groupsError && (
            <div className="mt-3 flex items-start space-x-2 text-red-600 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg text-xs font-semibold">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{groupsError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Lookup Output section */}
      {hasQueried && (
        <div className="transition-all duration-300 space-y-6">
          {loadingTable ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <Loader2 className="h-8 w-8 text-[#003461] animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-500">Querying Snowflake Information Schema...</p>
            </div>
          ) : tableError ? (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-6 flex items-start space-x-4">
              <div className="p-2 bg-red-100 dark:bg-red-950/50 rounded-lg text-red-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-red-800 dark:text-red-400 text-lg">Snowflake Query Failed</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">{tableError}</p>
              </div>
            </div>
          ) : tableNames.length > 0 ? (
            <div className="space-y-6">
              {/* Table selection list */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">
                      Snowflake Tables Found ({tableNames.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      The query returned multiple matching tables. Please select one to populate template & download:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tableNames.map((name) => {
                    const isSelected = selectedTableName === name;
                    return (
                      <button
                        key={name}
                        onClick={() => handleTableSelectionChange(name)}
                        className={`text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                          isSelected
                            ? 'border-[#003461] bg-[#003461]/5 dark:bg-blue-950/20 ring-2 ring-[#003461]'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-900/50'
                        }`}
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <Database className={`h-5 w-5 flex-shrink-0 ${isSelected ? 'text-[#003461] dark:text-blue-400' : 'text-slate-400'}`} />
                          <span className={`font-mono text-sm font-semibold truncate ${isSelected ? 'text-[#003461] dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {name}
                          </span>
                        </div>
                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                          isSelected 
                            ? 'border-[#003461] bg-[#003461] text-white' 
                            : 'border-slate-300 group-hover:border-slate-400'
                        }`}>
                          {isSelected && <CheckCircle2 className="h-4.5 w-4.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Loader during table populate export */}
              {exporting && (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Loader2 className="h-8 w-8 text-[#003461] animate-spin mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Processing Excel Document Generation</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Copying template to <span className="font-mono">{selectedTableName}.xlsm</span> & writing Snowflake rows...
                  </p>
                </div>
              )}

              {/* Export error */}
              {exportError && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-6 flex items-start space-x-4">
                  <div className="p-2 bg-red-100 dark:bg-red-950/50 rounded-lg text-red-600">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-800 dark:text-red-400 text-lg">Excel Generation Failed</h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">{exportError}</p>
                  </div>
                </div>
              )}

              {/* Selected table display details & Export Success state */}
              {selectedTableName && !exporting && !exportError && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fadeIn">
                  <div className={`px-6 py-4 flex items-center justify-between text-white transition-colors duration-200 ${
                    exportSuccess ? 'bg-[#003461]' : 'bg-slate-700'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <FileSpreadsheet className="h-5 w-5 text-blue-300" />
                      <span className="font-semibold text-sm uppercase tracking-wider">
                        {exportSuccess ? 'Spreadsheet Ready' : 'Spreadsheet Configuration'}
                      </span>
                    </div>
                    {exportSuccess ? (
                      <div className="flex items-center space-x-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Saved & Processed</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5 text-xs font-semibold bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/30">
                        <Info className="h-3.5 w-3.5" />
                        <span>Awaiting Download</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                          Generated File Name
                        </label>
                        <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight font-mono select-all bg-slate-50 dark:bg-slate-950 px-4 py-3 rounded-lg border border-slate-100 dark:border-slate-900 inline-block">
                          {selectedTableName}.xlsm
                        </div>
                      </div>

                      <button
                        onClick={() => handleExportExcel(selectedTableName)}
                        className={`inline-flex items-center justify-center space-x-2.5 px-6 py-3.5 transition-all text-white font-bold text-sm rounded-lg shadow-md self-start active:scale-[0.98] ${
                          exportSuccess 
                            ? 'bg-[#003461] hover:bg-opacity-90' 
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        <Download className="h-5 w-5" />
                        <span>{exportSuccess ? 'Download Spreadsheet Again' : 'Download Spreadsheet'}</span>
                      </button>
                    </div>

                    {exportSuccess && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 p-4 rounded-lg text-sm flex items-start space-x-2.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span>{exportSuccess}</span>
                      </div>
                    )}

                    <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200/50 dark:border-slate-800 text-xs">
                      <h4 className="font-bold text-[#003461] dark:text-blue-400 uppercase tracking-wider text-[11px] flex items-center">
                        <Database className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        Native Save File Picker
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        We use the modern browser File System Access API. Clicking <span className="font-semibold text-slate-800 dark:text-slate-200">Download Spreadsheet</span> will present a native dialog allowing you to select <strong className="text-slate-800 dark:text-slate-200">any folder or directory</strong> on your computer.
                      </p>
                      <p className="text-[10px] text-slate-500 bg-white dark:bg-slate-900/60 p-2 rounded border border-slate-100 dark:border-slate-800/40 leading-normal">
                        💡 <strong>IFrame Sandbox Note:</strong> Browser security rules block custom directory pickers inside embedded previews. To test direct directory selection, click the <strong>Open in New Tab</strong> link at the top-right. Otherwise, it falls back to your browser's default Downloads folder.
                      </p>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-start space-x-3 text-slate-500 text-sm">
                      <HelpCircle className="h-5 w-5 text-[#003461] dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">File Storage Detail:</span> The file has been written using <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-[#003461] dark:text-blue-400 text-xs">xlsx-populate</code> on the server environment. The workbook sheet <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-[#003461] dark:text-blue-400 text-xs">Snowflake_Data</code> has been fully populated with the latest records queried dynamically from Snowflake schema <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-[#003461] dark:text-blue-400 text-xs">PRD_DATA_EXPORTS</code>.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-6 flex items-start space-x-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-950/50 rounded-lg text-amber-600">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-400 text-lg">No report found for this group</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
                  No tables matching the pattern <code className="bg-amber-100 dark:bg-amber-950/60 px-1 py-0.5 rounded font-mono text-xs font-semibold">%{selectedGroupId}</code> were detected under schema <code className="bg-amber-100 dark:bg-amber-950/60 px-1 py-0.5 rounded font-mono text-xs font-semibold">PRD_DATA_EXPORTS</code>.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Informational Hero Card if no group is selected yet */}
      {!hasQueried && (
        <div className="bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-900 p-8 text-center max-w-2xl mx-auto my-6">
          <TrendingUp className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-slate-700 dark:text-slate-300 font-bold text-lg mb-1">Begin Group Report Analysis</h3>
          <p className="text-slate-500 text-sm">
            Select a rebate family group from the master list above. We will dynamically scan Snowflake information schema metadata for matching data-export repositories.
          </p>
        </div>
      )}
    </div>
  );
}
