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
  User,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Select from 'react-select';

interface Customer {
  SS_ID: number;
  CustomerId: number;
  CustomerName: string;
  RegionCode: string | null;
  Territory: string | null;
  IsActive: boolean;
  SpecificRebateCode: string | null;
  RebatePercentOverride: number | null;
  ACSRebatePercentOverride: number | null;
  CashRebatePercentOverride: number | null;
  TierOverride: string | null;
  OverrideProgramYear: number | null;
  CreatedBy: string;
  CreatedDate: string;
  ModifiedBy: string | null;
  ModifiedDate: string | null;
}

interface CustomerTier {
  CustomerTiers: string;
}

interface CustomerFamily {
  CustomerFamilyCode: string;
  CustomerFamilyName: string;
}

interface Region {
  RegionCode: string;
  DisplayName: string;
}

type SortField = keyof Customer;
type SortOrder = 'asc' | 'desc';

interface CustomerMasterRecord {
  CustomerId: number;
  CustomerName: string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [families, setFamilies] = useState<CustomerFamily[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [tiers, setTiers] = useState<CustomerTier[]>([]);
  const [customerMasters, setCustomerMasters] = useState<CustomerMasterRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for react-select
  const [selectedFamilyCode, setSelectedFamilyCode] = useState<string | null>(null);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [customerSearchInput, setCustomerSearchInput] = useState<string>('');

  // Customer Rebates States for Editing Customer
  const [editingRebates, setEditingRebates] = useState<any[]>([]);
  const [isFetchingRebates, setIsFetchingRebates] = useState(false);
  
  // New Customer Rebate Row inputs
  const [newRebateYear, setNewRebateYear] = useState<number>(new Date().getFullYear());
  const [newACS, setNewACS] = useState<string>('');
  const [newCash, setNewCash] = useState<string>('');
  const [newRebate, setNewRebate] = useState<string>('');
  const [newTier, setNewTier] = useState<string>('');
  const [newSpecificRebateCode, setNewSpecificRebateCode] = useState<string>('');
  
  // Filtering & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('CustomerName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Hardcoded permission for now
  const [permission] = useState<'READ_WRITE' | 'READ_ONLY' | 'NO_ACCESS'>('READ_WRITE');

  useEffect(() => {
    fetchCustomers();
    fetchFamilies();
    fetchRegions();
    fetchTiers();
    fetchCustomerMasters();
  }, []);

  useEffect(() => {
    if (isModalOpen && editingCustomer) {
      fetchCustomerRebates(editingCustomer.CustomerId);
    } else {
      setEditingRebates([]);
      setNewACS('');
      setNewCash('');
      setNewRebate('');
      setNewTier('');
      setNewSpecificRebateCode('');
      setCustomerSearchInput('');
    }
  }, [isModalOpen, editingCustomer]);

  const fetchCustomerRebates = async (customerId: number) => {
    setIsFetchingRebates(true);
    try {
      const response = await fetch(`/api/customer-rebates?customerId=${customerId}`);
      const data = await response.json();
      if (response.ok) {
        setEditingRebates(data);
      } else {
        console.error('Failed to fetch customer rebates', data);
      }
    } catch (err) {
      console.error('Error fetching customer rebates', err);
    } finally {
      setIsFetchingRebates(false);
    }
  };

  const handleRebateChange = (index: number, field: string, value: any) => {
    setEditingRebates(prev => {
      const copy = [...prev];
      let parsedValue = value;
      if (value === '') {
        parsedValue = null;
      } else if (field === 'SpecificRebateCode' || field === 'TierOverride') {
        parsedValue = value;
      } else {
        parsedValue = parseFloat(value);
      }
      copy[index] = { ...copy[index], [field]: parsedValue };
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
      alert(`A rebate rate for year ${year} already exists for this customer. You can edit the existing row instead.`);
      return;
    }
    const newRow = {
      CustomerId: editingCustomer?.CustomerId || selectedCustomerId || 0,
      ProgramYear: year,
      SpecificRebateCode: newSpecificRebateCode || null,
      ACSRebatePercent: newACS === '' ? null : parseFloat(newACS),
      CashRebatePercent: newCash === '' ? null : parseFloat(newCash),
      RebatePercent: newRebate === '' ? null : parseFloat(newRebate),
      TierOverride: newTier || null,
    };
    setEditingRebates(prev => [...prev, newRow].sort((a, b) => b.ProgramYear - a.ProgramYear));
    // Reset inputs
    setNewACS('');
    setNewCash('');
    setNewRebate('');
    setNewTier('');
    setNewSpecificRebateCode('');
  };

  const fetchCustomerMasters = async () => {
    try {
      const response = await fetch('/api/customer-master');
      const data = await response.json();
      if (response.ok) {
        setCustomerMasters(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch customer masters:', err);
    }
  };

  const fetchTiers = async () => {
    try {
      const response = await fetch('/api/customer-tiers');
      const data = await response.json();
      if (response.ok) {
        setTiers(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch tiers:', err);
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await fetch('/api/regions');
      const data = await response.json();
      if (response.ok) {
        setRegions(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch regions:', err);
    }
  };

  const fetchFamilies = async () => {
    try {
      const response = await fetch('/api/customer-families');
      const data = await response.json();
      if (response.ok) {
        setFamilies(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch families:', err);
    }
  };

  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      if (response.ok) {
        setCustomers(data);
      } else {
        setError(data.details || data.error || 'Failed to fetch customers');
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

  const filteredAndSortedCustomers = useMemo(() => {
    return customers
      .filter(c => 
        (c.CustomerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.CustomerId || '').toString().includes(searchTerm) ||
        (c.RegionCode?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (c.Territory?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (c.SpecificRebateCode?.toLowerCase() || '').includes(searchTerm.toLowerCase())
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
  }, [customers, searchTerm, sortField, sortOrder]);

  const handleDelete = async (id: number) => {
    if (permission !== 'READ_WRITE') return;
    if (!window.confirm('Are you sure you want to delete this customer?')) return;

    try {
      const response = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.ok) {
        setSuccess('Customer deleted successfully');
        fetchCustomers();
      } else {
        setError(result.details || result.error || 'Failed to delete customer');
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

    const formData = new FormData(e.currentTarget);
    
    // Determine Customer ID
    const finalCustomerId = editingCustomer ? editingCustomer.CustomerId : selectedCustomerId;
    if (!finalCustomerId) {
      setModalError('Please select a Customer ID.');
      return;
    }

    setIsSaving(true);
    const payload = {
      CustomerId: finalCustomerId,
      RegionCode: selectedRegionCode,
      Territory: formData.get('Territory'),
      IsActive: formData.get('IsActive') === 'on',
      rebates: editingRebates
    };

    const url = editingCustomer ? `/api/customers/${editingCustomer.SS_ID}` : '/api/customers';
    const method = editingCustomer ? 'PUT' : 'POST';

    try {
      const uName = localStorage.getItem('tcpp_user_name') || 'None';
      const uEmail = localStorage.getItem('tcpp_user_email') || 'None';
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': uName,
          'x-user-email': uEmail
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.ok) {
        setSuccess(result.message);
        setIsModalOpen(false);
        setEditingCustomer(null);
        setModalError(null);
        fetchCustomers();
      } else {
        setModalError(result.details || result.error || 'Failed to save customer');
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

  const familyOptions = useMemo(() => {
    return families.map(f => ({
      value: f.CustomerFamilyCode,
      label: `${f.CustomerFamilyCode} - ${f.CustomerFamilyName}`
    }));
  }, [families]);

  const regionOptions = useMemo(() => {
    return regions.map(r => ({
      value: r.RegionCode,
      label: `${r.RegionCode} - ${r.DisplayName}`
    }));
  }, [regions]);

  const tierOptions = useMemo(() => {
    return tiers.map(t => ({
      value: t.CustomerTiers,
      label: t.CustomerTiers
    }));
  }, [tiers]);

  const customerMasterOptions = useMemo(() => {
    // If we have a selected customer, let's find it so we can always keep it in the options
    const selectedOption = selectedCustomerId 
      ? customerMasters.find(m => m.CustomerId === selectedCustomerId)
      : null;

    let filtered = customerMasters;

    if (customerSearchInput.length >= 4) {
      const query = customerSearchInput.toLowerCase();
      filtered = customerMasters.filter(m => 
        String(m.CustomerId).toLowerCase().includes(query) || 
        m.CustomerName.toLowerCase().includes(query)
      );
    } else {
      // If less than 4 characters, don't show any options besides the currently selected one
      filtered = [];
    }

    // Make sure selected option is always in the list
    if (selectedOption && !filtered.some(m => m.CustomerId === selectedOption.CustomerId)) {
      filtered = [selectedOption, ...filtered];
    }

    return filtered.map(m => ({
      value: m.CustomerId,
      label: `${m.CustomerId} - ${m.CustomerName}`,
      customerName: m.CustomerName
    }));
  }, [customerMasters, customerSearchInput, selectedCustomerId]);

  const openModal = (customer: Customer | null = null) => {
    setEditingCustomer(customer);
    setSelectedFamilyCode(customer?.SpecificRebateCode || null);
    setSelectedRegionCode(customer?.RegionCode || null);
    setSelectedTier(customer?.TierOverride || null);
    setSelectedCustomerId(customer?.CustomerId || null);
    setSelectedCustomerName(customer?.CustomerName || '');
    setCustomerSearchInput('');
    setModalError(null);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 flex-1 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            <a className="hover:text-[#003461]" href="#">Parameters</a>
            <span className="mx-2">/</span>
            <span className="text-[#003461]">Customers</span>
          </nav>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400 flex items-center">
            Customers
            {permission === 'READ_ONLY' && (
              <span className="ml-4 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] uppercase font-bold rounded border border-slate-200">
                Read Only
              </span>
            )}
          </h2>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Manage dealer information, region assignments, and territory codes. This is the master list of all valid customers.
          </p>
        </div>
        
        {permission === 'READ_WRITE' && (
          <button 
            onClick={() => openModal(null)}
            className="bg-[#003461] text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 font-bold text-xs uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer</span>
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
            placeholder="Search dealer, address #, or region..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
          <Filter className="w-4 h-4" />
          <span>Results: {filteredAndSortedCustomers.length}</span>
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
                  onClick={() => handleSort('CustomerId')}
                >
                  <div className="flex items-center">Cust ID <SortIcon field="CustomerId" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('CustomerName')}
                >
                  <div className="flex items-center">Customer Name <SortIcon field="CustomerName" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('RegionCode')}
                >
                  <div className="flex items-center">Region <SortIcon field="RegionCode" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Territory')}
                >
                  <div className="flex items-center">Territory <SortIcon field="Territory" /></div>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Current Rebates and Tiers</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex justify-center flex-col items-center">
                      <div className="w-10 h-10 border-4 border-slate-200 border-t-[#003461] rounded-full animate-spin mb-4"></div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest">No matching records found</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedCustomers.map((customer) => (
                  <tr key={customer.SS_ID} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-[#003461]">{customer.CustomerId}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{customer.CustomerName}</div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.RegionCode ? (
                        <div className="flex flex-col">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] uppercase font-bold rounded w-fit">{customer.RegionCode}</span>
                          <span className="text-[9px] text-slate-400 font-medium truncate max-w-[100px]" title={regions.find(r => r.RegionCode === customer.RegionCode)?.DisplayName}>
                            {regions.find(r => r.RegionCode === customer.RegionCode)?.DisplayName || ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 font-medium">{customer.Territory || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[280px]">
                        {customer.SpecificRebateCode && (
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded" title={families.find(f => f.CustomerFamilyCode === customer.SpecificRebateCode)?.CustomerFamilyName}>
                            Code: {customer.SpecificRebateCode}
                          </span>
                        )}
                        {customer.ACSRebatePercentOverride !== null && (
                          <span className="text-[9px] font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded">
                            ACS: {customer.ACSRebatePercentOverride}%
                          </span>
                        )}
                        {customer.CashRebatePercentOverride !== null && (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Cash: {customer.CashRebatePercentOverride}%
                          </span>
                        )}
                        {customer.RebatePercentOverride !== null && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            Rebate: {customer.RebatePercentOverride}%
                          </span>
                        )}
                        {customer.TierOverride && (
                          <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                            Tier: {customer.TierOverride}
                          </span>
                        )}
                        {customer.OverrideProgramYear && (
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Year: {customer.OverrideProgramYear}
                          </span>
                        )}
                        {!customer.SpecificRebateCode && customer.ACSRebatePercentOverride === null && customer.CashRebatePercentOverride === null && customer.RebatePercentOverride === null && !customer.TierOverride && (
                          <span className="text-[10px] text-slate-300 italic">No Rates ({new Date().getFullYear()})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.IsActive ? (
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
                              onClick={() => openModal(customer)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit record"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(customer.SS_ID)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => openModal(customer)}
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
              className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-slate-200"
            >
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-[#003461] uppercase tracking-widest flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  {editingCustomer ? (permission === 'READ_ONLY' ? 'Customer Details' : 'Edit Customer') : 'New Customer'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col max-h-[calc(100vh-100px)] text-left">
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
                    {editingCustomer ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer ID</label>
                          <input 
                            type="text"
                            value={editingCustomer.CustomerId}
                            readOnly
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 rounded-lg text-sm font-semibold text-slate-500 cursor-not-allowed outline-none" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer Name</label>
                          <input 
                            type="text"
                            value={editingCustomer.CustomerName || ''}
                            readOnly
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 rounded-lg text-sm font-semibold text-slate-500 cursor-not-allowed outline-none" 
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer ID <span className="text-red-500">*</span></label>
                          <Select 
                            options={customerMasterOptions}
                            value={customerMasterOptions.find(opt => opt.value === selectedCustomerId)}
                            onChange={(opt) => {
                              setSelectedCustomerId(opt ? opt.value : null);
                              setSelectedCustomerName(opt ? opt.customerName : '');
                            }}
                            onInputChange={(newValue, { action }) => {
                              if (action === 'input-change') {
                                setCustomerSearchInput(newValue);
                              }
                            }}
                            noOptionsMessage={({ inputValue }) => {
                              if (inputValue.length < 4) {
                                return "Type at least 4 characters to search...";
                              }
                              return "No matching customers found";
                            }}
                            isDisabled={permission === 'READ_ONLY'}
                            className="text-sm"
                            placeholder="Type 4+ characters to search..."
                            isClearable
                            styles={{
                              control: (base) => ({
                                ...base,
                                borderRadius: '0.5rem',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#f8fafc',
                                boxShadow: 'none',
                                minHeight: '38px',
                                '&:hover': { border: '1px solid #cbd5e1' }
                              }),
                              option: (base, state) => ({
                                ...base,
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: state.isSelected ? '#003461' : base.backgroundColor,
                                '&:hover': { backgroundColor: state.isSelected ? '#003461' : '#f1f5f9' }
                              })
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer Name</label>
                          <input 
                            type="text"
                            value={selectedCustomerName}
                            readOnly
                            placeholder="Select Customer ID first..."
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 rounded-lg text-sm font-semibold text-slate-500 cursor-not-allowed outline-none" 
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Region Code</label>
                      <Select 
                        options={regionOptions}
                        value={regionOptions.find(opt => opt.value === selectedRegionCode)}
                        onChange={(opt) => setSelectedRegionCode(opt ? opt.value : null)}
                        isDisabled={permission === 'READ_ONLY'}
                        className="text-sm"
                        placeholder="Choose Region..."
                        isClearable
                        styles={{
                          control: (base) => ({
                            ...base,
                            borderRadius: '0.5rem',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            boxShadow: 'none',
                            minHeight: '38px',
                            '&:hover': { border: '1px solid #cbd5e1' }
                          }),
                          option: (base, state) => ({
                            ...base,
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: state.isSelected ? '#003461' : base.backgroundColor,
                            '&:hover': { backgroundColor: state.isSelected ? '#003461' : '#f1f5f9' }
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Territory</label>
                      <input 
                        name="Territory"
                        defaultValue={editingCustomer?.Territory || ''}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="e.g. T01" 
                        readOnly={permission === 'READ_ONLY'}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <input 
                      id="IsActive" 
                      name="IsActive" 
                      type="checkbox" 
                      defaultChecked={editingCustomer ? editingCustomer.IsActive : true}
                      disabled={permission === 'READ_ONLY'}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" 
                    />
                    <label htmlFor="IsActive" className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 cursor-pointer">Active Status</label>
                  </div>

                  {/* Annual Rebate Configurations Table */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-black uppercase tracking-wider text-[#003461] flex items-center">
                        <Database className="w-4 h-4 mr-2 text-blue-500" />
                        Annual Customer Rebate Rates
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Unique rate configuration per Year
                      </p>
                    </div>

                    {isFetchingRebates ? (
                      <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest flex justify-center items-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading annual rates...
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="px-4 py-2 w-24">Year</th>
                              <th className="px-4 py-2 w-48">Specific Rebate Code</th>
                              <th className="px-4 py-2">ACS Rebate %</th>
                              <th className="px-4 py-2">Cash Rebate %</th>
                              <th className="px-4 py-2">Rebate %</th>
                              <th className="px-4 py-2 w-36">Tier Override</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {editingRebates.map((rebate, index) => (
                              <tr key={rebate.SS_ID || `temp-${rebate.ProgramYear}`} className="text-xs hover:bg-slate-50/50">
                                <td className="px-4 py-2 font-mono font-semibold text-slate-600">
                                  {rebate.ProgramYear}
                                </td>
                                <td className="px-4 py-2">
                                  <select
                                    value={rebate.SpecificRebateCode || ''}
                                    onChange={(e) => handleRebateChange(index, 'SpecificRebateCode', e.target.value)}
                                    disabled={permission === 'READ_ONLY'}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold text-blue-700 bg-blue-50/20 focus:ring-1 focus:ring-blue-500 outline-none"
                                  >
                                    <option value="">N/A</option>
                                    {families.map(f => (
                                      <option key={f.CustomerFamilyCode} value={f.CustomerFamilyCode}>
                                        {f.CustomerFamilyCode} - {f.CustomerFamilyName}
                                      </option>
                                    ))}
                                  </select>
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
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold text-amber-700 bg-amber-50/20 focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="N/A"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <select
                                    value={rebate.TierOverride || ''}
                                    onChange={(e) => handleRebateChange(index, 'TierOverride', e.target.value)}
                                    disabled={permission === 'READ_ONLY'}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold text-purple-700 bg-purple-50/20 focus:ring-1 focus:ring-blue-500 outline-none"
                                  >
                                    <option value="">N/A</option>
                                    {tiers.map(t => (
                                      <option key={t.CustomerTiers} value={t.CustomerTiers}>
                                        {t.CustomerTiers}
                                      </option>
                                    ))}
                                  </select>
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
                                  <select
                                    value={newSpecificRebateCode}
                                    onChange={(e) => setNewSpecificRebateCode(e.target.value)}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold bg-white outline-none"
                                  >
                                    <option value="">Family...</option>
                                    {families.map(f => (
                                      <option key={f.CustomerFamilyCode} value={f.CustomerFamilyCode}>
                                        {f.CustomerFamilyCode} - {f.CustomerFamilyName}
                                      </option>
                                    ))}
                                  </select>
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
                                  <select
                                    value={newTier}
                                    onChange={(e) => setNewTier(e.target.value)}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold bg-white outline-none"
                                  >
                                    <option value="">Tier...</option>
                                    {tiers.map(t => (
                                      <option key={t.CustomerTiers} value={t.CustomerTiers}>
                                        {t.CustomerTiers}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={handleAddRebateRow}
                                    className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-all shrink-0"
                                    title="Add annual rate row"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {editingCustomer && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                      <div>
                        <span>Created By: {editingCustomer.CreatedBy}</span>
                        <span className="block opacity-60">{new Date(editingCustomer.CreatedDate).toLocaleString()}</span>
                      </div>
                      {editingCustomer.ModifiedBy && (
                        <div className="text-right">
                          <span>Modified By: {editingCustomer.ModifiedBy}</span>
                          <span className="block opacity-60">{new Date(editingCustomer.ModifiedDate!).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50/50">
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
                      <span>{isSaving ? 'Processing...' : (editingCustomer ? 'Save Changes' : 'Create Customer')}</span>
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
