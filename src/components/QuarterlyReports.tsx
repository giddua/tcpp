import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Loader2, 
  AlertCircle, 
  FileText, 
  Check, 
  Info,
  Building2,
  Tag,
  Database,
  Download
} from 'lucide-react';
import { motion } from 'motion/react';


interface SnowflakeCustomer {
  CUSTOMER_NUMBER: string;
  CUSTOMER_NAME: string;
  GROUP_NAME: string | null;
}

export default function QuarterlyReports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<SnowflakeCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<SnowflakeCustomer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // States for associated entity table lookup
  const [entityTableName, setEntityTableName] = useState<string | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);

  // States for dynamic report data retrieval and download
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) {
      setError('Please enter a customer name or part of a name to search.');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedCustomer(null);
    setEntityTableName(null);
    setEntityError(null);
    setDataError(null);
    setDownloadSuccess(null);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/reports/quarterly/customers?q=${encodeURIComponent(term)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data from Snowflake database.');
      }
      const data = await response.json();
      setCustomers(data);
    } catch (err: any) {
      console.error('Snowflake search error:', err);
      setError(err.message || 'An error occurred while querying Snowflake.');
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = async (customer: SnowflakeCustomer) => {
    setSelectedCustomer(customer);
    setEntityTableName(null);
    setEntityError(null);
    setDataError(null);
    setDownloadSuccess(null);

    const group = customer.GROUP_NAME ? customer.GROUP_NAME.trim() : '';
    if (!group) {
      setEntityError('No Group Name associated with selection.');
      return;
    }

    setEntityLoading(true);
    try {
      const response = await fetch(`/api/reports/quarterly/entity?groupName=${encodeURIComponent(group)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch group entity from Snowflake.');
      }
      const result = await response.json();
      if (result.tableName) {
        setEntityTableName(result.tableName);
      } else if (result.message) {
        setEntityError(result.message);
      } else {
        setEntityError('No entity found.');
      }
    } catch (err: any) {
      console.error('Error fetching group entity:', err);
      setEntityError(err.message || 'Error occurred querying group entity.');
    } finally {
      setEntityLoading(false);
    }
  };

  const handleDownloadSpreadsheet = async () => {
    if (!entityTableName || !selectedCustomer) return;

    setDataLoading(true);
    setDataError(null);
    setDownloadSuccess(null);

    try {
      // 1. Fetch data from Snowflake table
      const dataResponse = await fetch(
        `/api/reports/quarterly/data?tableName=${encodeURIComponent(
          entityTableName
        )}&customerNumber=${encodeURIComponent(selectedCustomer.CUSTOMER_NUMBER)}`
      );
      if (!dataResponse.ok) {
        throw new Error('Failed to retrieve quarterly metrics from Snowflake.');
      }
      const fetchedReportData = await dataResponse.json();

      if (!fetchedReportData || fetchedReportData.length === 0) {
        throw new Error('No quarterly metrics found for this customer in Snowflake.');
      }

      // 2. Export/generate the Excel workbook on the server
      const exportResponse = await fetch('/api/reports/quarterly/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportData: fetchedReportData,
          customerName: selectedCustomer.CUSTOMER_NAME,
        }),
      });

      if (!exportResponse.ok) {
        throw new Error('Export server request failed while building spreadsheet.');
      }

      const blob = await exportResponse.blob();
      const cleanName = selectedCustomer.CUSTOMER_NAME
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim();
      const filename = `Quarterly_Report_${cleanName}.xlsm`;

      // 3. Present the user with the File Dialog to select directory & name
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
          setDownloadSuccess(`Successfully saved spreadsheet to chosen directory!`);
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
          setDownloadSuccess(`Downloaded spreadsheet successfully!`);
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
        setDownloadSuccess(`Downloaded spreadsheet successfully!`);
      }
    } catch (err: any) {
      console.error('Error during download workflow:', err);
      setDataError(err.message || 'An error occurred during spreadsheet generation and download.');
    } finally {
      setDataLoading(false);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <nav className="text-sm font-medium text-slate-500 mb-2">
          Reports / <span className="text-[#003461] font-semibold">Quarterly Reports By Customer</span>
        </nav>
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <FileText className="w-6 h-6 text-[#003461] dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400">Quarterly Reports By Customer</h2>
            <p className="text-slate-500 mt-1 max-w-2xl text-sm">
              Search and select a customer from the Snowflake record matrix to view or generate localized quarterly sales metrics.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Search & Selection List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <form onSubmit={handleSearch} className="space-y-4">
              <label htmlFor="customer-search" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Lookup Customer Name (Prefix Search)
              </label>
              <div className="relative flex shadow-sm rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="customer-search"
                  type="text"
                  placeholder="e.g. Acme Corporation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-l-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-5 py-2.5 border border-l-0 border-transparent text-sm font-semibold rounded-r-lg text-white bg-[#003461] hover:bg-[#002545] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003461] disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  Search
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Matches the beginning (prefix) of the customer name in the Snowflake security and mapping index.
              </p>
            </form>
          </div>

          {/* Results table */}
          {hasSearched && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-[#003461] dark:text-blue-400 text-xs uppercase tracking-wider">
                  Lookup Results
                </h3>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700/50">
                  {customers.length} Match{customers.length !== 1 ? 'es' : ''} Found
                </span>
              </div>

              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#003461] animate-spin" />
                  <p className="text-sm text-slate-500">Querying Snowflake directory...</p>
                </div>
              ) : error ? (
                <div className="p-8">
                  <div className="flex items-start bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-4 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
                    <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Search Failure</h4>
                      <p className="mt-1 text-xs opacity-90">{error}</p>
                    </div>
                  </div>
                </div>
              ) : customers.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium">No customers matched "{searchTerm}"</p>
                  <p className="text-xs text-slate-400 mt-1">Please try searching with a different name prefix.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 font-semibold w-16">Select</th>
                        <th className="px-6 py-3 font-semibold">Customer No.</th>
                        <th className="px-6 py-3 font-semibold">Dealer/Customer Name</th>
                        <th className="px-6 py-3 font-semibold">Group Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {customers.map((customer) => {
                        const isSelected = selectedCustomer?.CUSTOMER_NUMBER === customer.CUSTOMER_NUMBER;
                        return (
                          <motion.tr
                            key={customer.CUSTOMER_NUMBER}
                            onClick={() => selectCustomer(customer)}
                            whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}
                            className={`cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-blue-50/50 dark:bg-blue-950/20' 
                                : 'hover:bg-slate-50/30'
                            }`}
                          >
                            <td className="px-6 py-3.5">
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                isSelected 
                                  ? 'border-[#003461] bg-[#003461] text-white shadow-sm' 
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </div>
                            </td>
                            <td className="px-6 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                              {customer.CUSTOMER_NUMBER}
                            </td>
                            <td className="px-6 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                              {customer.CUSTOMER_NAME}
                            </td>
                            <td className="px-6 py-3.5 text-slate-500">
                              {customer.GROUP_NAME || <span className="italic text-slate-400">No Group</span>}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Active Selected Customer Panel */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm sticky top-8">
            <h3 className="font-bold text-[#003461] dark:text-blue-400 text-xs uppercase tracking-wider mb-4 border-b border-slate-50 dark:border-slate-800/80 pb-3">
              Selected Specification
            </h3>

            {selectedCustomer ? (
              <div className="space-y-6">
                <div className="bg-[#003461]/5 dark:bg-blue-950/20 p-4 rounded-lg border border-slate-100 dark:border-slate-800 flex items-start space-x-3">
                  <div className="p-2 bg-[#003461] text-white rounded-md mt-0.5 shadow-sm">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {selectedCustomer.CUSTOMER_NAME}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">Active Snowflake Record</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800">
                    <span className="text-slate-400 flex items-center"><Tag className="w-3.5 h-3.5 mr-2" /> Customer No.</span>
                    <span className="font-semibold font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {selectedCustomer.CUSTOMER_NUMBER}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800">
                    <span className="text-slate-400 flex items-center"><Building2 className="w-3.5 h-3.5 mr-2" /> Business Group</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedCustomer.GROUP_NAME || 'None'}
                    </span>
                  </div>

                  <div className="flex flex-col py-2 border-b border-slate-50 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center"><Database className="w-3.5 h-3.5 mr-2" /> Associated Entity</span>
                      {entityLoading ? (
                        <span className="text-slate-500 flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-1" /> Loading...</span>
                      ) : entityError ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium italic text-right max-w-[150px] truncate">{entityError}</span>
                      ) : entityTableName ? (
                        <span className="font-semibold font-mono text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded break-all max-w-[150px]">
                          {entityTableName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">N/A</span>
                      )}
                    </div>
                  </div>
                </div>

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

                <div className="pt-2">
                  <button
                    onClick={handleDownloadSpreadsheet}
                    disabled={!entityTableName || dataLoading}
                    className={`w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white shadow-sm transition-all duration-200 ${
                      entityTableName && !dataLoading
                        ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-[0.98]'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {dataLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Downloading Spreadsheet...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download Spreadsheet
                      </>
                    )}
                  </button>
                  {!entityTableName && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 text-center italic">
                      * Waiting for associated entity table suffix from Snowflake.
                    </p>
                  )}
                  {dataError && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs rounded-lg border border-red-100 dark:border-red-900/30">
                      <div className="font-semibold mb-0.5">Download Failed</div>
                      <div>{dataError}</div>
                    </div>
                  )}
                  {downloadSuccess && (
                    <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex items-start">
                      <Check className="w-4 h-4 mr-1.5 flex-shrink-0 mt-0.5" />
                      <div>{downloadSuccess}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 px-4 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Selection</h4>
                <p className="text-xs text-slate-400 max-w-[200px] mx-auto mt-1">
                  Search and click on a customer from the lookup table to verify and lock in your report target.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
