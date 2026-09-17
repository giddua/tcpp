import React from 'react';
import { 
  Database, 
  Settings, 
  FileText, 
  Shield, 
  Info,
  ChevronRight,
  HelpCircle,
  Users,
  Target,
  BarChart3,
  Lock
} from 'lucide-react';

export default function Help() {
  const sections = [
    {
      title: 'Finance Section',
      icon: Users,
      description: 'Manage core business entities and customer-group relationships that drive the rebate system logic and qualification metrics.',
      features: [
        'Customers: View and manage detailed customer profile records.',
        'Groups: Define and manage logical customer groupings for group-level rebates.',
        'Customer Groups: Map individual customers to their respective rebate groups.',
        'Quarterly Reports By Customer: Generate and download quarterly rebate calculations and customer summaries report.',
        'Quarterly Reports by Group: Generate and download quarterly rebate calculations report aggregated by group.',
        'Quarterly Reports - All Groups: Generate and download quarterly rebate calculations report for all groups.',
        'Finance Reports: Generate and download customer level purchase details and rebate accruals report.'
      ]
    },
    {
      title: 'Marketing Section',
      icon: Settings,
      description: 'Configure multi-tiered rebate parameters, threshold criteria, and specialized customer qualifiers.',
      features: [
        'Global & Group Rebates: Set tiered rebate parameters at the global or group level.',
        'Jurisdiction Criteria: Manage specific rules for SEFA, United States, and Non-US registrations.',
        'Product Exclusions: Manage specific products excluded from qualifying programs.',
        'TCPP Qualifiers: Configure Technical Support and Service rebate rules.',
        'US Scorecard by Customer: Generate and download US rebate scorecard reports by customer.',
        'CA Scorecard by Customer: Generate and download CA rebate scorecard reports by customer.',
        'SEFA Scorecard by Customer: Generate and download SEFA rebate scorecard reports by customer.'
      ]
    },
    {
      title: 'Reports Section',
      icon: FileText,
      description: 'View and export dynamic metrics and financial analyses.',
      features: [
        'Quarterly Reports By Customer: Generate and download quarterly rebate calculations and customer summaries report.',
        'Quarterly Reports by Group: Generate and download quarterly rebate calculations report aggregated by group.',
        'Quarterly Reports - All Groups: Generate and download quarterly rebate calculations report for all groups.',
        'Finance Reports: Generate and download customer level purchase details and rebate accruals report.',
        'US Scorecard by Customer: Generate and download US rebate scorecard reports by customer.',
        'CA Scorecard by Customer: Generate and download CA rebate scorecard reports by customer.',
        'SEFA Scorecard by Customer: Generate and download SEFA rebate scorecard reports by customer.'
      ]
    },
    {
      title: 'Spreadsheet Views',
      icon: Database,
      description: 'View data in a format similar to former ingestion spreadsheet.',
      features: [
        'Finance Customer Rebate: View for verifying rebate percentages for each Customer.',
        'Customer Lookup: View for verifying Customer Group relationship and Customer attributes like Territory, Region and Specific Rebate Code.'
      ]
    }
  ];

  return (
    <div className="p-8 flex-1 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          <span className="text-[#003461]">System Overview</span>
          <span className="mx-2">/</span>
          <span className="text-slate-400">Help & Documentation</span>
        </nav>
        <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] flex items-center">
          Tiered Customer Purchase Program Help Center
          <HelpCircle className="ml-3 w-6 h-6 text-blue-500 opacity-50" />
        </h2>
        <p className="text-slate-500 mt-2 text-sm max-w-2xl">
          Welcome to the Rebate Management System. This platform allows you to manage entities, manage relationships between entities, configure rebate parameters, and generate reports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-slate-50 rounded-lg">
                <section.icon className="w-5 h-5 text-[#003461]" />
              </div>
              <h3 className="font-bold text-lg text-[#003461]">{section.title}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {section.description}
            </p>
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center">
                <Info className="w-3 h-3 mr-1" />
                Key Components
              </h4>
              <ul className="grid grid-cols-1 gap-2">
                {section.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start text-xs text-slate-500">
                    <ChevronRight className="w-3 h-3 mr-2 mt-0.5 text-blue-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#003461] rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-xl font-bold mb-2">Need Technical Support?</h3>
          <p className="text-blue-100 text-sm max-w-lg mb-6">
            If you encounter errors or usage issues, please contact Arun Giddu (arun.giddu@vollrathco.com).
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20">
              <p className="text-[10px] uppercase font-bold tracking-widest text-blue-200">System Version</p>
              <p className="text-sm font-bold">AI 1.0</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20">
              <p className="text-[10px] uppercase font-bold tracking-widest text-blue-200">Data Source</p>
              <p className="text-sm font-bold">SQL Server / Snowflake Hybrid</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-8 h-full flex items-center opacity-10">
          <Lock className="w-32 h-32" />
        </div>
      </div>
    </div>
  );
}
