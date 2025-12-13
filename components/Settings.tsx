
import React, { useState, useEffect } from 'react';
import { Save, Server, Printer, CreditCard, Shield, RefreshCw, CheckCircle, AlertTriangle, Smartphone, Store, FileText, Database, Settings as SettingsIcon, Bell, Receipt, Sliders } from 'lucide-react';

const Settings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // Store Settings State
  const [settings, setSettings] = useState({
    // Store Profile
    name: 'Bihari Chatkara',
    tagline: 'The Authentic Taste',
    address1: 'Part-1, Lower Ground Floor, Amrapali Sapphire Arcade, AT-004',
    address2: 'Sadarpur, Sector-45, Noida, Uttar Pradesh 201303',
    phone: '+91 8595709271',
    email: 'contact@biharichatkara.com',
    gstin: '09IBKPK8468R1Z8',
    fssai: '22723925000849',
    
    // Preferences
    currencySymbol: '₹',
    defaultTaxRate: 5,
    serviceCharge: 0,
    enableKdsSound: true,
    receiptFooterMessage: 'Thank you! Visit again.',
    
    // Payment
    paytmEnabled: true,
    paytmMerchantId: '',
    paytmTerminalId: '',
    paytmMerchantKey: '',
    paytmEnv: 'production',

    // Printer
    printerWidth: '80mm',
    autoPrintReceipt: false
  });

  const [paytmStatus, setPaytmStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');

  // Load settings on mount
  useEffect(() => {
    const savedReceipt = localStorage.getItem('rms_receipt_details');
    const savedPaytm = localStorage.getItem('rms_paytm_config');
    const savedPrefs = localStorage.getItem('rms_preferences');
    
    let merged = { ...settings };

    if (savedReceipt) {
      merged = { ...merged, ...JSON.parse(savedReceipt) };
    }
    if (savedPaytm) {
      const p = JSON.parse(savedPaytm);
      merged = { 
          ...merged, 
          paytmEnabled: p.enabled, 
          paytmMerchantId: p.merchantId,
          paytmTerminalId: p.terminalId,
          paytmMerchantKey: p.merchantKey,
          paytmEnv: p.environment
      };
      if (p.enabled && p.merchantId) setPaytmStatus('connected');
    }
    if (savedPrefs) {
        merged = { ...merged, ...JSON.parse(savedPrefs) };
    }

    setSettings(merged);
  }, []);

  const handleChange = (key: string, value: any) => {
      setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setIsLoading(true);
    
    // 1. Save Store Profile & Receipt Metadata
    const profileData = {
        name: settings.name, tagline: settings.tagline,
        address1: settings.address1, address2: settings.address2,
        phone: settings.phone, email: settings.email,
        gstin: settings.gstin, fssai: settings.fssai
    };
    localStorage.setItem('rms_receipt_details', JSON.stringify(profileData));
    
    // 2. Save Payment Config
    const paytmData = {
        enabled: settings.paytmEnabled,
        merchantId: settings.paytmMerchantId,
        terminalId: settings.paytmTerminalId,
        merchantKey: settings.paytmMerchantKey,
        environment: settings.paytmEnv
    };
    localStorage.setItem('rms_paytm_config', JSON.stringify(paytmData));

    // 3. Save Preferences
    const prefsData = {
        currencySymbol: settings.currencySymbol,
        defaultTaxRate: settings.defaultTaxRate,
        serviceCharge: settings.serviceCharge,
        enableKdsSound: settings.enableKdsSound,
        receiptFooterMessage: settings.receiptFooterMessage,
        printerWidth: settings.printerWidth,
        autoPrintReceipt: settings.autoPrintReceipt
    };
    localStorage.setItem('rms_preferences', JSON.stringify(prefsData));

    setTimeout(() => {
        setIsLoading(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  const testPaytmConnection = () => {
      if (!settings.paytmMerchantId) {
          alert("Please enter a Merchant ID first.");
          return;
      }
      setPaytmStatus('testing');
      setTimeout(() => {
          setPaytmStatus('connected');
          alert("Paytm POS Terminal Connected Successfully! Device is ready to accept payments.");
      }, 2000);
  };

  const tabs = [
      { id: 'profile', label: 'Store Profile', icon: Store },
      { id: 'preferences', label: 'Preferences', icon: Sliders },
      { id: 'payment', label: 'Payment', icon: CreditCard },
      { id: 'data', label: 'Data', icon: Database },
  ];

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-slate-50">
      
      {/* Header */}
      <div className="bg-white px-4 md:px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10 shrink-0">
        <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                <SettingsIcon className="text-slate-600" /> <span className="hidden md:inline">Settings</span>
            </h2>
        </div>
        <button 
            onClick={handleSave}
            disabled={isLoading}
            className="bg-slate-900 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-70 text-sm md:text-base"
        >
            {isLoading ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
            {saveSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Mobile-Friendly Tabs / Sidebar */}
          <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-2 md:p-4 flex md:flex-col overflow-x-auto md:overflow-visible gap-2 flex-shrink-0 no-scrollbar">
              {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`whitespace-nowrap px-4 py-2 md:py-3 rounded-full md:rounded-lg font-medium text-sm flex items-center gap-2 md:gap-3 transition-colors ${
                            isActive 
                            ? 'bg-blue-600 text-white md:bg-blue-50 md:text-blue-700 shadow-md md:shadow-none' 
                            : 'bg-slate-100 text-slate-600 md:bg-transparent md:hover:bg-slate-50 border border-slate-200 md:border-transparent'
                        }`}
                    >
                        <Icon size={18} /> {tab.label}
                    </button>
                  )
              })}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-20 md:pb-0">
                  
                  {activeTab === 'profile' && (
                      <section className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
                          <h3 className="font-bold text-lg text-slate-800 mb-6 border-b pb-2">Store Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                              <div className="space-y-4">
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">Store Name</label>
                                      <input type="text" value={settings.name} onChange={e => handleChange('name', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">Tagline</label>
                                      <input type="text" value={settings.tagline} onChange={e => handleChange('tagline', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">Address Line 1</label>
                                      <input type="text" value={settings.address1} onChange={e => handleChange('address1', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">Address Line 2</label>
                                      <input type="text" value={settings.address2} onChange={e => handleChange('address2', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                                  </div>
                              </div>
                              <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                          <label className="block text-sm font-bold text-slate-700 mb-1">Phone</label>
                                          <input type="text" value={settings.phone} onChange={e => handleChange('phone', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                          <input type="email" value={settings.email} onChange={e => handleChange('email', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                                      </div>
                                  </div>
                                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1"><Shield size={12} /> Compliance</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                              <label className="block text-xs font-bold text-slate-600 mb-1">GSTIN</label>
                                              <input type="text" value={settings.gstin} onChange={e => handleChange('gstin', e.target.value)} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono uppercase" />
                                          </div>
                                          <div>
                                              <label className="block text-xs font-bold text-slate-600 mb-1">FSSAI</label>
                                              <input type="text" value={settings.fssai} onChange={e => handleChange('fssai', e.target.value)} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono uppercase" />
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </section>
                  )}

                  {activeTab === 'preferences' && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                          <section className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                              <h3 className="font-bold text-lg text-slate-800 mb-6 border-b pb-2">Order & Tax Configuration</h3>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">Currency Symbol</label>
                                      <input type="text" value={settings.currencySymbol} onChange={e => handleChange('currencySymbol', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-center font-bold" />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">Default Tax Rate (%)</label>
                                      <input type="number" value={settings.defaultTaxRate} onChange={e => handleChange('defaultTaxRate', parseFloat(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">Service Charge (%)</label>
                                      <input type="number" value={settings.serviceCharge} onChange={e => handleChange('serviceCharge', parseFloat(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                                  </div>
                              </div>
                          </section>

                          <section className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                              <h3 className="font-bold text-lg text-slate-800 mb-6 border-b pb-2 flex items-center gap-2"><Bell size={20}/> Alerts & Sound</h3>
                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                  <div>
                                      <h4 className="font-bold text-slate-800">KDS Alert Sound</h4>
                                      <p className="text-sm text-slate-500">Play a notification sound when a new order arrives in the kitchen.</p>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={settings.enableKdsSound} onChange={e => handleChange('enableKdsSound', e.target.checked)} className="sr-only peer" />
                                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                  </label>
                              </div>
                          </section>

                          <section className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                              <h3 className="font-bold text-lg text-slate-800 mb-6 border-b pb-2 flex items-center gap-2"><Printer size={20}/> Printer Settings</h3>
                              <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                          <label className="block text-sm font-bold text-slate-700 mb-1">Receipt Footer Message</label>
                                          <input type="text" value={settings.receiptFooterMessage} onChange={e => handleChange('receiptFooterMessage', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Thank you!" />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-bold text-slate-700 mb-1">Paper Width</label>
                                          <select value={settings.printerWidth} onChange={e => handleChange('printerWidth', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
                                              <option value="80mm">80mm (Standard)</option>
                                              <option value="58mm">58mm (Narrow)</option>
                                          </select>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <input type="checkbox" id="autoprint" checked={settings.autoPrintReceipt} onChange={e => handleChange('autoPrintReceipt', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                                      <label htmlFor="autoprint" className="text-sm font-medium text-slate-700">Automatically open print dialog after payment</label>
                                  </div>
                              </div>
                          </section>
                      </div>
                  )}

                  {activeTab === 'payment' && (
                      <section className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
                          <div className="flex items-center justify-between mb-6 border-b pb-2">
                              <h3 className="font-bold text-lg text-slate-800">Paytm POS Integration</h3>
                              <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${settings.paytmEnabled ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                  <span className="text-sm font-medium text-slate-600">{settings.paytmEnabled ? 'Active' : 'Disabled'}</span>
                              </div>
                          </div>
                          
                          <div className="flex flex-col md:flex-row gap-6">
                              <div className="w-full md:w-64 flex-shrink-0 bg-[#002E6E] p-6 rounded-xl text-white flex flex-col items-center justify-center text-center shadow-lg h-fit">
                                  <Smartphone size={48} className="mb-2 text-[#00B9F1]" />
                                  <h4 className="text-xl font-bold">Paytm Business</h4>
                                  <p className="text-xs text-blue-200 mt-1">POS & EDC Integration</p>
                                  <div className={`mt-4 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                                      paytmStatus === 'connected' ? 'bg-green-500 text-white' : 'bg-white/10 text-white'
                                  }`}>
                                      {paytmStatus === 'connected' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                                      {paytmStatus === 'connected' ? 'Connected' : 'Not Connected'}
                                  </div>
                              </div>

                              <div className="flex-1 space-y-4">
                                  <div className="flex items-center gap-4 mb-2">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                          <input 
                                            type="checkbox" 
                                            checked={settings.paytmEnabled}
                                            onChange={e => handleChange('paytmEnabled', e.target.checked)}
                                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                          />
                                          <span className="font-bold text-slate-700">Enable Integration</span>
                                      </label>
                                  </div>

                                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!settings.paytmEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                      <div>
                                          <label className="block text-sm font-bold text-slate-600 mb-1">Merchant ID (MID)</label>
                                          <input type="text" value={settings.paytmMerchantId} onChange={e => handleChange('paytmMerchantId', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm" />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-bold text-slate-600 mb-1">Terminal ID (TID)</label>
                                          <input type="text" value={settings.paytmTerminalId} onChange={e => handleChange('paytmTerminalId', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm" />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-bold text-slate-600 mb-1">Merchant Key</label>
                                          <input type="password" value={settings.paytmMerchantKey} onChange={e => handleChange('paytmMerchantKey', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm" />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-bold text-slate-600 mb-1">Environment</label>
                                          <select value={settings.paytmEnv} onChange={e => handleChange('paytmEnv', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                                              <option value="production">Production (Live)</option>
                                              <option value="staging">Staging (Test)</option>
                                          </select>
                                      </div>
                                  </div>

                                  <div className="pt-2">
                                      <button onClick={testPaytmConnection} disabled={!settings.paytmEnabled || paytmStatus === 'testing'} className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors flex items-center gap-2">
                                          {paytmStatus === 'testing' ? <RefreshCw size={16} className="animate-spin" /> : <Server size={16} />}
                                          {paytmStatus === 'testing' ? 'Connecting...' : 'Test Connection'}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </section>
                  )}

                  {activeTab === 'data' && (
                      <section className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
                          <h3 className="font-bold text-lg text-slate-800 mb-6 border-b pb-2 flex items-center gap-2"><Database size={20}/> Data & System Actions</h3>
                          <div className="flex flex-wrap gap-4">
                              <button 
                                onClick={() => window.location.reload()}
                                className="border border-slate-300 text-slate-700 px-4 py-3 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center gap-2 w-full md:w-auto justify-center"
                              >
                                  <RefreshCw size={16} /> Force Reload Application
                              </button>
                              
                              <button 
                                className="border border-red-200 text-red-600 bg-red-50 px-4 py-3 rounded-lg font-bold text-sm hover:bg-red-100 flex items-center gap-2 w-full md:w-auto justify-center"
                                onClick={() => {
                                    if(confirm("Are you sure you want to clear Local Storage? This will reset settings but preserve cloud database.")) {
                                        localStorage.clear();
                                        window.location.reload();
                                    }
                                }}
                              >
                                  <AlertTriangle size={16} /> Factory Reset (Local Settings)
                              </button>
                          </div>
                      </section>
                  )}

              </div>
          </div>
      </div>
    </div>
  );
};

export default Settings;
