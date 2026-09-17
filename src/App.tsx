/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SalesData from './components/SalesData';
import RebateParameters from './components/RebateParameters';
import CustomerGroups from './components/CustomerGroups';
import CustomerGroupMembership from './components/CustomerGroupMembership';
import GlobalRebates from './components/GlobalRebates';
import ProductExclusion from './components/ProductExclusion';
import SEFARebateCriteria from './components/SEFARebateCriteria';
import USRebateCriteria from './components/USRebateCriteria';
import NonUSRebateCriteria from './components/NonUSRebateCriteria';
import Help from './components/Help';
import CustomerTCPPQualifiers from './components/CustomerTCPPQualifiers';
import Customers from './components/Customers';
import MicrosoftLogin from './components/MicrosoftLogin';
import SecretsManager from './components/SecretsManager';
import QuarterlyReports from './components/QuarterlyReports';
import QuarterlyReportsByGroup from './components/QuarterlyReportsByGroup';
import QuarterlyReportsAllGroups from './components/QuarterlyReportsAllGroups';
import FinanceReports from './components/FinanceReports';
import USScorecardCustomer from './components/USScorecardCustomer';
import CAScorecardCustomer from './components/CAScorecardCustomer';
import SEFAScorecardCustomer from './components/SEFAScorecardCustomer';
import UpdateCustomerMaster from './components/UpdateCustomerMaster';
import UpdateGroupMaster from './components/UpdateGroupMaster';
import CustomerLookup from './components/CustomerLookup';
import CustomerLookupView from './components/CustomerLookupView';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('rebate-parameters');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [userName, setUserName] = useState(localStorage.getItem('tcpp_user_name') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('tcpp_user_email') || '');
  const [userJobTitle, setUserJobTitle] = useState(localStorage.getItem('tcpp_user_job_title') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('tcpp_user_role') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('tcpp_user_email') && !!localStorage.getItem('tcpp_jwt_token'));

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setUserName('');
      setUserEmail('');
      setUserJobTitle('');
      setUserRole('');
    };

    window.addEventListener('auth_unauthorized', handleUnauthorized);

    // Verify current JWT session on mount
    const token = localStorage.getItem('tcpp_jwt_token');
    if (token) {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.user) {
            setUserName(data.user.displayName || '');
            setUserEmail(data.user.email || '');
            setUserJobTitle(data.user.jobTitle || '');
            setUserRole(data.user.role || 'User');
            setIsAuthenticated(true);
          } else {
            handleUnauthorized();
          }
        })
        .catch(() => {
          // Keep local session if backend unreachable temporarily, or disconnect if unauthorized
        });
    }

    return () => {
      window.removeEventListener('auth_unauthorized', handleUnauthorized);
    };
  }, []);

  const handleLoginSuccess = (name: string, email: string, jobTitle: string, role: string) => {
    setUserName(name);
    setUserEmail(email);
    setUserJobTitle(jobTitle);
    setUserRole(role);
    setIsAuthenticated(true);
    setActiveTab('rebate-parameters');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'sales-data':
        if (userRole?.trim().toLowerCase() !== 'admin') {
          return (
            <div className="p-8 flex-1 flex items-center justify-center">
              <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-950/40 p-6 rounded-xl shadow-lg text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600">
                  <X className="w-6 h-6" />
                </div>
                <h3 className="text-red-700 dark:text-red-400 font-extrabold text-lg">Access Denied</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Only users with an <strong>Admin</strong> RoleName in the SQL Server security database are authorized to view Snowflake Sales Data.
                </p>
              </div>
            </div>
          );
        }
        return <SalesData onSync={handleSync} isSyncing={isSyncing} />;
      case 'rebate-parameters':
      case 'reports':
      case 'administration':
      case 'entity-management':
      case 'spreadsheet-views':
      case 'help':
        return <Help />;
      case 'customer-groups':
        return <CustomerGroups />;
      case 'customer-membership':
        return <CustomerGroupMembership />;
      case 'global-rebates':
        return <GlobalRebates />;
      case 'product-exclusion':
        return <ProductExclusion />;
      case 'sefa-rebate-criteria':
        return <SEFARebateCriteria />;
      case 'us-rebate-criteria':
        return <USRebateCriteria />;
      case 'non-us-rebate-criteria':
        return <NonUSRebateCriteria />;
      case 'customer-tcpp-qualifiers':
        return <CustomerTCPPQualifiers />;
      case 'customers':
        return <Customers />;
      case 'quarterly-reports':
        return <QuarterlyReports />;
      case 'quarterly-reports-by-group':
        return <QuarterlyReportsByGroup />;
      case 'quarterly-reports-all-groups':
        return <QuarterlyReportsAllGroups />;
      case 'finance-reports':
        return <FinanceReports />;
      case 'us-scorecard-customer':
        return <USScorecardCustomer />;
      case 'ca-scorecard-customer':
        return <CAScorecardCustomer />;
      case 'sefa-scorecard-customer':
        return <SEFAScorecardCustomer />;
      case 'finance-customer-rebate':
        return <CustomerLookup />;
      case 'customer-lookup':
        return <CustomerLookupView />;
      case 'secrets':
        return <SecretsManager />;
      case 'update-customer-master':
        return <UpdateCustomerMaster />;
      case 'update-group-master':
        return <UpdateGroupMaster />;
      case 'dummy-login':
        return <MicrosoftLogin onLoginSuccess={handleLoginSuccess} />;
      default:
        return <RebateParameters />;
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      const result = await response.json();
      if (response.ok) {
        setSyncStatus({ message: result.message, type: 'success' });
      } else {
        setSyncStatus({ message: result.error || 'Sync failed', type: 'error' });
      }
    } catch (error: any) {
      setSyncStatus({ message: error.message, type: 'error' });
    } finally {
      setIsSyncing(false);
      // Auto-hide status after 5 seconds
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-[#f7f9fc] flex min-h-screen items-center justify-center p-4">
        <MicrosoftLogin onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="bg-[#f7f9fc] font-sans text-[#191c1e] flex min-h-screen">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole}
      />

      <main className="ml-64 flex-1 flex flex-col min-h-screen">
        <header className="w-full h-16 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center px-6 sticky top-0 z-40 bg-slate-50 dark:bg-slate-900 shadow-sm dark:shadow-none">
          <div className="flex items-center space-x-3">
            <div className="bg-transparent flex items-center">
              <img 
                src="/Vollrath_Logo.svg" 
                alt="Vollrath Logo" 
                className="h-[42px] md:h-[48px] max-w-[285px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
               <div className="text-right">
                 <p className="text-sm font-bold text-[#003461] dark:text-blue-400 leading-none">{userName}</p>
                 <p className="text-[10px] text-slate-500 font-medium">{userJobTitle}</p>
               </div>
              <img 
                alt="User Profile" 
                className="w-10 h-10 rounded-full object-cover border-2 border-blue-100" 
                src="https://picsum.photos/seed/alex/100/100"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        <div className="bg-gradient-to-r from-[#003461] to-blue-700 h-1 w-full"></div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>

        {/* Floating Sync Status */}
        <AnimatePresence>
          {(isSyncing || syncStatus) && (
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="fixed bottom-6 right-6 z-50 flex items-center bg-white/80 backdrop-blur-md border border-slate-200 p-4 rounded-xl shadow-2xl space-x-4 max-w-sm"
            >
              <div className="relative flex-shrink-0">
                {isSyncing ? (
                  <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-[#003461] animate-spin"></div>
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${syncStatus?.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    <RefreshCw className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#003461]">
                  {isSyncing ? 'ERP Syncing in Progress' : syncStatus?.type === 'success' ? 'Sync Completed' : 'Sync Failed'}
                </h4>
                <p className="text-[10px] text-slate-500">
                  {isSyncing ? 'Synchronizing records between Snowflake and SQL Server...' : syncStatus?.message}
                </p>
              </div>
              <button 
                onClick={() => setSyncStatus(null)}
                className="text-slate-300 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

