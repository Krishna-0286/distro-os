'use client';

import React, { useEffect, useState } from 'react';
import {
  IndianRupee,
  Search,
  MessageCircle,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  History,
  X,
  MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDistributor } from '@/context/DistributorContext';

interface Retailer {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  area: string;
  credit_limit: number;
  current_due: number;
}

interface PaymentRecord {
  id: string;
  amount: number;
  mode: string;
  reference_note: string;
  created_at: string;
  retailers: {
    shop_name: string;
    area: string;
  } | null;
}

export default function KhataLedgerPage() {
  const { activeDistributor } = useDistributor();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Payment Modal State
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [referenceNote, setReferenceNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadKhataData = async () => {
    if (!activeDistributor) return;
    setLoading(true);

    const [retRes, payRes] = await Promise.all([
      supabase
        .from('retailers')
        .select('*')
        .eq('distributor_id', activeDistributor.id)
        .order('current_due', { ascending: false }),
      supabase
        .from('payments')
        .select('*, retailers(shop_name, area)')
        .eq('distributor_id', activeDistributor.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (retRes.data) setRetailers(retRes.data);
    if (payRes.data) setPayments(payRes.data as unknown as PaymentRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    loadKhataData();
  }, [activeDistributor]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDistributor || !selectedRetailer) return;

    const paidAmount = parseFloat(amount);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    setSaving(true);

    // 1. Insert payment entry
    const { error: payErr } = await supabase.from('payments').insert([
      {
        distributor_id: activeDistributor.id,
        retailer_id: selectedRetailer.id,
        amount: paidAmount,
        mode,
        reference_note: referenceNote.trim(),
      },
    ]);

    if (payErr) {
      alert('Error recording payment: ' + payErr.message);
      setSaving(false);
      return;
    }

    // 2. Reduce retailer's current_due balance
    const newBalance = Math.max(0, Number(selectedRetailer.current_due) - paidAmount);
    await supabase
      .from('retailers')
      .update({ current_due: newBalance })
      .eq('id', selectedRetailer.id);

    setSaving(false);
    setSelectedRetailer(null);
    setAmount('');
    setReferenceNote('');
    loadKhataData();
  };

  // Pre-filled WhatsApp Payment Reminder
  const handleSendPaymentReminder = (retailer: Retailer) => {
    const phone = retailer.phone?.replace(/\D/g, '') || '';
    const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
    const dueFormatted = Number(retailer.current_due).toLocaleString('en-IN');

    const msg = `Namaste ${retailer.owner_name || retailer.shop_name},%0A%0AThis is a gentle payment reminder from *${activeDistributor?.company_name}*.%0A%0AYour current outstanding balance is *₹${dueFormatted}*. Kindly clear the dues via UPI/Cash at your earliest convenience.%0A%0AThank you!`;

    const url = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  };

  const totalOutstanding = retailers.reduce((sum, r) => sum + Number(r.current_due || 0), 0);
  const highRiskCount = retailers.filter(
    (r) => Number(r.current_due) >= Number(r.credit_limit) * 0.8 && Number(r.current_due) > 0
  ).length;

  const filteredRetailers = retailers.filter(
    (r) =>
      r.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.owner_name && r.owner_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Summary Strip */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Market Credit (Udhaar)
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              ₹{totalOutstanding.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Across {retailers.filter((r) => Number(r.current_due) > 0).length} active accounts
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              High Credit Alert Accounts
            </div>
            <div className="text-2xl font-extrabold text-red-600 mt-1">
              {highRiskCount} Stores
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Exceeded 80% of assigned credit limit
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Party Ledger Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">Retailer Khata Balances</h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search shop or Jaipur area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-500 text-sm">Loading Khata ledger...</div>
          ) : (
            <div className="space-y-3">
              {filteredRetailers.map((retailer) => {
                const due = Number(retailer.current_due || 0);
                const limit = Number(retailer.credit_limit || 50000);
                const ratio = Math.min(100, Math.round((due / limit) * 100));
                const isOverLimit = due >= limit * 0.8 && due > 0;

                return (
                  <div
                    key={retailer.id}
                    className={`bg-white rounded-2xl border p-4 shadow-sm transition ${
                      isOverLimit ? 'border-red-200 bg-red-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900">{retailer.shop_name}</h3>
                          {isOverLimit && (
                            <span className="text-[11px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              Credit Limit Alert
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{retailer.owner_name}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {retailer.area}
                          </span>
                          <span>•</span>
                          <span>{retailer.phone}</span>
                        </div>

                        {/* Credit Limit Progress Bar */}
                        <div className="pt-2 max-w-xs">
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>Limit Used: {ratio}%</span>
                            <span>Max: ₹{limit.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isOverLimit ? 'bg-red-500' : 'bg-blue-600'
                              }`}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                        <div className="text-left sm:text-right">
                          <div className="text-[11px] text-slate-400">Pending Due</div>
                          <div
                            className={`text-lg font-extrabold ${
                              due > 0 ? 'text-slate-900' : 'text-emerald-600'
                            }`}
                          >
                            ₹{due.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {due > 0 && (
                            <button
                              onClick={() => handleSendPaymentReminder(retailer)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition"
                              title="Send WhatsApp Reminder"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              Remind
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedRetailer(retailer);
                              setAmount(due > 0 ? String(due) : '');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Collect
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Recent Payment Collections */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <History className="w-4 h-4 text-emerald-600" />
              Recent Collections
            </h2>

            {payments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                No payments logged yet. Click "Collect" on any store to log a payment.
              </p>
            ) : (
              <div className="space-y-3">
                {payments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {pay.retailers?.shop_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {pay.mode} • {new Date(pay.created_at).toLocaleDateString('en-IN')}
                      </div>
                      {pay.reference_note && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {pay.reference_note}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-extrabold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      +₹{Number(pay.amount).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {selectedRetailer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Record Payment Received</h2>
                <p className="text-xs text-slate-500">{selectedRetailer.shop_name}</p>
              </div>
              <button
                onClick={() => setSelectedRetailer(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount Collected (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 bg-white"
                >
                  <option value="UPI">UPI / QR Scan</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="NEFT">Bank Transfer (NEFT/RTGS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / Salesman Note
                </label>
                <input
                  type="text"
                  placeholder="e.g., Collected by Ramesh / UPI Ref #4412"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRetailer(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                >
                  {saving ? 'Saving...' : 'Confirm & Update Khata'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}