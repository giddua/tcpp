import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Database, 
  Loader2, 
  AlertCircle, 
  ChevronUp, 
  ChevronDown,
  Building2,
  DollarSign,
  Layers,
  MapPin,
  Tag
} from 'lucide-react';

interface CustomerLookupRecord {
  Customer_ID: number;
  Customer_Name: string;
  Group_Name: string | null;
  Territory: string | null;
  Region: string | null;
  Specific_Rebate_Code: string | null;
  Sales: number | null;
  Tier: string | null;
}

type SortField = keyof CustomerLookupRecord;
type SortOrder = 'asc' | 'desc';

export default function CustomerLookupView() {
  const [records, setRecords] = useState<CustomerLookupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering, Search & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('Customer_Name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/spreadsheet-views/customer-lookup');
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.details || errJson.error || 'Failed to fetch customer lookup records');
      }
      const data = await response.json();
      setRecords(data);
    } catch (err: any) {
      console.error('Error fetching customer lookup records:', err);
      setError(err.message || 'An error occurred while fetching customer records.');
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

  // Currency Formatting helper
  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(val);
  };

  // Filter and Sort records
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];

    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(rec => 
        (rec.Customer_Name || '').toLowerCase().includes(lowerSearch) ||
        (rec.Customer_ID || '').toString().includes(lowerSearch) ||
        (rec.Group_Name || '').toLowerCase().includes(lowerSearch) ||
        (rec.Territory || '').toLowerCase().includes(lowerSearch) ||
        (rec.Region || '').toLowerCase().includes(lowerSearch) ||
        (rec.Specific_Rebate_Code || '').toLowerCase().includes(lowerSearch) ||
        (rec.Tier || '').toLowerCase().includes(lowerSearch)
      );
    }

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }

      // Numbers
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [records, searchTerm, sortField, sortOrder]);

  // Pagination logic
  const totalItems = filteredAndSortedRecords.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = useMemo(() => {
    return filteredAndSortedRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedRecords, startIndex, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 ml-1 inline" /> : <ChevronDown className="w-3.5 h-3.5 ml-1 inline" />;
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Breadcrumb & Title Header */}
      <div className="mb-8">
        <nav className="text-sm font-medium text-slate-500 mb-2">
          Spreadsheet Views / <span className="text-[#003461] font-semibold">Customer Lookup</span>
        </nav>
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <Building2 className="w-6 h-6 text-[#003461] dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400">Customer Lookup</h2>
            <p className="text-slate-500 mt-1 max-w-3xl text-sm">
              Live lookup utility with multi-field search and pagination querying TCPP Customer Lookup details.
            </p>
          </div>
        </div>
      </div>

      {/* SQL Connection Error Alert */}
      {error && (
        <div className="mb-6">
          <div className="flex items-start bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-4 rounded-lg text-sm border border-red-100 dark:border-red-900/30 shadow-sm">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">SQL Server Retrieval Failure</h4>
              <p className="mt-1 text-xs opacity-90">{error}</p>
              <p className="mt-2 text-[11px] text-red-600/80 font-semibold">
                * Please check your SQL Server credentials in the Secrets Configuration settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search and control panels */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-t-xl border-t border-x border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            className="block w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003461] text-xs font-semibold"
            placeholder="Search by ID, Customer Name, Group, Territory, Region or Tier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Show</span>
          <select
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#003461]"
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
          >
            <option value={10}>10 records</option>
            <option value={25}>25 records</option>
            <option value={50}>50 records</option>
            <option value={100}>100 records</option>
          </select>
          <span className="text-xs text-slate-400 font-semibold">
            ({totalItems} records found)
          </span>
        </div>
      </div>

      {/* Tabular data representation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-b-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461] whitespace-nowrap"
                  onClick={() => handleSort('Customer_ID')}
                >
                  <div className="flex items-center">Customer ID <SortIcon field="Customer_ID" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461] whitespace-nowrap"
                  onClick={() => handleSort('Customer_Name')}
                >
                  <div className="flex items-center">Customer Name <SortIcon field="Customer_Name" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461] whitespace-nowrap"
                  onClick={() => handleSort('Group_Name')}
                >
                  <div className="flex items-center">Group Name <SortIcon field="Group_Name" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461] whitespace-nowrap"
                  onClick={() => handleSort('Territory')}
                >
                  <div className="flex items-center">Territory <SortIcon field="Territory" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461] whitespace-nowrap"
                  onClick={() => handleSort('Region')}
                >
                  <div className="flex items-center">Region <SortIcon field="Region" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461] whitespace-nowrap"
                  onClick={() => handleSort('Specific_Rebate_Code')}
                >
                  <div className="flex items-center">Rebate Code <SortIcon field="Specific_Rebate_Code" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461] whitespace-nowrap"
                  onClick={() => handleSort('Sales')}
                >
                  <div className="flex items-center">Sales <SortIcon field="Sales" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461] whitespace-nowrap"
                  onClick={() => handleSort('Tier')}
                >
                  <div className="flex items-center">Tier <SortIcon field="Tier" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col justify-center items-center">
                      <Loader2 className="w-8 h-8 text-[#003461] animate-spin mb-3" />
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Querying SQL Server View...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-400 dark:text-slate-600">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">No customer lookup records matching query</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((item, index) => (
                  <tr 
                    key={`${item.Customer_ID}-${index}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Customer ID */}
                    <td className="px-6 py-4 font-mono text-xs font-bold text-[#003461] dark:text-blue-400">
                      {item.Customer_ID}
                    </td>

                    {/* Customer Name */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 max-w-[220px] truncate" title={item.Customer_Name}>
                        {item.Customer_Name}
                      </div>
                    </td>

                    {/* Group Name */}
                    <td className="px-6 py-4">
                      {item.Group_Name ? (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded">
                          {item.Group_Name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>

                    {/* Territory */}
                    <td className="px-6 py-4">
                      <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {item.Territory || '-'}
                      </div>
                    </td>

                    {/* Region */}
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                      {item.Region || '-'}
                    </td>

                    {/* Specific Rebate Code */}
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">
                      {item.Specific_Rebate_Code ? (
                        <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-900/30">
                          {item.Specific_Rebate_Code}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>

                    {/* Sales */}
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(item.Sales)}
                    </td>

                    {/* Tier */}
                    <td className="px-6 py-4">
                      {item.Tier ? (
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded border border-emerald-100 dark:border-emerald-900/30">
                          {item.Tier}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {!isLoading && totalItems > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800 dark:text-slate-200">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {Math.min(startIndex + itemsPerPage, totalItems)}
              </span>{' '}
              of <span className="font-bold text-slate-800 dark:text-slate-200">{totalItems}</span> records
            </div>

            <div className="flex items-center space-x-2">
              <button
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                Previous
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let targetPage = currentPage;
                  if (currentPage <= 3) targetPage = i + 1;
                  else if (currentPage >= totalPages - 2) targetPage = totalPages - 4 + i;
                  else targetPage = currentPage - 2 + i;
                  
                  if (targetPage < 1 || targetPage > totalPages) return null;

                  return (
                    <button
                      key={targetPage}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        currentPage === targetPage
                          ? 'bg-[#003461] text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                      onClick={() => setCurrentPage(targetPage)}
                    >
                      {targetPage}
                    </button>
                  );
                })}
              </div>

              <button
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
