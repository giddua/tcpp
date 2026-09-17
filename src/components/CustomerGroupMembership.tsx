import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
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
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Membership {
  MembershipId: number;
  CustomerId: number;
  GroupId: string;
  CustomerName: string; // Joined
  GroupName: string; // Joined
  DateEffective: string;
  DateExpired: string | null;
  Notes: string | null;
  CreatedBy: string;
  CreatedDate: string;
  ModifiedBy: string | null;
  ModifiedDate: string | null;
}

interface Customer {
  SS_ID: number;
  CustomerName: string;
  CustomerId: number;
}

interface Group {
  SS_ID: number;
  GroupName: string;
  GroupId: string;
}

type SortField = keyof Membership;
type SortOrder = 'asc' | 'desc';

export default function CustomerGroupMembership() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Selected values for React Select
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Filtering & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('DateEffective');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Permissions
  const [permission] = useState<'READ_WRITE' | 'READ_ONLY' | 'NO_ACCESS'>('READ_WRITE');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [mRes, cRes, gRes] = await Promise.all([
        fetch('/api/customer-group-membership'),
        fetch('/api/customers'),
        fetch('/api/groups')
      ]);

      if (!mRes.ok || !cRes.ok || !gRes.ok) {
        throw new Error('Failed to fetch one or more resources');
      }

      const [mRecords, cRecords, gRecords] = await Promise.all([
        mRes.json(),
        cRes.json(),
        gRes.json()
      ]);

      setMemberships(mRecords);
      setCustomers(cRecords);
      setGroups(gRecords);
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

  const filteredAndSortedMemberships = useMemo(() => {
    return memberships
      .filter(m => 
        (m.CustomerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.GroupName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.Notes || '').toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [memberships, searchTerm, sortField, sortOrder]);

  const handleDelete = async (id: number) => {
    if (permission !== 'READ_WRITE') return;
    if (!window.confirm('Are you sure you want to delete this membership?')) return;

    try {
      const response = await fetch(`/api/customer-group-membership/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.ok) {
        setSuccess('Membership deleted successfully');
        fetchData();
      } else {
        setError(result.details || result.error || 'Failed to delete membership');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openModal = (m: Membership | null = null) => {
    setEditingMembership(m);
    setSelectedCustomerId(m?.CustomerId || null);
    setSelectedGroupId(m?.GroupId || null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (permission !== 'READ_WRITE' || isSaving) return;

    if (!selectedCustomerId || !selectedGroupId) {
      setModalError('Please select both a Customer and a Group');
      return;
    }

    setModalError(null);
    setError(null);
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      CustomerId: selectedCustomerId,
      GroupId: selectedGroupId,
      DateEffective: formData.get('DateEffective'),
      DateExpired: formData.get('DateExpired') || null,
      Notes: formData.get('Notes'),
    };

    const url = editingMembership ? `/api/customer-group-membership/${editingMembership.MembershipId}` : '/api/customer-group-membership';
    const method = editingMembership ? 'PUT' : 'POST';

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
        setEditingMembership(null);
        setModalError(null);
        fetchData();
      } else {
        setModalError(result.details || result.error || 'Failed to save membership');
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

/* old, screws up the display while displaying date in the tabular format
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };
*/

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    // Splits at 'T' or a space to grab just the "YYYY-MM-DD" part
    const [pureDate] = dateStr.split(/[T ]/); 
    const [year, month, day] = pureDate.split('-');
    
    // Returns it in standard localized MM/DD/YYYY format safely
    return `${parseInt(month)}/${parseInt(day)}/${year}`;
  };

  const formatPercent = (val: number) => {
    return `${(val * 100).toFixed(2)}%`;
  };

  // React Select Options
  const customerOptions = customers.map(c => ({
    value: c.CustomerId,
    label: `${c.CustomerName} (${c.CustomerId})`
  }));

  const groupOptions = groups.map(g => ({
    value: g.GroupId,
    label: `${g.GroupName} (${g.GroupId})`
  }));

  return (
    <div className="p-8 flex-1 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            <a className="hover:text-[#003461]" href="#">Parameters</a>
            <span className="mx-2">/</span>
            <span className="text-[#003461]">Customer Groups</span>
          </nav>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400 flex items-center">
            Customer Group Mapping
            {permission === 'READ_ONLY' && (
              <span className="ml-4 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] uppercase font-bold rounded border border-slate-200">
                Read Only
              </span>
            )}
          </h2>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Assign customers to rebate groups. A customer can be part of multiple groups for tiered rebate calculations.
          </p>
        </div>
        
        {permission === 'READ_WRITE' && (
          <button 
            onClick={() => openModal()}
            className="bg-[#003461] text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 font-bold text-xs uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" />
            <span>New Mapping</span>
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
            placeholder="Search by customer or group..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
          <Filter className="w-4 h-4" />
          <span>Results: {filteredAndSortedMemberships.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <th className="px-6 py-4 cursor-pointer hover:text-[#003461]" onClick={() => handleSort('CustomerName')}>
                  <div className="flex items-center">Customer <SortIcon field="CustomerName" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-[#003461]" onClick={() => handleSort('GroupName')}>
                  <div className="flex items-center">Group <SortIcon field="GroupName" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-[#003461]" onClick={() => handleSort('DateEffective')}>
                  <div className="flex items-center">Effective <SortIcon field="DateEffective" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-[#003461]" onClick={() => handleSort('DateExpired')}>
                  <div className="flex items-center">Expired <SortIcon field="DateExpired" /></div>
                </th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center flex-col items-center">
                      <div className="w-10 h-10 border-4 border-slate-200 border-t-[#003461] rounded-full animate-spin mb-4"></div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedMemberships.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest">No matching records found</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedMemberships.map((m) => (
                  <tr key={m.MembershipId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{m.CustomerName || 'Unknown Customer'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{m.GroupName || 'Unknown Group'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-600">{formatDate(m.DateEffective)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-600">
                        {m.DateExpired ? formatDate(m.DateExpired) : <span className="text-emerald-600 font-bold italic">Active Indefinitely</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {permission === 'READ_WRITE' ? (
                          <>
                            <button 
                              onClick={() => openModal(m)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit record"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(m.MembershipId)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => openModal(m)}
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
        <div className="flex items-center"><span className="w-1 h-1 bg-slate-300 rounded-full mr-2"></span> Group memberships determine calculation eligibility</div>
        <div className="flex items-center"><span className="w-1 h-1 bg-slate-300 rounded-full mr-2"></span> Auto-timestamping enabled on all write operations</div>
        <div className="flex items-center"><span className="w-1 h-1 bg-slate-300 rounded-full mr-2"></span> SQL Server persistent storage</div>
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
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-slate-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center">
                <h3 className="text-sm font-bold text-[#003461] uppercase tracking-widest flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  {editingMembership ? (permission === 'READ_ONLY' ? 'Membership Details' : 'Edit Mapping') : 'New Mapping'}
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer <span className="text-red-500">*</span></label>
                    <Select 
                      options={customerOptions}
                      value={customerOptions.find(opt => opt.value === selectedCustomerId)}
                      onChange={(opt) => setSelectedCustomerId(opt?.value || null)}
                      isDisabled={permission === 'READ_ONLY'}
                      className="text-sm"
                      placeholder="Search Customer..."
                      isClearable
                      styles={{
                        control: (base) => ({
                          ...base,
                          backgroundColor: '#f8fafc',
                          borderColor: '#e2e8f0',
                          borderRadius: '0.5rem',
                          paddingTop: '2px',
                          paddingBottom: '2px'
                        })
                      }}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Group <span className="text-red-500">*</span></label>
                    <Select 
                      options={groupOptions}
                      value={groupOptions.find(opt => opt.value === selectedGroupId)}
                      onChange={(opt) => setSelectedGroupId(opt?.value || null)}
                      isDisabled={permission === 'READ_ONLY'}
                      className="text-sm"
                      placeholder="Search Group..."
                      isClearable
                      styles={{
                        control: (base) => ({
                          ...base,
                          backgroundColor: '#f8fafc',
                          borderColor: '#e2e8f0',
                          borderRadius: '0.5rem',
                          paddingTop: '2px',
                          paddingBottom: '2px'
                        })
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Effective Date <span className="text-red-500">*</span></label>
                    <input 
                      name="DateEffective"
                      type="date"
                      defaultValue={editingMembership?.DateEffective?.split('T')[0] || new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      required
                      disabled={permission === 'READ_ONLY'}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Expiry Date (Optional)</label>
                    <input 
                      name="DateExpired"
                      type="date"
                      defaultValue={editingMembership?.DateExpired ? editingMembership.DateExpired.split('T')[0] : ''}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      disabled={permission === 'READ_ONLY'}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Internal Notes</label>
                  <textarea 
                    name="Notes"
                    defaultValue={editingMembership?.Notes || ''}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                    placeholder="Add mapping context, special conditions, or approval notes..."
                    disabled={permission === 'READ_ONLY'}
                  ></textarea>
                </div>

                {editingMembership && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Creation Audit</h4>
                      <p className="text-[10px] font-semibold text-slate-600">BY: {editingMembership.CreatedBy}</p>
                      <p className="text-[9px] text-slate-400">{new Date(editingMembership.CreatedDate).toLocaleString()}</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Last Modification</h4>
                      <p className="text-[10px] font-semibold text-slate-600">BY: {editingMembership.ModifiedBy || 'N/A'}</p>
                      {editingMembership.ModifiedDate && <p className="text-[9px] text-slate-400">{new Date(editingMembership.ModifiedDate).toLocaleString()}</p>}
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
                      <span>{isSaving ? 'Processing...' : (editingMembership ? 'Update Mapping' : 'Create Mapping')}</span>
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
