'use client';

import React, { useEffect, useState } from 'react';
import {
  Truck,
  PackageCheck,
  Clock,
  CheckCircle2,
  Printer,
  MessageCircle,
  Download,
  ArrowRight,
  MapPin,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDistributor } from '@/context/DistributorContext';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: string;
  order_number: number;
  total_amount: number;
  status: 'New' | 'Packed' | 'Dispatched' | 'Delivered';
  payment_status: string;
  notes: string;
  created_at: string;
  retailers: {
    shop_name: string;
    owner_name: string;
    phone: string;
    area: string;
  } | null;
  order_items: OrderItem[];
}

const STATUS_TABS = ['All', 'New', 'Packed', 'Dispatched', 'Delivered'] as const;

const NEXT_STATUS: Record<string, 'Packed' | 'Dispatched' | 'Delivered' | null> = {
  New: 'Packed',
  Packed: 'Dispatched',
  Dispatched: 'Delivered',
  Delivered: null,
};

export default function DispatchBoardPage() {
  const { activeDistributor } = useDistributor();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [slipOrder, setSlipOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    if (!activeDistributor) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        retailers (shop_name, owner_name, phone, area),
        order_items (id, product_name, quantity, unit_price, subtotal)
      `)
      .eq('distributor_id', activeDistributor.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as unknown as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [activeDistributor]);

  const handleAdvanceStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;

    const { error } = await supabase
      .from('orders')
      .update({ status: next })
      .eq('id', order.id);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: next } : o))
      );
    }
  };

  // Pre-filled WhatsApp Status Notification
  const handleWhatsAppShare = (order: Order) => {
    const phone = order.retailers?.phone?.replace(/\D/g, '') || '';
    const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
    const itemSummary = order.order_items
      .map((i) => `• ${i.product_name} × ${i.quantity}`)
      .join('%0A');

    const message = `Namaste ${order.retailers?.owner_name || order.retailers?.shop_name},%0A%0AYour Order *%23${order.order_number}* from *${activeDistributor?.company_name}* is now *${order.status.toUpperCase()}*.%0A%0A*Items:*%0A${itemSummary}%0A%0A*Total Amount:* ₹${Number(order.total_amount).toLocaleString('en-IN')}%0A%0AThank you!`;

    const url = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  // Export Orders CSV for Tally / Excel
  const handleExportTallyCSV = () => {
    if (orders.length === 0) return;
    const headers = ['Order_No,Date,Party_Name,Area,Status,Total_Amount,Notes'];
    const rows = orders.map((o) => {
      const dateStr = new Date(o.created_at).toLocaleDateString('en-IN');
      const party = `"${o.retailers?.shop_name || 'Walk-in'}"`;
      const area = `"${o.retailers?.area || ''}"`;
      const notes = `"${o.notes || ''}"`;
      return `${o.order_number},${dateStr},${party},${area},${o.status},${o.total_amount},${notes}`;
    });

    const blob = new Blob([headers.concat(rows).join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Tally_Sales_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredOrders =
    activeTab === 'All' ? orders : orders.filter((o) => o.status === activeTab);

  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'New':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Packed':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Dispatched':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tally Export */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Order Processing & Dispatch Board
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Move orders from godown packing to tempo dispatch in one click
          </p>
        </div>

        <button
          onClick={handleExportTallyCSV}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition self-start"
        >
          <Download className="w-4 h-4" />
          Export CSV for Tally
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const count =
            tab === 'All'
              ? orders.length
              : orders.filter((o) => o.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition ${
                activeTab === tab
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab}
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] ${
                  activeTab === tab
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
          No orders in "{activeTab}" stage. Place an order from the Retailer Order Portal to see it here!
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const nextStatus = NEXT_STATUS[order.status];
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Row: Order # & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-blue-600">
                          #{order.order_number}
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getBadgeStyle(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mt-1">
                        {order.retailers?.shop_name || 'Retail Store'}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {order.retailers?.area || 'Jaipur'}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(order.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">Bill Value</div>
                      <div className="text-lg font-extrabold text-slate-900">
                        ₹{Number(order.total_amount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Line Items Summary */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                    {order.order_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs text-slate-700"
                      >
                        <span className="truncate pr-2">{item.product_name}</span>
                        <span className="font-bold whitespace-nowrap">
                          × {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                      Note: {order.notes}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSlipOrder(order)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Packing Slip
                    </button>
                    <button
                      onClick={() => handleWhatsAppShare(order)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-lg transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                  </div>

                  {nextStatus ? (
                    <button
                      onClick={() => handleAdvanceStatus(order)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg transition"
                    >
                      Mark {nextStatus}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      Completed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Printable Godown Packing Slip Modal */}
      {slipOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Godown Pick & Pack Slip
                </div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {activeDistributor?.company_name}
                </h2>
              </div>
              <button
                onClick={() => setSlipOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm space-y-1 bg-slate-50 p-3 rounded-xl">
              <div>
                <span className="text-slate-500">Order No:</span>{' '}
                <strong className="font-mono">#{slipOrder.order_number}</strong>
              </div>
              <div>
                <span className="text-slate-500">Party:</span>{' '}
                <strong>{slipOrder.retailers?.shop_name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Route / Area:</span>{' '}
                <strong>{slipOrder.retailers?.area}</strong>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Item Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slipOrder.order_items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 font-medium text-slate-800">{item.product_name}</td>
                    <td className="py-2 text-right font-bold">{item.quantity}</td>
                    <td className="py-2 text-right">₹{item.subtotal.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-200 pt-3 flex justify-between items-center font-bold text-base">
              <span>Total Collectible:</span>
              <span>₹{Number(slipOrder.total_amount).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSlipOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                <Printer className="w-4 h-4" />
                Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}