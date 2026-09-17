import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Loader2, 
  AlertCircle, 
  FileText, 
  Check, 
  Info,
  Building2,
  Database,
  Download,
  Users
} from 'lucide-react';
import { motion } from 'motion/react';

interface GroupMasterRecord {
  GroupId: string;
  GroupName: string;
}

export default function FinanceReports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<GroupMasterRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupMasterRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch group master on mount
  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/reports/finance/groups');
        if (!response.ok) {
          throw new Error('Failed to retrieve Group Master from SQL Server.');
        }
        const data = await response.json();
        setGroups(data);
      } catch (err: any) {
        console.error('Error fetching Group Master:', err);
        setError(err.message || 'An error occurred while loading groups.');
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  // Filter groups locally based on search input
  const filteredGroups = groups.filter(g => {
    const term = searchTerm.toLowerCase();
    const gid = String(g.GroupId || '').toLowerCase();
    const gname = String(g.GroupName || '').toLowerCase();
    return gid.includes(term) || gname.includes(term);
  });

  const handleDownload = async () => {
    if (!selectedGroup) return;
    setDownloading(true);

    try {
      const response = await fetch('/api/reports/finance/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: selectedGroup.GroupId,
          groupName: selectedGroup.GroupName,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Export server request failed.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let fileName = '';
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          fileName = matches[1].replace(/['"]/g, '');
        }
      }

      if (!fileName) {
        const cleanId = String(selectedGroup.GroupId).replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
        const cleanName = String(selectedGroup.GroupName).replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
        const suffix = [cleanId, cleanName].filter(Boolean).join('_');
        fileName = suffix ? `TCPP_Finance_Report_${suffix}.xlsx` : 'TCPP_Finance_Report.xlsx';
      }

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export Finance Report data:', err);
      alert('Failed to export to Excel: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto" id="finance-reports-root">
      {/* Header */}
      <div className="mb-8">
        <nav className="text-sm font-medium text-slate-500 mb-2">
          Reports / <span className="text-[#003461] font-semibold">Finance Reports</span>
        </nav>
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <FileText className="w-6 h-6 text-[#003461] dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400">Finance Reports</h2>
            <p className="text-slate-500 mt-1 max-w-2xl text-sm">
              Select a Group ID from the SQL Server master database to pull tiered rebates financial history and download formatted summaries.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Search & Selection List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="space-y-4">
              <label htmlFor="group-search" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Filter Group ID or Group Name
              </label>
              <div className="relative flex shadow-sm rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="group-search"
                  type="text"
                  placeholder="Filter by Group ID or Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Type to filter groups loaded from the SQL Server database master (ref.GroupMaster).
              </p>
            </div>
          </div>

          {/* Results table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-[#003461] dark:text-blue-400 text-xs uppercase tracking-wider">
                Group Master Table
              </h3>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700/50">
                {filteredGroups.length} of {groups.length} Loaded
              </span>
            </div>

            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-[#003461] animate-spin" />
                <p className="text-sm text-slate-500">Querying SQL Server master registry...</p>
              </div>
            ) : error ? (
              <div className="p-8">
                <div className="flex items-start bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-4 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
                  <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Lookup Failure</h4>
                    <p className="mt-1 text-xs opacity-90">{error}</p>
                  </div>
                </div>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium">No groups matched filter "{searchTerm}"</p>
                <p className="text-xs text-slate-400 mt-1">Please make sure groups are synchronized under Administration.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 font-semibold w-16">Select</th>
                      <th className="px-6 py-3 font-semibold">Group ID</th>
                      <th className="px-6 py-3 font-semibold">Group Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredGroups.map((g) => {
                      const isSelected = selectedGroup?.GroupId === g.GroupId;
                      return (
                        <motion.tr
                          key={g.GroupId}
                          onClick={() => setSelectedGroup(g)}
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
                          <td className="px-6 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {g.GroupId}
                          </td>
                          <td className="px-6 py-3.5 text-slate-800 dark:text-slate-200">
                            {g.GroupName}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selection Details & Action Controls */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-base text-[#003461] dark:text-blue-400 mb-4 flex items-center space-x-2">
              <Database className="w-5 h-5 text-slate-400" />
              <span>Target Pipeline Details</span>
            </h3>

            {selectedGroup ? (
              <div className="space-y-5">
                <div className="p-4 bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-lg space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selected Group ID</span>
                    <span className="text-base font-extrabold text-[#003461] dark:text-blue-300 font-mono">
                      {selectedGroup.GroupId}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Group Name</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {selectedGroup.GroupName}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-slate-500 leading-relaxed">
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p>
                      Query runs live on Snowflake table <strong>PRD_ANALYTICS_TIERED_REBATES.TCPP_FINANCE_REBATE_HISTORY</strong>.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p>
                      Writes data dynamically starting at <strong>row 2</strong> in tab <strong>Group_Data</strong> of template <strong>TCPP_Finance_Report_Template</strong>.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p>
                      Formulates a dynamic fiscal period calculation in column <strong>AW</strong>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full py-3 px-4 bg-[#003461] hover:bg-[#002545] text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center space-x-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Report...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Finance Report Data</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">No Selection</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Select a group from the list on the left to activate report export.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
