'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  ShoppingCart,
  Truck,
  BookOpen,
  Building2,
  Plus,
  X,
} from 'lucide-react';
import { useDistributor } from '@/context/DistributorContext';
import { supabase } from '@/lib/supabase';

const navItems = [
  { name: 'Owner Dashboard', href: '/', icon: LayoutDashboard },
  { name: '1-Click Data Import', href: '/import', icon: Upload },
  { name: 'Retailer Order Portal', href: '/order', icon: ShoppingCart },
  { name: 'Dispatch & Billing', href: '/dispatch', icon: Truck },
  { name: 'Khata & Payments', href: '/khata', icon: BookOpen },
];

export default function Navbar() {
  const pathname = usePathname();
  const {
    distributors,
    activeDistributor,
    setActiveDistributorId,
    refreshDistributors,
  } = useDistributor();

  const [showModal, setShowModal] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [city, setCity] = useState('Jaipur');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('distributors')
      .insert([
        {
          company_name: companyName.trim(),
          owner_name: ownerName.trim(),
          city: city.trim() || 'Jaipur',
          phone: phone.trim(),
        },
      ])
      .select()
      .single();

    setSaving(false);
    if (!error && data) {
      await refreshDistributors();
      setActiveDistributorId(data.id);
      setCompanyName('');
      setOwnerName('');
      setPhone('');
      setShowModal(false);
    } else {
      alert('Error creating distributor: ' + error?.message);
    }
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white font-bold px-2.5 py-1 rounded-lg text-sm">
              DistroOS
            </div>
            <span className="hidden md:inline text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Jaipur Edition
            </span>
          </div>

          {/* Workspace Switcher */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={activeDistributor?.id || ''}
              onChange={(e) => setActiveDistributorId(e.target.value)}
              className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[220px] sm:max-w-xs"
            >
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.company_name} ({d.city})
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg transition"
              title="Add a new distributor client"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Client</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-slate-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Modal to Add New Distributor */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Onboard New Distributor
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateDistributor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Agency / Firm Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mahaveer Agencies"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Owner Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Suresh Jain"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="98290XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {saving ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}