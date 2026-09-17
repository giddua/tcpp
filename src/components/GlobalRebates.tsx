import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  X,
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  Zap,
  Target,
  Globe,
  Flag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GlobalRebate {
  SS_ID: number;
  ManagementFeePercent: number | null;
  ACSRebatePercent: number | null;
  CashRebatePercent: number | null;
  RebatePercent: number | null;
  ProgramYear: number;
  CreatedBy: string;
  CreatedDate: string;
  ModifiedBy: string | null;
  ModifiedDate: string | null;
}

type SortField = keyof GlobalRebate;
type SortOrder = 'asc' | 'desc';

export default function GlobalRebates() {
  const [rebates, setRebates] = useState<GlobalRebate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRebate, setEditingRebate] = useState<GlobalRebate | null>(null);
  const [isSaving, setIsLoadingSaving] = useState(false);
  
  // Filtering & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('ProgramYear');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Permissions (Mocked for now)
  const [permission] = useState<'READ_WRITE' | 'READ_ONLY' | 'NO_ACCESS'>('READ_WRITE');

  useEffect(() => {
    fetchRebates();
  }, []);

  const fetchRebates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/global-rebates');
      const data = await response.json();
      if (response.ok) {
        setRebates(data);
      } else {
        setError(data.details || data.error || 'Failed to fetch global rebates');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedRebates = useMemo(() => {
    return rebates
      .filter(r => 
        r.ProgramYear.toString().includes(searchTerm)
      )
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [rebates, searchTerm, sortField, sortOrder]);

  const handleDelete = async (id: number) => {
    if (permission !== 'READ_WRITE') return;
    if (!window.confirm('Are you sure you want to delete this global rebate configuration?')) return;

    try {
      const response = await fetch(`/api/global-rebates/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.ok) {
        setSuccess('Global rebate deleted successfully');
        fetchRebates();
      } else {
        setError(result.details || result.error || 'Failed to delete rebate');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (permission !== 'READ_WRITE' || isSaving) return;

    setModalError(null);
    setError(null);
    setIsLoadingSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      ManagementFeePercent: formData.get('ManagementFeePercent'),
      ACSRebatePercent: formData.get('ACSRebatePercent'),
      CashRebatePercent: formData.get('CashRebatePercent'),
      RebatePercent: formData.get('RebatePercent'),
      ProgramYear: formData.get('ProgramYear'),
    };

    const url = editingRebate ? `/api/global-rebates/${editingRebate.SS_ID}` : '/api/global-rebates';
    const method = editingRebate ? 'PUT' : 'POST';

    const userName = localStorage.getItem('tcpp_user_name') || 'None';
    const userEmail = localStorage.getItem('tcpp_user_email') || 'None';

    try {
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': userName,
          'x-user-email': userEmail
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.ok) {
        setSuccess(result.message);
        setIsModalOpen(false);
        setEditingRebate(null);
        fetchRebates();
      } else {
        setModalError(result.details || result.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsLoadingSaving(false);
    }
  };

  const openModal = (rebate: GlobalRebate | null = null) => {
    setEditingRebate(rebate);
    setModalError(null);
    setIsModalOpen(true);
  };

  if (permission === 'NO_ACCESS') {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-slate-500">
        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-bold uppercase tracking-widest">Access Denied</h3>
        <p className="text-sm mt-2">You do not have permission to view this page.</p>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  return (
    <div className="p-8 flex-1 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            <a className="hover:text-[#003461]" href="#">Parameters</a>
            <span className="mx-2">/</span>
            <span className="text-[#003461]">Global Rebates</span>
          </nav>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400 flex items-center">
            Global Rebates
            {permission === 'READ_ONLY' && (
              <span className="ml-4 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] uppercase font-bold rounded border border-slate-200">
                Read Only
              </span>
            )}
          </h2>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Centralized rebate percentages for all regions. These values serve as the master baseline for the TCPP program year calculations across both US and Canada markets.
          </p>
        </div>
        
        {permission === 'READ_WRITE' && (
          <button 
            onClick={() => openModal(null)}
            className="bg-[#003461] text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 font-bold text-xs uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" />
            <span>Add Configuraton</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start space-x-3 text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider">Database Error</h4>
                <p className="text-sm mt-1">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto hover:text-red-900"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-start space-x-3 text-emerald-700">
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider">Success</h4>
                <p className="text-sm mt-1">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="ml-auto hover:text-emerald-900"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm mb-6 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by year..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
          <Filter className="w-4 h-4" />
          <span>Results: {filteredAndSortedRebates.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer" onClick={() => handleSort('ProgramYear')}>
                   <div className="flex items-center">Program Year <SortIcon field="ProgramYear" /></div>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Management Fee %</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Core Multipliers (ACS / Cash / Rebate %)</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#003461]" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading...</span>
                  </td>
                </tr>
              ) : filteredAndSortedRebates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    No global rebate configurations found
                  </td>
                </tr>
              ) : (
                filteredAndSortedRebates.map((rebate) => (
                  <tr key={rebate.SS_ID} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Globe className="w-4 h-4 text-slate-300" />
                        <span className="text-sm font-bold text-[#003461]">{rebate.ProgramYear}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {rebate.ManagementFeePercent !== null && rebate.ManagementFeePercent !== undefined ? (
                        <span className="inline-block text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded">
                          {Number(rebate.ManagementFeePercent).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="grid grid-cols-3 gap-1 max-w-[210px] mx-auto">
                        <div className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1 rounded flex flex-col items-center">
                          <span className="opacity-50">ACS</span> <span>{rebate.ACSRebatePercent !== null && rebate.ACSRebatePercent !== undefined ? `${Number(rebate.ACSRebatePercent).toFixed(1)}%` : '-'}</span>
                        </div>
                        <div className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded flex flex-col items-center">
                          <span className="opacity-50">CASH</span> <span>{rebate.CashRebatePercent !== null && rebate.CashRebatePercent !== undefined ? `${Number(rebate.CashRebatePercent).toFixed(1)}%` : '-'}</span>
                        </div>
                        <div className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 rounded flex flex-col items-center">
                          <span className="opacity-50">REBATE</span> <span>{rebate.RebatePercent !== null && rebate.RebatePercent !== undefined ? `${Number(rebate.RebatePercent).toFixed(1)}%` : '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => openModal(rebate)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(rebate.SS_ID)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-slate-200">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-[#003461] uppercase tracking-widest flex items-center">
                  <Globe className="w-4 h-4 mr-2" />
                  {editingRebate ? 'Edit Global Rebates' : 'New Global Configuration'}
                </h3>
                <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col max-h-[calc(100vh-100px)] text-left">
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {modalError && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start space-x-3 text-red-700 animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-[9px] uppercase tracking-wider text-red-800">Validation Error</h4>
                        <p className="text-[11px] mt-0.5">{modalError}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Global Parameters */}
                      <div className="p-4 bg-blue-50/30 rounded-xl border border-blue-100/50 space-y-4">
                        <h4 className="text-[10px] font-bold text-[#003461] uppercase tracking-widest border-b border-blue-100 pb-2 flex items-center">
                          <Globe className="w-3 h-3 mr-2 text-blue-500" />
                          Global Parameters
                        </h4>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                              Program Year <span className="text-red-500 ml-1">*</span>
                            </label>
                            <input 
                              name="ProgramYear"
                              type="number"
                              min="2000"
                              max="2100"
                              defaultValue={editingRebate?.ProgramYear || new Date().getFullYear()}
                              className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-blue-700">Management Fee %</label>
                            <input 
                              name="ManagementFeePercent" 
                              type="number" 
                              step="0.01" 
                              min="0" 
                              max="100" 
                              defaultValue={editingRebate?.ManagementFeePercent ?? ''} 
                              className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded text-sm font-bold text-blue-800 outline-none" 
                              placeholder="e.g. 1.50"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Core Multipliers */}
                      <div className="p-4 bg-sky-50/20 rounded-xl border border-sky-100/50 space-y-4">
                        <h4 className="text-[10px] font-bold text-sky-800 uppercase tracking-widest border-b border-sky-100 pb-2 flex items-center">
                          <Target className="w-3 h-3 mr-2 text-sky-500" />
                          Core Multipliers
                        </h4>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-sky-700">ACS Rebate %</label>
                            <input name="ACSRebatePercent" type="number" step="0.01" min="0" max="100" defaultValue={editingRebate?.ACSRebatePercent ?? ''} className="w-full px-3 py-1.5 bg-white border border-sky-100 rounded text-sm font-bold text-sky-800 outline-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">Cash Rebate %</label>
                            <input name="CashRebatePercent" type="number" step="0.01" min="0" max="100" defaultValue={editingRebate?.CashRebatePercent ?? ''} className="w-full px-3 py-1.5 bg-white border border-sky-100 rounded text-sm font-bold text-emerald-800 outline-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-indigo-700">Rebate %</label>
                            <input name="RebatePercent" type="number" step="0.01" min="0" max="100" defaultValue={editingRebate?.RebatePercent ?? ''} className="w-full px-3 py-1.5 bg-white border border-sky-100 rounded text-sm font-bold text-indigo-800 outline-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {editingRebate && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                      <div>
                        <span>Created By: {editingRebate.CreatedBy}</span>
                        <span className="block opacity-60">{new Date(editingRebate.CreatedDate).toLocaleString()}</span>
                      </div>
                      {editingRebate.ModifiedBy && (
                        <div className="text-right">
                          <span>Modified By: {editingRebate.ModifiedBy}</span>
                          <span className="block opacity-60">{new Date(editingRebate.ModifiedDate!).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50/50">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700">Cancel</button>
                  <button type="submit" disabled={isSaving} className="bg-[#003461] text-white px-8 py-2.5 rounded-lg hover:bg-blue-800 font-bold text-xs uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-900/10">
                    {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{isSaving ? 'Saving...' : (editingRebate ? 'Save changes' : 'Create Configuration')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
