import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Database, 
  Loader2, 
  AlertCircle, 
  Calendar, 
  User, 
  Clock, 
  ChevronUp, 
  ChevronDown,
  Info,
  HelpCircle,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';

interface CustomerRebateRecord {
  Customer_ID: number;
  Customer_Name: string;
  Rebate_Percent: number | null;
  Rebate_Percent_Explanation: string | null;
  ACS_Rebate: number | null;
  ACSRebate_Percent_Explanation: string | null;
  Cash_Rebate: number | null;
  Cash_Rebate_Percent_Explanation: string | null;
  Group_Number: string | null;
  Date_Effective: string | null;
  Date_Expired: string | null;
  Updated_By: string | null;
  Updated_Date: string | null;
}

type SortField = keyof CustomerRebateRecord;
type SortOrder = 'asc' | 'desc';

export default function CustomerLookup() {
  const [records, setRecords] = useState<CustomerRebateRecord[]>([]);
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
      const response = await fetch('/api/spreadsheet-views/finance-customer-rebate');
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.details || errJson.error || 'Failed to fetch customer rebate records');
      }
      const data = await response.json();
      setRecords(data);
    } catch (err: any) {
      console.error('Error fetching customer rebate records:', err);
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

  // Percent Formatting Function
  const formatPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    const pct = val * 100;
    // Format to max 4 decimals, stripping trailing zeros
    return `${parseFloat(pct.toFixed(4))}%`;
  };

  // Date Formatting Helper
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      // format to YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return dateStr;
    }
  };

  // Filter and Sort records
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];

    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(rec => 
        (rec.Customer_Name || '').toLowerCase().includes(lowerSearch) ||
        (rec.Customer_ID || '').toString().includes(lowerSearch) ||
        (rec.Group_Number || '').toLowerCase().includes(lowerSearch) ||
        (rec.Updated_By || '').toLowerCase().includes(lowerSearch)
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

      // Numbers or Dates
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
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Navigation Breadcrumb & Header */}
      <div className="mb-8">
        <nav className="text-sm font-medium text-slate-500 mb-2">
          Spreadsheet Views / <span className="text-[#003461] font-semibold">Finance Customer Rebate</span>
        </nav>
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <Database className="w-6 h-6 text-[#003461] dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400">Finance Customer Rebate</h2>
            <p className="text-slate-500 mt-1 max-w-3xl text-sm">
              Live spreadsheet view of finance customer rebates. Hover over the percentage cells to inspect explanation logs.
            </p>
          </div>
        </div>
      </div>

      {/* Database Error Alert */}
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

      {/* Control Bar: Search & Page size */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-t-xl border-t border-x border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            className="block w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003461] text-xs font-semibold"
            placeholder="Search by ID, Customer Name, Group or Updater..."
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

      {/* Live Spreadsheet Grid View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-b-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Customer_ID')}
                >
                  <div className="flex items-center">Customer ID <SortIcon field="Customer_ID" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Customer_Name')}
                >
                  <div className="flex items-center">Customer Name <SortIcon field="Customer_Name" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Rebate_Percent')}
                >
                  <div className="flex items-center">Rebate % <SortIcon field="Rebate_Percent" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('ACS_Rebate')}
                >
                  <div className="flex items-center">ACS Rebate <SortIcon field="ACS_Rebate" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Cash_Rebate')}
                >
                  <div className="flex items-center">Cash Rebate <SortIcon field="Cash_Rebate" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Group_Number')}
                >
                  <div className="flex items-center">Group No <SortIcon field="Group_Number" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Date_Effective')}
                >
                  <div className="flex items-center">Effective Date <SortIcon field="Date_Effective" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Date_Expired')}
                >
                  <div className="flex items-center">Expiration Date <SortIcon field="Date_Expired" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Updated_By')}
                >
                  <div className="flex items-center">Updated By <SortIcon field="Updated_By" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#003461]"
                  onClick={() => handleSort('Updated_Date')}
                >
                  <div className="flex items-center">Updated Date <SortIcon field="Updated_Date" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <div className="flex flex-col justify-center items-center">
                      <Loader2 className="w-8 h-8 text-[#003461] animate-spin mb-3" />
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Querying SQL Server View...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-slate-400 dark:text-slate-600">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">No customer rebate records matching query</p>
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
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 line-clamp-2 max-w-[200px]" title={item.Customer_Name}>
                        {item.Customer_Name}
                      </div>
                    </td>

                    {/* Rebate Percent */}
                    <td className="px-6 py-4 relative group/item">
                      {item.Rebate_Percent !== null ? (
                        <div className="relative group/tooltip inline-block">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 cursor-help border-b border-dashed border-slate-400 hover:border-[#003461] transition-colors pb-0.5">
                            {formatPercent(item.Rebate_Percent)}
                          </span>
                          {item.Rebate_Percent_Explanation && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block w-72 bg-slate-800 dark:bg-slate-950 text-white text-[11px] leading-relaxed rounded-lg p-3 shadow-xl border border-slate-700 z-50 pointer-events-none transition-all duration-150">
                              <div className="font-semibold text-blue-400 mb-1 flex items-center">
                                <Info className="w-3.5 h-3.5 mr-1" />
                                Rebate Explanation
                              </div>
                              <p className="font-normal text-slate-200">{item.Rebate_Percent_Explanation}</p>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800 dark:border-t-slate-950"></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>

                    {/* ACS Rebate */}
                    <td className="px-6 py-4">
                      {item.ACS_Rebate !== null ? (
                        <div className="relative group/tooltip inline-block">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 cursor-help border-b border-dashed border-slate-400 hover:border-[#003461] transition-colors pb-0.5">
                            {formatPercent(item.ACS_Rebate)}
                          </span>
                          {item.ACSRebate_Percent_Explanation && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block w-72 bg-slate-800 dark:bg-slate-950 text-white text-[11px] leading-relaxed rounded-lg p-3 shadow-xl border border-slate-700 z-50 pointer-events-none transition-all duration-150">
                              <div className="font-semibold text-amber-400 mb-1 flex items-center">
                                <Info className="w-3.5 h-3.5 mr-1" />
                                ACS Rebate Explanation
                              </div>
                              <p className="font-normal text-slate-200">{item.ACSRebate_Percent_Explanation}</p>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800 dark:border-t-slate-950"></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>

                    {/* Cash Rebate */}
                    <td className="px-6 py-4">
                      {item.Cash_Rebate !== null ? (
                        <div className="relative group/tooltip inline-block">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 cursor-help border-b border-dashed border-slate-400 hover:border-[#003461] transition-colors pb-0.5">
                            {formatPercent(item.Cash_Rebate)}
                          </span>
                          {item.Cash_Rebate_Percent_Explanation && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block w-72 bg-slate-800 dark:bg-slate-950 text-white text-[11px] leading-relaxed rounded-lg p-3 shadow-xl border border-slate-700 z-50 pointer-events-none transition-all duration-150">
                              <div className="font-semibold text-emerald-400 mb-1 flex items-center">
                                <Info className="w-3.5 h-3.5 mr-1" />
                                Cash Rebate Explanation
                              </div>
                              <p className="font-normal text-slate-200">{item.Cash_Rebate_Percent_Explanation}</p>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800 dark:border-t-slate-950"></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>

                    {/* Group Number */}
                    <td className="px-6 py-4">
                      {item.Group_Number ? (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded">
                          {item.Group_Number}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </td>

                    {/* Effective Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {formatDate(item.Date_Effective)}
                      </div>
                    </td>

                    {/* Expiration Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {formatDate(item.Date_Expired)}
                      </div>
                    </td>

                    {/* Updated By */}
                    <td className="px-6 py-4">
                      <div className="flex items-center text-xs text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[120px]" title={item.Updated_By || ''}>
                        <User className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {item.Updated_By || '-'}
                      </div>
                    </td>

                    {/* Updated Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {formatDate(item.Updated_Date)}
                      </div>
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
