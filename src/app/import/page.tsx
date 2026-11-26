'use client';

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  Download,
  Package,
  Store,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDistributor } from '@/context/DistributorContext';

const SAMPLE_JAIPUR_PRODUCTS = [
  { sku_code: 'PRL-001', name: 'Parle-G Gold Biscuits (Box of 24)', category: 'Biscuits', unit: 'Box', rate: 215, scheme_text: '1 Box Free on 15 Boxes', stock_qty: 120 },
  { sku_code: 'BRT-002', name: 'Britannia Good Day Cashew 200g (Pack of 12)', category: 'Biscuits', unit: 'Case', rate: 380, scheme_text: 'Flat 3% Off', stock_qty: 85 },
  { sku_code: 'ITC-003', name: 'Aashirvaad Shudh Chakki Atta 10kg (Bag of 3)', category: 'Staples', unit: 'Bori', rate: 1290, scheme_text: '', stock_qty: 60 },
  { sku_code: 'HUL-004', name: 'Surf Excel Easy Wash 1kg (Pack of 10)', category: 'Home Care', unit: 'Case', rate: 1180, scheme_text: 'Free Bucket on 5 Cases', stock_qty: 45 },
  { sku_code: 'HUL-005', name: 'Lifebuoy Total 10 Soap 125g (Pack of 36)', category: 'Personal Care', unit: 'Case', rate: 1050, scheme_text: '', stock_qty: 90 },
  { sku_code: 'ITC-006', name: 'Sunfeast Dark Fantasy Choco Fills (Box of 12)', category: 'Biscuits', unit: 'Box', rate: 410, scheme_text: '1 Box Free on 10', stock_qty: 50 },
  { sku_code: 'PEP-007', name: 'Lays Classic Salted ₹20 (Pouch of 30)', category: 'Snacks', unit: 'Carton', rate: 510, scheme_text: '', stock_qty: 140 },
  { sku_code: 'AMU-008', name: 'Amul Taaza Toned Milk 1L (Pack of 12)', category: 'Dairy & Beverages', unit: 'Case', rate: 790, scheme_text: '', stock_qty: 75 },
  { sku_code: 'MAG-009', name: 'Maggi 2-Minute Masala Noodles 12-Pack (Case of 8)', category: 'Instant Food', unit: 'Case', rate: 1240, scheme_text: '2% Cash Discount', stock_qty: 110 },
  { sku_code: 'TAT-010', name: 'Tata Tea Premium 1kg (Pack of 10)', category: 'Beverages', unit: 'Case', rate: 4450, scheme_text: '1kg Free on 3 Cases', stock_qty: 35 },
];

const SAMPLE_JAIPUR_RETAILERS = [
  { shop_name: 'Khandelwal Kirana & General Store', owner_name: 'Mahesh Khandelwal', phone: '9829011101', area: 'Malviya Nagar', credit_limit: 50000, current_due: 18500 },
  { shop_name: 'Shree Shyam Provision Store', owner_name: 'Gopal Sharma', phone: '9829011102', area: 'Vaishali Nagar', credit_limit: 75000, current_due: 42000 },
  { shop_name: 'Agarwal Super Mart', owner_name: 'Deepak Agarwal', phone: '9829011103', area: 'Mansarovar', credit_limit: 100000, current_due: 12400 },
  { shop_name: 'Mahaveer Kirana Bhandar', owner_name: 'Rajesh Jain', phone: '9829011104', area: 'Johari Bazar', credit_limit: 60000, current_due: 54000 },
  { shop_name: 'Bikaner Sweets & Departmental', owner_name: 'Kishan Rathore', phone: '9829011105', area: 'C-Scheme', credit_limit: 80000, current_due: 0 },
  { shop_name: 'Balaji Traders & Kirana', owner_name: 'Vikram Saini', phone: '9829011106', area: 'Sanganer', credit_limit: 40000, current_due: 29500 },
  { shop_name: 'Gupta Daily Needs', owner_name: 'Anil Gupta', phone: '9829011107', area: 'Raja Park', credit_limit: 50000, current_due: 8200 },
  { shop_name: 'Jodhpur Mishthan & General', owner_name: 'Harish Choudhary', phone: '9829011108', area: 'Jhotwara', credit_limit: 45000, current_due: 31000 },
];

