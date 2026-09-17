import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  X,
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerGroup {
  SS_ID: number;
  GroupId: string;
  GroupName: string;
  IsSefa: boolean;
  IsCanadian: boolean;
  IsActive: boolean;
  Notes: string | null;
  CreatedBy: string;
  CreatedDate: string;
  ModifiedBy: string | null;
  ModifiedDate: string | null;
  ACSRebatePercent?: number | null;
  CashRebatePercent?: number | null;
  RebatePercent?: number | null;
  ManagementFeePercent?: number | null;
  ProgramYear?: number | null;
}

type SortField = keyof CustomerGroup;
type SortOrder = 'asc' | 'desc';

export default function CustomerGroups() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Group Rebates States for Editing Group
  const [editingRebates, setEditingRebates] = useState<any[]>([]);
  const [isFetchingRebates, setIsFetchingRebates] = useState(false);
  
  // New Group Rebate Row inputs
  const [newRebateYear, setNewRebateYear] = useState<number>(new Date().getFullYear());
  const [newACS, setNewACS] = useState<string>('');
  const [newCash, setNewCash] = useState<string>('');
  const [newRebate, setNewRebate] = useState<string>('');
  const [newMgmt, setNewMgmt] = useState<string>('');

  useEffect(() => {
    if (isModalOpen && editingGroup) {
      fetchGroupRebates(editingGroup.GroupId);
    } else {
      setEditingRebates([]);
      setNewACS('');
      setNewCash('');
      setNewRebate('');
      setNewMgmt('');
    }
  }, [isModalOpen, editingGroup]);

  const fetchGroupRebates = async (groupId: string) => {
    setIsFetchingRebates(true);
    try {
      const response = await fetch(`/api/group-rebates?groupId=${encodeURIComponent(groupId)}`);
      const data = await response.json();
      if (response.ok) {
        setEditingRebates(data);
      } else {
        console.error('Failed to fetch group rebates', data);
      }
    } catch (err) {
      console.error('Error fetching group rebates', err);
    } finally {
      setIsFetchingRebates(false);
    }
  };

  const handleRebateChange = (index: number, field: string, value: any) => {
    setEditingRebates(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value === '' ? null : parseFloat(value) };
      return copy;
    });
  };

  const handleAddRebateRow = () => {
    const year = Number(newRebateYear);
    if (!year || isNaN(year)) {
      alert('Please enter a valid year.');
      return;
    }
    if (editingRebates.some(r => r.ProgramYear === year)) {
      alert(`A rebate rate for year ${year} already exists for this group. You can edit the existing row instead.`);
      return;
    }
    const newRow = {
      GroupId: editingGroup?.GroupId || '',
      ProgramYear: year,
      ACSRebatePercent: newACS === '' ? null : parseFloat(newACS),
      CashRebatePercent: newCash === '' ? null : parseFloat(newCash),
      RebatePercent: newRebate === '' ? null : parseFloat(newRebate),
      ManagementFeePercent: newMgmt === '' ? null : parseFloat(newMgmt),
    };
    setEditingRebates(prev => [...prev, newRow].sort((a, b) => b.ProgramYear - a.ProgramYear));
    // Reset fields
    setNewACS('');
    setNewCash('');
    setNewRebate('');
    setNewMgmt('');
  };
  
  // Filtering & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('GroupName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Hardcoded permission for now, as requested "at a later date"
  // Options: 'READ_WRITE', 'READ_ONLY', 'NO_ACCESS'
  const [permission] = useState<'READ_WRITE' | 'READ_ONLY' | 'NO_ACCESS'>('READ_WRITE');

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/groups');
      const data = await response.json();
      if (response.ok) {
        setGroups(data);
      } else {
        setError(data.details || data.error || 'Failed to fetch groups');
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

  const filteredAndSortedGroups = useMemo(() => {
    return groups
      .filter(g => 
        g.GroupId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.GroupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.Notes?.toLowerCase() || '').includes(searchTerm.toLowerCase())
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
  }, [groups, searchTerm, sortField, sortOrder]);

  const handleDelete = async (id: number) => {
    if (permission !== 'READ_WRITE') return;
    if (!window.confirm('Are you sure you want to delete this group?')) return;

    try {
      const response = await fetch(`/api/groups/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.ok) {
        setSuccess('Group deleted successfully');
        fetchGroups();
      } else {
        setError(result.details || result.error || 'Failed to delete group');
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
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      GroupId: formData.get('GroupId'),
      GroupName: formData.get('GroupName'),
      IsSefa: formData.get('IsSefa') === 'on',
      IsCanadian: formData.get('IsCanadian') === 'on',
      IsActive: formData.get('IsActive') === 'on',
      Notes: formData.get('Notes'),
      rebates: editingRebates,
    };

    const url = editingGroup ? `/api/groups/${editingGroup.SS_ID}` : '/api/groups';
    const method = editingGroup ? 'PUT' : 'POST';

    // Get user info from localStorage for audit
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
        setEditingGroup(null);
        setModalError(null);
        fetchGroups();
      } else {
        setModalError(result.details || result.error || 'Failed to save group');
      }
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsSaving(false);
    }
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
            <span className="text-[#003461]">Groups</span>
          </nav>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400 flex items-center">
            Groups
            {permission === 'READ_ONLY' && (
              <span className="ml-4 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] uppercase font-bold rounded border border-slate-200">
                Read Only
              </span>
            )}
          </h2>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Define and manage customer buying groups. These groupings determine rebate calculation rules across the system. Replaces Group_Lookup_Codes sheet. It is the Master list of all valid buying groups / umbrellas.
          </p>
        </div>
        
        {permission === 'READ_WRITE' && (
          <button 
            onClick={() => { setEditingGroup(null); setModalError(null); setIsModalOpen(true); }}
            className="bg-[#003461] text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 font-bold text-xs uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" />
            <span>New Group</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start space-x-3 text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider">Database Error</h4>
                <p className="text-sm mt-1">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto hover:text-red-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-start space-x-3 text-emerald-700">
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider">Success</h4>
                <p className="text-sm mt-1">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="ml-auto hover:text-emerald-900 transition-colors">
                <X className="w-4 h-4" />
              </button>
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
            placeholder="Search code, name, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
          <Filter className="w-4 h-4" />
          <span>Results: {filteredAndSortedGroups.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('GroupId')}
                >
                  <div className="flex items-center">Group ID <SortIcon field="GroupId" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('GroupName')}
                >
                  <div className="flex items-center">Group Name <SortIcon field="GroupName" /></div>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">B-Group</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Region</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">ACS Rebate %</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Cash Rebate %</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Rebate %</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Mgmt Fee %</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Year</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <div className="flex justify-center flex-col items-center">
                      <div className="w-10 h-10 border-4 border-slate-200 border-t-[#003461] rounded-full animate-spin mb-4"></div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedGroups.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest">No matching records found</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedGroups.map((group) => (
                  <tr key={group.SS_ID} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-[#003461]">{group.GroupId}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{group.GroupName}</div>
                      {group.Notes && <div className="text-[10px] text-slate-400 mt-0.5 italic max-w-xs truncate">{group.Notes}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {group.IsSefa ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] uppercase font-bold rounded">SEFA</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[9px] uppercase font-bold rounded">Standard</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {group.IsCanadian ? (
                        <span className="flex items-center text-[10px] font-bold text-slate-600">
                          <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span> Canada
                        </span>
                      ) : (
                        <span className="flex items-center text-[10px] font-bold text-slate-600">
                          <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span> US/Global
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {group.ACSRebatePercent !== null && group.ACSRebatePercent !== undefined ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-mono font-bold rounded">
                          {Number(group.ACSRebatePercent).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {group.CashRebatePercent !== null && group.CashRebatePercent !== undefined ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-mono font-bold rounded">
                          {Number(group.CashRebatePercent).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {group.RebatePercent !== null && group.RebatePercent !== undefined ? (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-mono font-bold rounded">
                          {Number(group.RebatePercent).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {group.ManagementFeePercent !== null && group.ManagementFeePercent !== undefined ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-mono font-bold rounded">
                          {Number(group.ManagementFeePercent).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {group.ProgramYear !== null && group.ProgramYear !== undefined ? (
                        <span>{group.ProgramYear}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {group.IsActive ? (
                        <span className="flex items-center text-emerald-600 text-[9px] uppercase font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span> Active
                        </span>
                      ) : (
                        <span className="flex items-center text-slate-400 text-[9px] uppercase font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></span> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {permission === 'READ_WRITE' ? (
                          <>
                            <button 
                              onClick={() => { setEditingGroup(group); setModalError(null); setIsModalOpen(true); }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit record"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(group.SS_ID)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => { setEditingGroup(group); setModalError(null); setIsModalOpen(true); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Notice */}
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 border-t border-slate-200 pt-6">
        <div className="flex items-center"><span className="w-1 h-1 bg-slate-300 rounded-full mr-2"></span> Records are strictly audited per GAAP compliance</div>
        <div className="flex items-center"><span className="w-1 h-1 bg-slate-300 rounded-full mr-2"></span> Auto-timestamping enabled on all write operations</div>
        <div className="flex items-center"><span className="w-1 h-1 bg-slate-300 rounded-full mr-2"></span> Role-based access control enabled</div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-slate-200 transition-all max-w-4xl"
            >
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-[#003461] uppercase tracking-widest flex items-center">
                  <Database className="w-4 h-4 mr-2" />
                  {editingGroup ? (permission === 'READ_ONLY' ? 'Group Details' : 'Edit Group') : 'New Group'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-6 text-left">
                {modalError && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start space-x-3 text-red-700 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-[9px] uppercase tracking-wider">Save Failed</h4>
                      <p className="text-xs mt-0.5">{modalError}</p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Group ID <span className="text-red-500">*</span></label>
                    <input 
                      name="GroupId"
                      defaultValue={editingGroup?.GroupId}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      placeholder="e.g. SEFA" 
                      required
                      readOnly={permission === 'READ_ONLY'}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Group Name <span className="text-red-500">*</span></label>
                    <input 
                      name="GroupName"
                      defaultValue={editingGroup?.GroupName}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      placeholder="e.g. SEFA Buying Group" 
                      required
                      readOnly={permission === 'READ_ONLY'}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Notes / Documentation</label>
                  <textarea 
                    name="Notes"
                    defaultValue={editingGroup?.Notes || ''}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                    placeholder="Provide context for this grouping rule..." 
                    readOnly={permission === 'READ_ONLY'}
                  ></textarea>
                </div>

                <div className="flex items-center space-x-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center space-x-2">
                    <input 
                      id="IsSefa" 
                      name="IsSefa" 
                      type="checkbox" 
                      defaultChecked={editingGroup?.IsSefa}
                      disabled={permission === 'READ_ONLY'}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                    />
                    <label htmlFor="IsSefa" className="text-[10px] font-bold uppercase tracking-widest text-slate-600 cursor-pointer">SEFA Buying Group</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      id="IsCanadian" 
                      name="IsCanadian" 
                      type="checkbox" 
                      defaultChecked={editingGroup?.IsCanadian}
                      disabled={permission === 'READ_ONLY'}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                    />
                    <label htmlFor="IsCanadian" className="text-[10px] font-bold uppercase tracking-widest text-slate-600 cursor-pointer">Canadian Region</label>
                  </div>
                  <div className="flex items-center space-x-2 border-l border-slate-200 pl-6 ml-auto">
                    <input 
                      id="IsActive" 
                      name="IsActive" 
                      type="checkbox" 
                      defaultChecked={editingGroup ? editingGroup.IsActive : true}
                      disabled={permission === 'READ_ONLY'}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" 
                    />
                    <label htmlFor="IsActive" className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 cursor-pointer">Active Status</label>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-[#003461] uppercase tracking-wider flex items-center">
                        <Percent className="w-4 h-4 mr-1.5" />
                        Group Rebate Rates by Year
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Configure annual rebate percentages{editingGroup ? ` for ${editingGroup.GroupId}` : ''}. ProgramYear unique constraint applies.
                      </p>
                    </div>
                  </div>

                  {isFetchingRebates ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading annual rates...
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="px-4 py-2 w-24">Year</th>
                            <th className="px-4 py-2">ACS Rebate %</th>
                            <th className="px-4 py-2">Cash Rebate %</th>
                            <th className="px-4 py-2">Rebate %</th>
                            <th className="px-4 py-2">Mgmt Fee %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {editingRebates.map((rebate, index) => (
                            <tr key={rebate.SS_ID || `temp-${rebate.ProgramYear}`} className="text-xs hover:bg-slate-50/50">
                              <td className="px-4 py-2 font-mono font-semibold text-slate-600">
                                {rebate.ProgramYear}
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={rebate.ACSRebatePercent ?? ''}
                                  onChange={(e) => handleRebateChange(index, 'ACSRebatePercent', e.target.value)}
                                  disabled={permission === 'READ_ONLY'}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold text-blue-700 bg-blue-50/20 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="N/A"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={rebate.CashRebatePercent ?? ''}
                                  onChange={(e) => handleRebateChange(index, 'CashRebatePercent', e.target.value)}
                                  disabled={permission === 'READ_ONLY'}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold text-emerald-700 bg-emerald-50/20 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="N/A"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={rebate.RebatePercent ?? ''}
                                  onChange={(e) => handleRebateChange(index, 'RebatePercent', e.target.value)}
                                  disabled={permission === 'READ_ONLY'}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold text-indigo-700 bg-indigo-50/20 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="N/A"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={rebate.ManagementFeePercent ?? ''}
                                  onChange={(e) => handleRebateChange(index, 'ManagementFeePercent', e.target.value)}
                                  disabled={permission === 'READ_ONLY'}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold text-amber-700 bg-amber-50/20 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="N/A"
                                />
                              </td>
                            </tr>
                          ))}

                          {/* Add New Year Rate Row */}
                          {permission === 'READ_WRITE' && (
                            <tr className="bg-slate-50/50 border-t-2 border-slate-100">
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min="2000"
                                  max="2100"
                                  value={newRebateYear}
                                  onChange={(e) => setNewRebateYear(parseInt(e.target.value) || new Date().getFullYear())}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono font-bold bg-white outline-none"
                                  placeholder="Year"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={newACS}
                                  onChange={(e) => setNewACS(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold bg-white outline-none"
                                  placeholder="ACS %"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={newCash}
                                  onChange={(e) => setNewCash(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold bg-white outline-none"
                                  placeholder="Cash %"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={newRebate}
                                  onChange={(e) => setNewRebate(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold bg-white outline-none"
                                  placeholder="Rebate %"
                                />
                              </td>
                              <td className="px-4 py-2 flex items-center space-x-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={newMgmt}
                                  onChange={(e) => setNewMgmt(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold bg-white outline-none"
                                  placeholder="Fee %"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddRebateRow}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1 flex-shrink-0"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add</span>
                                </button>
                              </td>
                            </tr>
                          )}

                          {editingRebates.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-[11px] font-semibold">
                                No annual rate records configured. Use the fields above to add one.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {editingGroup && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Creation Audit</h4>
                      <p className="text-[10px] font-semibold text-slate-600">BY: {editingGroup.CreatedBy}</p>
                      <p className="text-[9px] text-slate-400">{new Date(editingGroup.CreatedDate).toLocaleString()}</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Last Modification</h4>
                      <p className="text-[10px] font-semibold text-slate-600">BY: {editingGroup.ModifiedBy || 'N/A'}</p>
                      {editingGroup.ModifiedDate && <p className="text-[9px] text-slate-400">{new Date(editingGroup.ModifiedDate).toLocaleString()}</p>}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  {permission === 'READ_WRITE' && (
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="bg-[#003461] text-white px-8 py-2.5 rounded-lg hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 font-bold text-xs uppercase tracking-widest disabled:opacity-70 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>{isSaving ? 'Processing...' : (editingGroup ? 'Save Changes' : 'Create Group')}</span>
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
