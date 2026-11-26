'use client';

import React, { useEffect, useState } from 'react';
import {
  IndianRupee,
  Truck,
  AlertTriangle,
  TrendingUp,
  Package,
  MapPin,
  MessageCircle,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useDistributor } from '@/context/DistributorContext';
import Link from 'next/link';

interface AreaMetric {
  area: string;
  revenue: number;
}

interface TopProduct {
  name: string;
  units: number;
  revenue: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  sku_code: string;
  stock_qty: number;
  unit: string;
}

export default function OwnerDashboard() {
  const { activeDistributor, loading: distLoading } = useDistributor();

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingDispatchCount, setPendingDispatchCount] = useState(0);
  const [totalMarketDue, setTotalMarketDue] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [areaSales, setAreaSales] = useState<AreaMetric[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchDashboardMetrics = async () => {
    if (!activeDistributor) return;
    setLoadingStats(true);

    const [ordersRes, retailersRes, productsRes, itemsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, total_amount, status, retailers(area)')
        .eq('distributor_id', activeDistributor.id),
      supabase
        .from('retailers')
        .select('current_due')
        .eq('distributor_id', activeDistributor.id),
      supabase
        .from('products')
        .select('id, name, sku_code, stock_qty, unit')
        .eq('distributor_id', activeDistributor.id),
      supabase
        .from('order_items')
        .select('product_name, quantity, subtotal, orders!inner(distributor_id)')
        .eq('orders.distributor_id', activeDistributor.id),
    ]);

    // 1. Order Revenue & Pending Dispatches
    const orders = ordersRes.data || [];
    const rev = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const pending = orders.filter(
      (o) => o.status === 'New' || o.status === 'Packed'
    ).length;
    setTotalRevenue(rev);
    setPendingDispatchCount(pending);

    // 2. Area-Wise Revenue Aggregation
    const areaMap: Record<string, number> = {};
    orders.forEach((o: any) => {
      const areaName = o.retailers?.area || 'Jaipur Central';
      areaMap[areaName] = (areaMap[areaName] || 0) + Number(o.total_amount || 0);
    });
    const sortedAreas = Object.entries(areaMap)
      .map(([area, revenue]) => ({ area, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
    setAreaSales(sortedAreas);

    // 3. Total Market Credit (Udhaar)
    const retailers = retailersRes.data || [];
    const dueSum = retailers.reduce((sum, r) => sum + Number(r.current_due || 0), 0);
    setTotalMarketDue(dueSum);

    // 4. Low-Stock Products (< 50 units)
    const products = productsRes.data || [];
    const lowStock = products
      .filter((p) => p.stock_qty < 50)
      .sort((a, b) => a.stock_qty - b.stock_qty);
    setLowStockItems(lowStock);

    // 5. Top-Selling Products
    const items = itemsRes.data || [];
    const prodMap: Record<string, { units: number; revenue: number }> = {};
    items.forEach((item: any) => {
      if (!prodMap[item.product_name]) {
        prodMap[item.product_name] = { units: 0, revenue: 0 };
      }
      prodMap[item.product_name].units += Number(item.quantity || 0);
      prodMap[item.product_name].revenue += Number(item.subtotal || 0);
    });
    const sortedProds = Object.entries(prodMap)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    setTopProducts(sortedProds);

    setLoadingStats(false);
  };

  useEffect(() => {
    fetchDashboardMetrics();
  }, [activeDistributor]);

  // Send Daily Owner Digest via WhatsApp
  const handleSendOwnerSummary = () => {
    const phone = activeDistributor?.phone?.replace(/\D/g, '') || '';
    const formattedPhone = phone.length === 10 ? `91${phone}` : phone;

    const summary = `*${activeDistributor?.company_name} — Daily Business Summary*%0A%0A• *Total Sales Booked:* ₹${totalRevenue.toLocaleString('en-IN')}%0A• *Pending Dispatches:* ${pendingDispatchCount} Orders%0A• *Total Market Udhaar:* ₹${totalMarketDue.toLocaleString('en-IN')}%0A• *Low-Stock SKUs:* ${lowStockItems.length} Items%0A%0A_Generated via DistroOS_`;

    const url = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${summary}`
      : `https://wa.me/?text=${summary}`;
    window.open(url, '_blank');
  };

  if (distLoading || loadingStats) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Loading Owner Command Center...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome & Owner Digest Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Owner Command Center • {activeDistributor?.city}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            {activeDistributor?.company_name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live order flow, godown stock health, and market credit overview
          </p>
        </div>

        <button
          onClick={handleSendOwnerSummary}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-sm transition self-start"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp Daily Report
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Orders Value</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-3">
            ₹{totalRevenue.toLocaleString('en-IN')}
          </div>
          <Link
            href="/order"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 mt-2 hover:underline"
          >
            New Order <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Pending Dispatch</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-3">
            {pendingDispatchCount} Orders
          </div>
          <Link
            href="/dispatch"
            className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 mt-2 hover:underline"
          >
            Open Dispatch Board <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Market Udhaar Due</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-3">
            ₹{totalMarketDue.toLocaleString('en-IN')}
          </div>
          <Link
            href="/khata"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 mt-2 hover:underline"
          >
            Collect Dues <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Low-Stock Alerts</span>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-red-600 mt-3">
            {lowStockItems.length} SKUs
          </div>
          <span className="text-xs text-slate-500 mt-2 block">
            Items below 50 units in godown
          </span>
        </div>
      </div>

      {/* Charts & Leaderboards */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Area-Wise Sales Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Area-Wise Sales Performance ({activeDistributor?.city})
              </h2>
              <p className="text-xs text-slate-500">
                Revenue distribution across delivery beats & localities
              </p>
            </div>
          </div>

          {areaSales.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              Place orders in the Retailer Portal to populate area sales charts.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={areaSales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="area" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Sales']}
                    contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Low-Stock Reorder Watchlist */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Package className="w-4 h-4 text-red-600" />
            Godown Reorder Watchlist
          </h2>

          {lowStockItems.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              All SKUs are well stocked above 50 units.
            </p>
          ) : (
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-red-50/50 border border-red-100 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800">{item.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">{item.sku_code}</div>
                  </div>
                  <span className="text-xs font-extrabold text-red-700 bg-red-100 px-2.5 py-1 rounded-lg whitespace-nowrap">
                    {item.stock_qty} {item.unit} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top-Selling Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-4">Top-Moving Products</h2>
        {topProducts.length === 0 ? (
          <p className="text-xs text-slate-400">No product movement recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                  <th className="pb-3">Product Name</th>
                  <th className="pb-3 text-right">Units Sold</th>
                  <th className="pb-3 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.map((prod, idx) => (
                  <tr key={idx}>
                    <td className="py-3 font-medium text-slate-800">{prod.name}</td>
                    <td className="py-3 text-right font-semibold text-slate-700">
                      {prod.units}
                    </td>
                    <td className="py-3 text-right font-bold text-blue-700">
                      ₹{prod.revenue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}