export default function ImportDataPage() {
  const { activeDistributor } = useDistributor();
  const [productCount, setProductCount] = useState(0);
  const [retailerCount, setRetailerCount] = useState(0);
  const [loadingSample, setLoadingSample] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCounts = async () => {
    if (!activeDistributor) return;
    const [prodRes, retRes] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('distributor_id', activeDistributor.id),
      supabase.from('retailers').select('id', { count: 'exact', head: true }).eq('distributor_id', activeDistributor.id),
    ]);
    setProductCount(prodRes.count || 0);
    setRetailerCount(retRes.count || 0);
  };

  useEffect(() => {
    fetchCounts();
  }, [activeDistributor]);

  // 1-Click Sample Jaipur Data Loader
  const handleLoadJaipurDemoData = async () => {
    if (!activeDistributor) return;
    setLoadingSample(true);
    setStatusMsg(null);

    const productsPayload = SAMPLE_JAIPUR_PRODUCTS.map((p) => ({
      ...p,
      distributor_id: activeDistributor.id,
    }));

    const retailersPayload = SAMPLE_JAIPUR_RETAILERS.map((r) => ({
      ...r,
      distributor_id: activeDistributor.id,
    }));

    const [pErr, rErr] = await Promise.all([
      supabase.from('products').insert(productsPayload),
      supabase.from('retailers').insert(retailersPayload),
    ]);

    setLoadingSample(false);
    if (pErr.error || rErr.error) {
      setStatusMsg({
        type: 'error',
        text: `Error: ${pErr.error?.message || rErr.error?.message}`,
      });
    } else {
      setStatusMsg({
        type: 'success',
        text: `Loaded 10 FMCG products & 8 Jaipur kirana stores into ${activeDistributor.company_name}!`,
      });
      fetchCounts();
    }
  };

  // CSV Upload Handler for Products
  const handleProductCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDistributor) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[];
        const formatted = rows
          .filter((row) => row.name || row['Item Name'])
          .map((row) => ({
            distributor_id: activeDistributor.id,
            sku_code: row.sku_code || row['SKU'] || '',
            name: (row.name || row['Item Name'] || '').trim(),
            category: (row.category || row['Category'] || 'General').trim(),
            unit: (row.unit || row['Unit'] || 'Box').trim(),
            rate: parseFloat(row.rate || row['Rate'] || row['Price'] || '0') || 0,
            scheme_text: (row.scheme_text || row['Scheme'] || '').trim(),
            stock_qty: parseInt(row.stock_qty || row['Stock'] || '50', 10) || 0,
          }));

        if (formatted.length === 0) {
          setStatusMsg({ type: 'error', text: 'No valid product rows found. Ensure CSV has a "name" and "rate" column.' });
          return;
        }

        const { error } = await supabase.from('products').insert(formatted);
        if (error) {
          setStatusMsg({ type: 'error', text: error.message });
        } else {
          setStatusMsg({ type: 'success', text: `Successfully imported ${formatted.length} products!` });
          fetchCounts();
        }
      },
    });
  };

  // CSV Upload Handler for Retailers (Party List)
  const handleRetailerCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDistributor) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[];
        const formatted = rows
          .filter((row) => row.shop_name || row['Party Name'])
          .map((row) => ({
            distributor_id: activeDistributor.id,
            shop_name: (row.shop_name || row['Party Name'] || '').trim(),
            owner_name: (row.owner_name || row['Owner'] || '').trim(),
            phone: (row.phone || row['Phone'] || '').trim(),
            area: (row.area || row['Area'] || 'Jaipur').trim(),
            credit_limit: parseFloat(row.credit_limit || row['Credit Limit'] || '50000') || 50000,
            current_due: parseFloat(row.current_due || row['Opening Balance'] || '0') || 0,
          }));

        if (formatted.length === 0) {
          setStatusMsg({ type: 'error', text: 'No valid retailer rows found. Ensure CSV has a "shop_name" column.' });
          return;
        }

        const { error } = await supabase.from('retailers').insert(formatted);
        if (error) {
          setStatusMsg({ type: 'error', text: error.message });
        } else {
          setStatusMsg({ type: 'success', text: `Successfully imported ${formatted.length} retail stores!` });
          fetchCounts();
        }
      },
    });
  };

  // Download sample CSV templates for client onboarding
  const downloadTemplate = (type: 'products' | 'retailers') => {
    const csvContent =
      type === 'products'
        ? 'sku_code,name,category,unit,rate,scheme_text,stock_qty\nSKU-101,Parle Marie Gold (Box of 20),Biscuits,Box,240,1 Free on 12,100'
        : 'shop_name,owner_name,phone,area,credit_limit,current_due\nSharma Kirana Store,Ramesh Sharma,9829012345,Malviya Nagar,50000,12000';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Current Workspace Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            1-Click Tally / Excel Data Importer
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Active Workspace: <span className="font-semibold text-blue-600">{activeDistributor?.company_name}</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2.5">
            <Package className="w-4 h-4 text-blue-600" />
            <div>
              <div className="text-xs text-slate-500">Catalog Items</div>
              <div className="font-bold text-slate-900">{productCount}</div>
            </div>
          </div>
          <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2.5">
            <Store className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="text-xs text-slate-500">Retailer Parties</div>
              <div className="font-bold text-slate-900">{retailerCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          {statusMsg.text}
        </div>
      )}

      {/* Quick Demo Seed Box */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Instant Demo Setup
          </div>
          <h2 className="text-lg font-bold">
            Populate Jaipur FMCG Sample Data in 1 Click
          </h2>
          <p className="text-sm text-blue-100 mt-1">
            Inserts 10 top-selling FMCG products (Parle, Britannia, ITC, HUL, Amul) and 8 Jaipur kirana stores across Malviya Nagar, Vaishali Nagar & Mansarovar.
          </p>
        </div>
        <button
          onClick={handleLoadJaipurDemoData}
          disabled={loadingSample}
          className="bg-white text-blue-700 hover:bg-blue-50 font-semibold text-sm px-5 py-3 rounded-xl shadow-sm whitespace-nowrap transition shrink-0"
        >
          {loadingSample ? 'Loading Data...' : 'Load Jaipur Sample Data'}
        </button>
      </div>

      {/* Two Upload Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Card 1: Product Catalog CSV */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">1. Upload Product Price List</h3>
                <p className="text-xs text-slate-500">CSV exported from Tally / Excel</p>
              </div>
            </div>
            <button
              onClick={() => downloadTemplate('products')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              Sample CSV
            </button>
          </div>

          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
            Supported columns: <code className="font-mono text-slate-800">sku_code, name, category, unit, rate, scheme_text, stock_qty</code>
          </p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 cursor-pointer transition bg-slate-50/50">
            <Upload className="w-6 h-6 text-slate-400 mb-2" />
            <span className="text-sm font-medium text-slate-700">Click to select Products CSV</span>
            <span className="text-xs text-slate-400 mt-1">Instant bulk import into database</span>
            <input type="file" accept=".csv" onChange={handleProductCSV} className="hidden" />
          </label>
        </div>

        {/* Card 2: Retailer Party List CSV */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">2. Upload Retailer Party List</h3>
                <p className="text-xs text-slate-500">Kirana stores & opening Udhaar balances</p>
              </div>
            </div>
            <button
              onClick={() => downloadTemplate('retailers')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              Sample CSV
            </button>
          </div>

          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
            Supported columns: <code className="font-mono text-slate-800">shop_name, owner_name, phone, area, credit_limit, current_due</code>
          </p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 cursor-pointer transition bg-slate-50/50">
            <Upload className="w-6 h-6 text-slate-400 mb-2" />
            <span className="text-sm font-medium text-slate-700">Click to select Retailers CSV</span>
            <span className="text-xs text-slate-400 mt-1">Auto-creates customer ledgers</span>
            <input type="file" accept=".csv" onChange={handleRetailerCSV} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
}