import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  AlertCircle, 
  FileText, 
  Check, 
  Info,
  Building2,
  Database,
  Download,
  HelpCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import Select from 'react-select';

interface SelectOption {
  value: string;
  label: string;
}

export default function CAScorecardCustomer() {
  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Fetch distinct customers from Snowflake on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/reports/scorecard-ca/customers');
        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.details || errJson.error || 'Failed to retrieve distinct customers from Snowflake.');
        }
        const data = await response.json();
        setCustomers(data);
      } catch (err: any) {
        console.error('Error fetching CA scorecard customers:', err);
        setError(err.message || 'An error occurred while loading customers from Snowflake.');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const handleDownload = async () => {
    if (!selectedCustomer) return;
    setDownloading(true);
    setDownloadSuccess(false);
    setError(null);

    try {
      const response = await fetch('/api/reports/scorecard-ca/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: selectedCustomer,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.details || errJson.error || 'Failed to export CA scorecard spreadsheet.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const cleanCustomer = selectedCustomer.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
      a.download = `Tiered_Rebates_Scorecard_${cleanCustomer}.xlsm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setDownloadSuccess(true);
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Error generating or saving the scorecard spreadsheet.');
    } finally {
      setDownloading(false);
    }
  };

  const selectOptions: SelectOption[] = customers.map(c => ({
    value: c,
    label: c
  }));

  // Custom styles for react-select matching the app's deep blue palette
  const customStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      borderColor: state.isFocused ? '#003461' : '#cbd5e1',
      boxShadow: state.isFocused ? '0 0 0 1px #003461' : 'none',
      '&:hover': {
        borderColor: '#003461',
      },
      fontSize: '14px',
      fontWeight: '600',
      color: '#0f172a',
      borderRadius: '8px',
      padding: '2px',
      backgroundColor: '#f8fafc'
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? '#003461' 
        : state.isFocused 
          ? '#f1f5f9' 
          : 'transparent',
      color: state.isSelected ? '#ffffff' : '#0f172a',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: '#002545',
      }
    }),
    placeholder: (provided: any) => ({
      ...provided,
      color: '#94a3b8',
      fontSize: '13px',
      fontWeight: '500'
    })
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Navigation & Header */}
      <div className="mb-8">
        <nav className="text-sm font-medium text-slate-500 mb-2">
          Reports / <span className="text-[#003461] font-semibold">CA Scorecard by Customer</span>
        </nav>
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <FileText className="w-6 h-6 text-[#003461] dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400">CA Scorecard by Customer</h2>
            <p className="text-slate-500 mt-1 max-w-3xl text-sm">
              Generate localized Canadian scorecard worksheets from Snowflake dynamically. Select a distinct customer name to overlay rows onto the Canadian template.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Selection Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center">
              <Database className="w-4 h-4 mr-2 text-blue-600" />
              Snowflake Canadian Customer Lookup
            </h3>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-[#003461] animate-spin" />
                <p className="text-sm font-medium text-slate-500">Querying distinct Canadian parent names from Snowflake...</p>
              </div>
            ) : error ? (
              <div className="mb-6">
                <div className="flex items-start bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-4 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
                  <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Retrieval Failure</h4>
                    <p className="mt-1 text-xs opacity-90">{error}</p>
                    <p className="mt-2 text-[11px] text-red-600/80 font-medium">
                      * Please verify that your Snowflake secret credentials are set correctly in the Secrets Configuration tab.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && (
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Choose a Canadian Parent Customer Name
                </label>
                <div className="max-w-xl">
                  <Select
                    options={selectOptions}
                    value={selectedCustomer ? { value: selectedCustomer, label: selectedCustomer } : null}
                    onChange={(option) => {
                      setSelectedCustomer(option ? option.value : null);
                      setDownloadSuccess(false);
                    }}
                    placeholder="Search and select Canadian customer..."
                    isClearable
                    styles={customStyles}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  This lists distinct customer values fetched live from PRD_REPORTING_LAYER.TCPP_SCORECARD_CA_PIVOT.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm sticky top-8">
            <h3 className="font-bold text-[#003461] dark:text-blue-400 text-xs uppercase tracking-wider mb-4 border-b border-slate-50 dark:border-slate-800/80 pb-3">
              Export Action Center
            </h3>

            {selectedCustomer ? (
              <div className="space-y-6">
                <div className="bg-[#003461]/5 p-4 rounded-lg border border-blue-50 flex items-start space-x-3">
                  <div className="p-2 bg-[#003461] text-white rounded-md mt-0.5 shadow-sm">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {selectedCustomer}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">Ready for compilation</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Database Source</span>
                    <span className="font-semibold text-slate-800">Snowflake (CA)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Target Template</span>
                    <span className="font-mono text-[10px] text-slate-600 font-semibold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      TIERED_REBATES_SCORECARD_CA_Template.xlsm
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Renamed File</span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded break-all max-w-[150px] truncate">
                      Tiered_Rebates_Scorecard_{selectedCustomer.slice(0, 15)}...
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Target Tab</span>
                    <span className="font-semibold text-slate-800">Snowflake_Data</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3.5 flex items-start text-xs text-slate-600">
                  <HelpCircle className="w-4.5 h-4.5 text-[#003461] mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#003461]">Download Location:</span> Your web browser will prompt you to choose the download directory or save the file directly to your chosen downloads folder.
                  </div>
                </div>

                {downloadSuccess && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center text-xs text-emerald-800">
                    <Check className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0" />
                    <span>Spreadsheet downloaded successfully!</span>
                  </div>
                )}

                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full inline-flex items-center justify-center px-4 py-3 bg-[#003461] hover:bg-[#002544] text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md transition-all duration-200 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Compiling Excel...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Generate & Download
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="py-12 px-4 text-center rounded-lg border border-dashed border-slate-200">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-700">No Customer Selected</h4>
                <p className="text-xs text-slate-400 max-w-[200px] mx-auto mt-1">
                  Select a Canadian parent customer name from the dropdown on the left to activate download configurations.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
