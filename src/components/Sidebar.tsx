import React from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Shield,
  Users, 
  Package, 
  Globe, 
  Layers, 
  FileText, 
  HelpCircle, 
  LogOut,
  Database
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: string;
}

export default function Sidebar({ activeTab, setActiveTab, userRole }: SidebarProps) {
  const menuItems = [
    { id: 'entity-management', label: 'Finance Section', icon: Users, subItems: [
      { id: 'customers', label: 'Customers' },
      { id: 'customer-groups', label: 'Groups' },
      { id: 'customer-membership', label: 'Customer Groups' },
      { id: 'quarterly-reports', label: 'Quarterly Reports By Customer' },
      { id: 'quarterly-reports-by-group', label: 'Quarterly Reports by Group' },
      { id: 'quarterly-reports-all-groups', label: 'Quarterly Reports - All Groups' },
      { id: 'finance-reports', label: 'Finance Reports' }
    ]},
    { id: 'rebate-parameters', label: 'Marketing Section', icon: Settings, subItems: [
      { id: 'global-rebates', label: 'Global Rebates' },
      { id: 'product-exclusion', label: 'Product Exclusion' },
      { id: 'sefa-rebate-criteria', label: 'SEFA Rebate Criteria' },
      { id: 'us-rebate-criteria', label: 'US Rebate Criteria' },
      { id: 'non-us-rebate-criteria', label: 'Non-US Rebate Criteria' },
      { id: 'customer-tcpp-qualifiers', label: 'Customer TCPP Qualifiers' },
      { id: 'us-scorecard-customer', label: 'US Scorecard by Customer' },
      { id: 'ca-scorecard-customer', label: 'CA Scorecard by Customer' },
      { id: 'sefa-scorecard-customer', label: 'SEFA Scorecard by Customer' }
    ]},
    { id: 'reports', label: 'Reports Section', icon: FileText, subItems: [
      { id: 'quarterly-reports', label: 'Quarterly Reports By Customer' },
      { id: 'quarterly-reports-by-group', label: 'Quarterly Reports by Group' },
      { id: 'quarterly-reports-all-groups', label: 'Quarterly Reports - All Groups' },
      { id: 'finance-reports', label: 'Finance Reports' },
      { id: 'us-scorecard-customer', label: 'US Scorecard by Customer' },
      { id: 'ca-scorecard-customer', label: 'CA Scorecard by Customer' },
      { id: 'sefa-scorecard-customer', label: 'SEFA Scorecard by Customer' }
    ]},
    { id: 'spreadsheet-views', label: 'Spreadsheet Views', icon: Database, subItems: [
      { id: 'finance-customer-rebate', label: 'Finance Customer Rebate' },
      { id: 'customer-lookup', label: 'Customer Lookup' }
    ]},
    { id: 'administration', label: 'Administration', icon: Shield, subItems: [
      { id: 'secrets', label: 'Secrets Configuration' },
      { id: 'update-customer-master', label: 'Update Customer Master' },
      { id: 'update-group-master', label: 'Update Group Master' },
      { id: 'sales-data', label: 'View Sales Data (Snowflake)' }
    ]},
  ].filter(item => {
    if (item.id === 'administration' && userRole?.trim().toLowerCase() !== 'admin') {
      return false;
    }
    return true;
  });

  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuItems.forEach(item => {
      if (item.id === activeTab || item.subItems?.some(sub => sub.id === activeTab)) {
        initial[item.id] = true;
      }
    });
    return initial;
  });

  React.useEffect(() => {
    const matchingSections = menuItems.filter(
      item => item.id === activeTab || item.subItems?.some(sub => sub.id === activeTab)
    );
    if (matchingSections.length > 0) {
      const isAnyParentExpanded = matchingSections.some(item => expandedSections[item.id]);
      if (!isAnyParentExpanded) {
        setExpandedSections(prev => ({
          ...prev,
          [matchingSections[0].id]: true
        }));
      }
    }
  }, [activeTab]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
    setActiveTab(sectionId);
  };

  const handleSubItemClick = (sectionId: string, subId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: true
    }));
    setActiveTab(subId);
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-slate-100 dark:bg-slate-950 flex flex-col py-4 space-y-2 z-50 transition-all duration-200 ease-in-out border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
      <div className="px-6 mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#003461] flex items-center justify-center rounded-lg shadow-inner">
            <LayoutDashboard className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-[#003461] dark:text-blue-500 font-bold leading-none">Tiered Customer Purchase Program</h1>
            <p className="uppercase tracking-widest text-[10px] font-bold text-slate-500 mt-1">Rebate Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => (
          <div key={item.id} className="space-y-1">
            <button
              onClick={() => toggleSection(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 transition-all duration-200 ease-in-out rounded ${
                activeTab === item.id 
                  ? 'bg-slate-50 dark:bg-slate-900 border-l-4 border-[#003461] text-[#003461] dark:text-blue-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center">
                <item.icon className="mr-3 w-5 h-5" />
                <span className="uppercase tracking-widest text-[10px] font-bold">{item.label}</span>
              </div>
              {item.subItems && <span className="text-xs">{expandedSections[item.id] ? '−' : '+'}</span>}
            </button>
            
            {item.subItems && expandedSections[item.id] && (
              <div className="ml-8 space-y-1 mt-1 border-l border-slate-200 dark:border-slate-800">
                {item.subItems.map((sub) => (
                  <button
                    key={`${item.id}-${sub.id}`}
                    onClick={() => handleSubItemClick(item.id, sub.id)}
                    className={`w-full text-left block px-4 py-2 text-[9px] uppercase tracking-wider font-bold transition-colors ${
                      activeTab === sub.id ? 'text-[#003461] bg-slate-200/50' : 'text-slate-500 hover:text-[#003461]'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="mt-auto px-6 space-y-4">
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col space-y-1">
          <button 
            onClick={() => setActiveTab('help')} 
            className={`flex items-center px-3 py-2 transition-colors ${activeTab === 'help' ? 'text-[#003461] bg-slate-200' : 'text-slate-600 hover:text-[#003461]'}`}
          >
            <HelpCircle className="mr-3 w-5 h-5" />
            <span className="uppercase tracking-widest text-[10px] font-bold">Help</span>
          </button>
          <button 
            onClick={() => {
              /* old stuff
              localStorage.clear();
              window.location.reload();
              */
              // new suggestion to try by Google
              const handleLogout = async () => {
              try {
                // 1. Clear sensitive storage
                localStorage.clear();

                // 2. Reset your global React state manually (if using Context/Redux)
                //setUserName(null); 
                //setIsAuthenticated(false);

                // 3. Force a clean redirect to the base URL
                // This is better than reload() because it clears the URL params/state
                // window.location.href = window.location.origin;
                window.location.replace(window.location.origin); 
              } 
              catch (error) {
                console.error("Logout failed", error);
                }
              };
              handleLogout();
              // end new suggestion

            }}
            className="flex items-center px-3 py-2 text-slate-600 hover:text-red-600 w-full"
          >
            <LogOut className="mr-3 w-5 h-5" />
            <span className="uppercase tracking-widest text-[10px] font-bold">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
