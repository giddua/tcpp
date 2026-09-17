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
  ClipboardCheck,
  Calendar,
  Zap,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TCPPQualifier {
  SS_ID: number;
  CustomerId: number;
  ProgramYear: number;
  PolicyComplianceQualifier: string | null;
  MarketingSupportQualifier: string | null;
  AccessAndTrainingQualifier: string | null;
  CarrierQualifier: string | null;
  AvoidAssessorialCharges: string | null;
  NegotiatedProgram: string | null;
  StrategicRebate: string | null;
  CustomerName: string; // Joined
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

type SortField = keyof TCPPQualifier;
type SortOrder = 'asc' | 'desc';

export default function CustomerTCPPQualifiers() {
  const [qualifiers, setQualifiers] = useState<TCPPQualifier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQualifier, setEditingQualifier] = useState<TCPPQualifier | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Selected values
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedProgramYear, setSelectedProgramYear] = useState<number>(() => {
    const yr = new Date().getFullYear();
    return Math.max(2025, Math.min(2050, yr));
  });

  // Year options for selection (2025 to 2050)
  const yearOptions = useMemo(() => {
    const yrs: number[] = [];
    for (let y = 2025; y <= 2050; y++) {
      yrs.push(y);
    }
    return yrs;
  }, []);

  // Filtering & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('CustomerName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Permissions (Simplified for now)
  const [permission] = useState<'READ_WRITE' | 'READ_ONLY' | 'NO_ACCESS'>('READ_WRITE');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [qRes, cRes] = await Promise.all([
        fetch('/api/customer-tcpp-qualifiers'),
        fetch('/api/customers')
      ]);

      if (!qRes.ok || !cRes.ok) {
        throw new Error('Failed to fetch one or more resources');
      }

      const [qRecords, cRecords] = await Promise.all([
        qRes.json(),
        cRes.json()
      ]);

      setQualifiers(qRecords);
      setCustomers(cRecords);
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

  const filteredAndSortedQualifiers = useMemo(() => {
    return qualifiers
      .filter(q => 
        (q.CustomerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(q.CustomerId || '').includes(searchTerm) ||
        String(q.ProgramYear || '').includes(searchTerm)
      )
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [qualifiers, searchTerm, sortField, sortOrder]);

  const handleDelete = async (id: number) => {
    if (permission !== 'READ_WRITE') return;
    if (!window.confirm('Are you sure you want to delete this qualifier record?')) return;

    try {
      const response = await fetch(`/api/customer-tcpp-qualifiers/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.ok) {
        setSuccess('Qualifier record deleted successfully');
        fetchData();
      } else {
        setError(result.details || result.error || 'Failed to delete qualifier record');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openModal = (q: TCPPQualifier | null = null) => {
    setEditingQualifier(q);
    setSelectedCustomerId(q?.CustomerId || null);
    setSelectedProgramYear(
      q?.ProgramYear || Math.max(2025, Math.min(2050, new Date().getFullYear()))
    );
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (permission !== 'READ_WRITE' || isSaving) return;

    if (!selectedCustomerId) {
      setModalError('Please select a Customer');
      return;
    }

    if (!selectedProgramYear || selectedProgramYear < 2025 || selectedProgramYear > 2050) {
      setModalError('Program Year must be between 2025 and 2050.');
      return;
    }

    setModalError(null);
    setError(null);
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      CustomerId: selectedCustomerId,
      ProgramYear: selectedProgramYear,
      PolicyComplianceQualifier: formData.get('PolicyComplianceQualifier'),
      MarketingSupportQualifier: formData.get('MarketingSupportQualifier'),
      AccessAndTrainingQualifier: formData.get('AccessAndTrainingQualifier'),
      CarrierQualifier: formData.get('CarrierQualifier'),
      AvoidAssessorialCharges: formData.get('AvoidAssessorialCharges'),
      NegotiatedProgram: formData.get('NegotiatedProgram'),
      StrategicRebate: formData.get('StrategicRebate'),
    };

    const url = editingQualifier ? `/api/customer-tcpp-qualifiers/${editingQualifier.SS_ID}` : '/api/customer-tcpp-qualifiers';
    const method = editingQualifier ? 'PUT' : 'POST';

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
        setEditingQualifier(null);
        setModalError(null);
        fetchData();
      } else {
        setModalError(result.details || result.error || 'Failed to save qualifier record');
      }
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (permission === 'NO_ACCESS') {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-slate-500 text-left">
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

  // React Select Options
  const customerOptions = customers.map(c => ({
    value: c.CustomerId,
    label: `${c.CustomerName} (${c.CustomerId})`
  }));

  const QualifierBadge = ({ val }: { val: string | null }) => {
    if (val === 'Y') return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black">Y</span>;
    if (val === 'N') return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[9px] font-black">N</span>;
    return <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full text-[9px] font-black">-</span>;
  };

  return (
    <div className="p-8 flex-1 max-w-7xl mx-auto w-full text-left font-sans">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            <a className="hover:text-[#003461]" href="#">Overrides</a>
            <span className="mx-2">/</span>
            <span className="text-[#003461]">TCPP Qualifiers</span>
          </nav>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400 flex items-center">
            TCPP Qualifiers
            {permission === 'READ_ONLY' && (
              <span className="ml-4 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] uppercase font-bold rounded border border-slate-200">
                Read Only
              </span>
            )}
          </h2>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl text-left">
            Manage customer-specific compliance and program qualifications by year.
          </p>
        </div>
        
        {permission === 'READ_WRITE' && (
          <button 
            onClick={() => openModal()}
            className="bg-[#003461] text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 font-bold text-xs uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" />
            <span>New Qualifier Record</span>
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
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start space-x-3 text-red-700 text-left">
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
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-start space-x-3 text-emerald-700 text-left">
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

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden text-left">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center space-x-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-none">
            <div className="flex items-center"><Zap className="w-3 h-3 mr-1.5 text-blue-500" /> Count: {filteredAndSortedQualifiers.length}</div>
          </div>
        </div>

        <div className="overflow-x-auto text-left">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">
                <th className="px-6 py-4 cursor-pointer hover:text-[#003461]" onClick={() => handleSort('CustomerName')}>
                  <div className="flex items-center">Customer <SortIcon field="CustomerName" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-[#003461] text-center" onClick={() => handleSort('ProgramYear')}>
                  <div className="flex items-center justify-center">Program Year <SortIcon field="ProgramYear" /></div>
                </th>
                <th className="px-6 py-4 text-center">Compliance</th>
                <th className="px-6 py-4 text-center">Marketing</th>
                <th className="px-6 py-4 text-center">Training</th>
                <th className="px-6 py-4 text-center">Carrier</th>
                <th className="px-6 py-4 text-center">Assessorial</th>
                <th className="px-6 py-4 text-center">Negotiated</th>
                <th className="px-6 py-4 text-center">Strategic</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-left">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex justify-center flex-col items-center text-left">
                      <div className="w-10 h-10 border-4 border-slate-200 border-t-[#003461] rounded-full animate-spin mb-4"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Loading Records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedQualifiers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Records found</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedQualifiers.map((q) => (
                  <tr key={q.SS_ID} className="hover:bg-slate-50 transition-colors group border-b border-slate-50 last:border-0 text-left">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-800">{q.CustomerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {q.CustomerId}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-[#003461] dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800 font-mono">
                        {q.ProgramYear}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center"><QualifierBadge val={q.PolicyComplianceQualifier} /></td>
                    <td className="px-6 py-4 text-center"><QualifierBadge val={q.MarketingSupportQualifier} /></td>
                    <td className="px-6 py-4 text-center"><QualifierBadge val={q.AccessAndTrainingQualifier} /></td>
                    <td className="px-6 py-4 text-center"><QualifierBadge val={q.CarrierQualifier} /></td>
                    <td className="px-6 py-4 text-center"><QualifierBadge val={q.AvoidAssessorialCharges} /></td>
                    <td className="px-6 py-4 text-center"><QualifierBadge val={q.NegotiatedProgram} /></td>
                    <td className="px-6 py-4 text-center"><QualifierBadge val={q.StrategicRebate} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openModal(q)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(q.SS_ID)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Footnote */}
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[9px] font-black uppercase tracking-widest text-slate-300 border-t border-slate-100 pt-6 text-left">
        <div className="flex items-center"><span className="w-1 h-1 bg-slate-200 rounded-full mr-2"></span> Qualifier logic impacts auto-calculation tier engines</div>
        <div className="flex items-center"><span className="w-1 h-1 bg-slate-200 rounded-full mr-2"></span> Null values treat as 'Inherit / Not Applicable'</div>
        <div className="flex items-center"><span className="w-1 h-1 bg-slate-200 rounded-full mr-2"></span> Tcpp Data Sovereignty Active</div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-left">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-slate-200 max-h-[90vh] overflow-y-auto text-left"
            >
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center text-left">
                <h3 className="text-xs font-black text-[#003461] uppercase tracking-[0.2em] flex items-center">
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  {editingQualifier ? 'Modify Qualifications' : 'Initiate Qualifier Record'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-8 text-left uppercase text-left">
                {modalError && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start space-x-3 text-red-700 text-left">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-black text-[10px] uppercase tracking-widest text-left">Interface Alert</h4>
                      <p className="text-xs mt-1 font-medium">{modalError}</p>
                    </div>
                  </div>
                )}
                
                {editingQualifier ? (
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-left">
                      <div className="sm:col-span-1 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Customer ID</label>
                        <div className="text-sm font-extrabold text-[#003461] dark:text-blue-400 font-mono">
                          {editingQualifier.CustomerId}
                        </div>
                      </div>
                      <div className="sm:col-span-3 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Customer Name</label>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 break-words">
                          {editingQualifier.CustomerName || `Customer #${editingQualifier.CustomerId}`}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-3 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Program Year</label>
                      <div className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-blue-50 text-[#003461] dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                        {editingQualifier.ProgramYear}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                    <div className="sm:col-span-2 space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-left">
                        Customer <span className="text-red-500">*</span>
                      </label>
                      <Select 
                        options={customerOptions}
                        value={customerOptions.find(opt => opt.value === selectedCustomerId)}
                        onChange={(opt) => setSelectedCustomerId(opt?.value || null)}
                        isDisabled={permission === 'READ_ONLY'}
                        className="text-sm text-left"
                        placeholder="Choose Customer..."
                        isClearable
                        styles={{
                          control: (base) => ({
                            ...base,
                            backgroundColor: '#f8fafc',
                            borderColor: '#e2e8f0',
                            borderRadius: '0.75rem',
                            padding: '2px',
                            overflow: 'hidden'
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-left">
                        Program Year <span className="text-red-500">*</span>
                      </label>
                      <select 
                        value={selectedProgramYear}
                        onChange={(e) => setSelectedProgramYear(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                      >
                        {yearOptions.map(yr => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-4 text-left">
                  <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-[#003461] border-b border-blue-50 pb-2 text-left">
                    <Zap className="w-3 h-3" />
                    <span>Qualifying Metrics</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-left">
                    {[
                      { name: 'PolicyComplianceQualifier', label: 'Policy Compliance' },
                      { name: 'MarketingSupportQualifier', label: 'Marketing Support' },
                      { name: 'AccessAndTrainingQualifier', label: 'Access & Training' },
                      { name: 'CarrierQualifier', label: 'Carrier Preference' },
                      { name: 'AvoidAssessorialCharges', label: 'Avoid Assessorials' },
                      { name: 'NegotiatedProgram', label: 'Negotiated Program' },
                      { name: 'StrategicRebate', label: 'Strategic Rebate' },
                    ].map((metric) => (
                      <div key={metric.name} className="flex items-center justify-between py-1 border-b border-slate-50 text-left">
                        <label className="text-xs font-bold text-slate-600 text-left">{metric.label}</label>
                        <select 
                          name={metric.name}
                          defaultValue={(editingQualifier as any)?.[metric.name] || ''}
                          className="bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-black px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 text-left"
                        >
                          <option value="">N/A</option>
                          <option value="Y">YES</option>
                          <option value="N">NO</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {editingQualifier && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center space-x-4 text-left">
                    <Info className="w-4 h-4 text-slate-400" />
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-left">
                      Record established by {editingQualifier.CreatedBy} on {new Date(editingQualifier.CreatedDate).toLocaleDateString()}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-slate-100 flex justify-end space-x-4 text-left">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors text-left"
                  >
                    Cancel
                  </button>
                  {permission === 'READ_WRITE' && (
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="bg-[#003461] text-white px-10 py-2.5 rounded-xl hover:bg-blue-800 transition-all shadow-xl shadow-blue-900/20 font-black text-[10px] uppercase tracking-[0.2em] disabled:opacity-70 flex items-center space-x-3 text-left"
                    >
                      {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-left" />}
                      <span>{isSaving ? 'Syncing...' : (editingQualifier ? 'Save Changes' : 'Save Changes')}</span>
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
