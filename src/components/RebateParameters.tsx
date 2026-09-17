import React from 'react';
import { PlusCircle, Filter, Download, Edit, Trash2, AlertTriangle, Save, X } from 'lucide-react';

export default function RebateParameters() {
  const tiers = [
    { id: 'RT-001', min: '0.00', max: '99,999.99', rate: '1.25%', status: 'ACTIVE' },
    { id: 'RT-002', min: '100,000.00', max: '249,999.99', rate: '2.50%', status: 'ACTIVE' },
    { id: 'RT-003', min: '250,000.00', max: '499,999.99', rate: '4.00%', status: 'REVIEW', alert: true },
    { id: 'RT-004', min: '500,000.00', max: '999,999.99', rate: '5.50%', status: 'ACTIVE' },
    { id: 'RT-NEW', min: '1,000,000.00', max: '—', rate: '7.00%', status: 'DRAFT', draft: true },
  ];

  return (
    <div className="p-8 flex-1">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            <a className="hover:text-[#003461]" href="#">Parameters</a>
            <span className="mx-2">/</span>
            <span className="text-[#003461]">Rebate Tiers</span>
          </nav>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#003461] dark:text-blue-400">Rebate Tiers Configuration</h2>
          <p className="text-slate-500 mt-2 max-w-2xl text-sm">Define and manage performance-based rebate brackets. Adjust volume thresholds and payout percentages to align with quarterly growth initiatives.</p>
        </div>
        <button className="flex items-center space-x-2 bg-[#003461] text-white px-5 py-2.5 rounded hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/10 font-bold text-sm">
          <PlusCircle className="w-4 h-4" />
          <span>Add New Row</span>
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Tier Status</p>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Active Tiers</span>
                <span className="bg-blue-50 text-[#003461] px-2 py-0.5 rounded text-xs font-bold">04</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Exceptions</span>
                <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded text-xs font-bold">12</span>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Modification</p>
                <p className="text-xs font-bold text-[#003461]">24 OCT 2023 | 09:42 AM</p>
              </div>
            </div>
          </div>

          <div className="bg-[#6e0008] text-white p-6 rounded-lg shadow-lg shadow-red-900/10 relative overflow-hidden group">
            <div className="relative z-10">
              <AlertTriangle className="mb-4 opacity-50 w-6 h-6" />
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">System Alert</p>
              <h3 className="text-lg font-bold mt-1">Tier Overlap Detected</h3>
              <p className="text-xs mt-2 opacity-90 leading-relaxed">Tier 3 and Tier 4 share a common range between $450k and $500k. System will default to higher value.</p>
              <button className="mt-4 text-xs font-bold underline underline-offset-4 decoration-2 hover:decoration-white/50 transition-all">Resolve Conflict</button>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-9">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-[#003461] dark:text-blue-400 text-sm uppercase tracking-wider">Tier Parameters Matrix</h3>
              <div className="flex space-x-2">
                <button className="p-1.5 text-slate-400 hover:text-[#003461] transition-colors"><Filter className="w-5 h-5" /></button>
                <button className="p-1.5 text-slate-400 hover:text-[#003461] transition-colors"><Download className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-400">Tier ID</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-400">Min. Volume ($)</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-400">Max. Volume ($)</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-400">Rebate %</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-400">Status</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {tiers.map((tier) => (
                    <tr key={tier.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group ${tier.alert ? 'border-l-4 border-red-500/50' : ''} ${tier.draft ? 'italic' : ''}`}>
                      <td className={`px-6 py-4 font-bold text-sm ${tier.draft ? 'text-slate-400' : 'text-[#003461] dark:text-blue-400'}`}>{tier.id}</td>
                      <td className={`px-6 py-4 text-sm font-mono ${tier.draft ? 'text-slate-400' : 'text-slate-600'}`}>{tier.min}</td>
                      <td className={`px-6 py-4 text-sm font-mono ${tier.draft ? 'text-slate-400' : 'text-slate-600'}`}>{tier.max}</td>
                      <td className={`px-6 py-4 text-sm font-bold ${tier.draft ? 'text-slate-400' : 'text-[#003461]'}`}>{tier.rate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          tier.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 
                          tier.status === 'REVIEW' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {tier.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {tier.draft ? (
                            <>
                              <button className="p-1.5 text-slate-400 hover:text-[#003461] hover:bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                              <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <button className="p-1.5 text-slate-400 hover:text-[#003461] hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                              <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
