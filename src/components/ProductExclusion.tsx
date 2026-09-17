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
  PackageX,
  History,
  Calendar,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Select from 'react-select';

interface ProductExclusion {
  SS_ID: number;
  ProductCode: string;
  ProgramYear: number;
  ExclusionReason: string | null;
  CreatedBy: string;
  CreatedDate: string;
  ModifiedBy: string | null;
  ModifiedDate: string | null;
}

interface ProductCategory {
  ProductCategory: string;
}

type SortField = keyof ProductExclusion;
type SortOrder = 'asc' | 'desc';

export default function ProductExclusion() {
  const [exclusions, setExclusions] = useState<ProductExclusion[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExclusion, setEditingExclusion] = useState<ProductExclusion | null>(null);
  const [isSaving, setIsLoadingSaving] = useState(false);
  
  // Form State
  const [selectedProductCode, setSelectedProductCode] = useState<{ value: string; label: string } | null>(null);

  // Filtering & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('ProductCode');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Permissions (Mocked)
  const [permission] = useState<'READ_WRITE' | 'READ_ONLY' | 'NO_ACCESS'>('READ_WRITE');

  useEffect(() => {
    fetchExclusions();
    fetchCategories();
  }, []);

  const fetchExclusions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/product-exclusions');
      const data = await response.json();
      if (response.ok) {
        setExclusions(data);
      } else {
        setError(data.details || data.error || 'Failed to fetch product exclusions');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/product-categories');
      const data = await response.json();
      if (response.ok) {
        setCategories(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch categories:', err.message);
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

  const filteredAndSortedExclusions = useMemo(() => {
    return exclusions
      .filter(ex => 
        ex.ProductCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ex.ExclusionReason?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
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
  }, [exclusions, searchTerm, sortField, sortOrder]);

  const handleDelete = async (id: number) => {
    if (permission !== 'READ_WRITE') return;
    if (!window.confirm('Are you sure you want to delete this product exclusion?')) return;

    try {
      const response = await fetch(`/api/product-exclusions/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.ok) {
        setSuccess('Product exclusion deleted successfully');
        fetchExclusions();
      } else {
        setError(result.details || result.error || 'Failed to delete exclusion');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (permission !== 'READ_WRITE' || isSaving) return;

    if (!selectedProductCode) {
      setModalError('Product Code is required');
      return;
    }

    setModalError(null);
    setError(null);
    setIsLoadingSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      ProductCode: selectedProductCode.value,
      ProgramYear: formData.get('ProgramYear'),
      ExclusionReason: formData.get('ExclusionReason'),
    };

    const url = editingExclusion ? `/api/product-exclusions/${editingExclusion.SS_ID}` : '/api/product-exclusions';
    const method = editingExclusion ? 'PUT' : 'POST';

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
        setEditingExclusion(null);
        setSelectedProductCode(null);
        fetchExclusions();
      } else {
        setModalError(result.details || result.error || 'Failed to save exclusion');
      }
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsLoadingSaving(false);
    }
  };

  const openModal = (exclusion: ProductExclusion | null = null) => {
    setEditingExclusion(exclusion);
    if (exclusion) {
      const cat = categories.find(c => c.ProductCategory === exclusion.ProductCode);
      setSelectedProductCode(cat ? { value: cat.ProductCategory, label: cat.ProductCategory } : { value: exclusion.ProductCode, label: exclusion.ProductCode });
    } else {
      setSelectedProductCode(null);
    }
    setModalError(null);
    setIsModalOpen(true);
  };

  const categoryOptions = useMemo(() => {
    return categories.map(c => ({
      value: c.ProductCategory,
      label: c.ProductCategory
    }));
  }, [categories]);

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
            <span className="text-[#003461]">Product Exclusion</span>
          </nav>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400 flex items-center">
            Product Exclusion
            {permission === 'READ_ONLY' && (
              <span className="ml-4 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] uppercase font-bold rounded border border-slate-200">
                Read Only
              </span>
            )}
          </h2>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Manage specific products or categories that are excluded from the TCPP rebate program. Exclusions are for the screen 'UDC_56_EQ'.
          </p>
        </div>
        
        {permission === 'READ_WRITE' && (
          <button 
            onClick={() => openModal(null)}
            className="bg-[#003461] text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 font-bold text-xs uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" />
            <span>Add Exclusion</span>
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
            placeholder="Search by code or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
          <Filter className="w-4 h-4" />
          <span>Results: {filteredAndSortedExclusions.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer" onClick={() => handleSort('ProductCode')}>
                   <div className="flex items-center">Product Code <SortIcon field="ProductCode" /></div>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer text-center" onClick={() => handleSort('ProgramYear')}>
                   <div className="flex items-center justify-center">Year <SortIcon field="ProgramYear" /></div>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Reason</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
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
              ) : filteredAndSortedExclusions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    <PackageX className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    No product exclusions found
                  </td>
                </tr>
              ) : (
                filteredAndSortedExclusions.map((ex) => (
                  <tr key={ex.SS_ID} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-[#003461]">{ex.ProductCode}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{ex.ProgramYear}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] text-slate-500 line-clamp-1 italic">{ex.ExclusionReason || '---'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => openModal(ex)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(ex.SS_ID)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
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
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-slate-200">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-[#003461] uppercase tracking-widest flex items-center">
                  <PackageX className="w-4 h-4 mr-2 text-red-500" />
                  {editingExclusion ? 'Edit Product Exclusion' : 'New Product Exclusion'}
                </h3>
                <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col max-h-[calc(100vh-100px)] text-left">
                <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">
                  {modalError && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start space-x-3 text-red-700 animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-[9px] uppercase tracking-wider text-red-800">Validation Error</h4>
                        <p className="text-[11px] mt-0.5">{modalError}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                          Product Code <span className="text-red-500 ml-1">*</span>
                        </label>
                        <Select
                          value={selectedProductCode}
                          onChange={(option) => setSelectedProductCode(option as any)}
                          options={categoryOptions}
                          className="text-sm"
                          styles={{
                            control: (base) => ({
                              ...base,
                              backgroundColor: '#f8fafc',
                              borderColor: '#e2e8f0',
                              borderRadius: '0.5rem',
                              padding: '2px',
                              boxShadow: 'none',
                              '&:hover': {
                                borderColor: '#cbd5e1'
                              }
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 9999
                            })
                          }}
                          placeholder="Select Category..."
                          isSearchable
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                          Program Year <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input 
                          name="ProgramYear"
                          type="number"
                          min="2020"
                          max="2099"
                          defaultValue={editingExclusion?.ProgramYear || new Date().getFullYear()}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                          placeholder="e.g. 2024"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                        <Info className="w-3 h-3" />
                        <label>Exclusion Reason</label>
                      </div>
                      <textarea 
                        name="ExclusionReason"
                        rows={3}
                        defaultValue={editingExclusion?.ExclusionReason || ''}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none italic text-slate-600" 
                        placeholder="Briefly explain why this product is excluded..."
                      />
                    </div>
                  </div>

                  {editingExclusion && (
                    <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <div className="flex items-center space-x-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            <History className="w-2.5 h-2.5" />
                            <span>Creation</span>
                         </div>
                         <p className="text-[9px] font-semibold text-slate-500 opacity-80">{editingExclusion.CreatedBy}</p>
                         <p className="text-[8px] text-slate-400">{new Date(editingExclusion.CreatedDate).toLocaleString()}</p>
                      </div>
                      {editingExclusion.ModifiedBy && (
                        <div className="space-y-1 text-right">
                          <div className="flex items-center justify-end space-x-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>Modified</span>
                            <Calendar className="w-2.5 h-2.5" />
                          </div>
                          <p className="text-[9px] font-semibold text-slate-500 opacity-80">{editingExclusion.ModifiedBy}</p>
                          <p className="text-[8px] text-slate-400">{new Date(editingExclusion.ModifiedDate!).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50/50">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700">Cancel</button>
                  <button type="submit" disabled={isSaving} className="bg-[#003461] text-white px-8 py-2.5 rounded-lg hover:bg-blue-800 font-bold text-xs uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-900/10">
                    {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{isSaving ? 'Saving...' : (editingExclusion ? 'Save Changes' : 'Create Exclusion')}</span>
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
