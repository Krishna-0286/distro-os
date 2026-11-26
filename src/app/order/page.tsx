'use client';

import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  ShoppingBag,
  RotateCcw,
  CheckCircle2,
  Tag,
  Store,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDistributor } from '@/context/DistributorContext';

interface Product {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  unit: string;
  rate: number;
  scheme_text: string;
  stock_qty: number;
}

interface Retailer {
  id: string;
  shop_name: string;
  owner_name: string;
  area: string;
  current_due: number;
  credit_limit: number;
}

export default function RetailerOrderPortal() {
  const { activeDistributor } = useDistributor();

  const [products, setProducts] = useState<Product[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [loadingRepeat, setLoadingRepeat] = useState(false);

  const loadCatalogAndRetailers = async () => {
    if (!activeDistributor) return;
    const [prodRes, retRes] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('distributor_id', activeDistributor.id)
        .order('name', { ascending: true }),
      supabase
        .from('retailers')
        .select('*')
        .eq('distributor_id', activeDistributor.id)
        .order('shop_name', { ascending: true }),
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (retRes.data) {
      setRetailers(retRes.data);
      if (retRes.data.length > 0 && !selectedRetailerId) {
        setSelectedRetailerId(retRes.data[0].id);
      }
    }
  };

  useEffect(() => {
    setCart({});
    setSelectedRetailerId('');
    loadCatalogAndRetailers();
  }, [activeDistributor]);

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku_code && p.sku_code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev };
      if (next === 0) {
        delete updated[productId];
      } else {
        updated[productId] = next;
      }
      return updated;
    });
  };

  // Repeat Last Order feature for quick kirana reorders
  const handleRepeatLastOrder = async () => {
    if (!selectedRetailerId || !activeDistributor) return;
    setLoadingRepeat(true);

    const { data: lastOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('distributor_id', activeDistributor.id)
      .eq('retailer_id', selectedRetailerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastOrder) {
      alert('No previous orders found for this store yet.');
      setLoadingRepeat(false);
      return;
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', lastOrder.id);

    if (items && items.length > 0) {
      const restoredCart: Record<string, number> = {};
      items.forEach((item) => {
        if (item.product_id) {
          restoredCart[item.product_id] = item.quantity;
        }
      });
      setCart(restoredCart);
    }
    setLoadingRepeat(false);
  };

  const cartItems = Object.entries(cart)
    .map(([productId, qty]) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;
      return {
        product,
        qty,
        subtotal: product.rate * qty,
      };
    })
    .filter(Boolean) as { product: Product; qty: number; subtotal: number }[];

  const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalBoxes = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const selectedRetailer = retailers.find((r) => r.id === selectedRetailerId);

  const handlePlaceOrder = async () => {
    if (!activeDistributor || !selectedRetailer || cartItems.length === 0) return;
    setSubmitting(true);
    setOrderSuccess(null);

    // 1. Create Order record
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([
        {
          distributor_id: activeDistributor.id,
          retailer_id: selectedRetailer.id,
          total_amount: totalAmount,
          status: 'New',
          payment_status: 'Unpaid',
          notes: notes.trim(),
        },
      ])
      .select()
      .single();

    if (orderErr || !newOrder) {
      alert('Failed to place order: ' + orderErr?.message);
      setSubmitting(false);
      return;
    }

    // 2. Insert Order Line Items
    const lineItemsPayload = cartItems.map((item) => ({
      order_id: newOrder.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.qty,
      unit_price: item.product.rate,
      subtotal: item.subtotal,
    }));

    await supabase.from('order_items').insert(lineItemsPayload);

    // 3. Update Retailer Khata (current_due) & Deduct Product Stock
    const updatedDue = Number(selectedRetailer.current_due || 0) + totalAmount;
    await supabase
      .from('retailers')
      .update({ current_due: updatedDue })
      .eq('id', selectedRetailer.id);

    for (const item of cartItems) {
      const newStock = Math.max(0, item.product.stock_qty - item.qty);
      await supabase
        .from('products')
        .update({ stock_qty: newStock })
        .eq('id', item.product.id);
    }

    setSubmitting(false);
    setCart({});
    setNotes('');
    setOrderSuccess(
      `Order #${newOrder.order_number} placed for ${selectedRetailer.shop_name} (₹${totalAmount.toLocaleString('en-IN')})!`
    );
    loadCatalogAndRetailers();
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6 pb-20">
      {/* Left 2 Columns: Store Selector & Product Catalog */}
      <div className="lg:col-span-2 space-y-4">
        {/* Store Selection Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-blue-600" />
              Ordering Party (Kirana Store)
            </label>
            <button
              onClick={handleRepeatLastOrder}
              disabled={loadingRepeat || !selectedRetailerId}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition self-start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {loadingRepeat ? 'Fetching...' : 'Repeat Last Order'}
            </button>
          </div>

          <select
            value={selectedRetailerId}
            onChange={(e) => setSelectedRetailerId(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.shop_name} — {r.area} (Due: ₹{Number(r.current_due).toLocaleString('en-IN')})
              </option>
            ))}
          </select>

          {selectedRetailer && Number(selectedRetailer.current_due) > Number(selectedRetailer.credit_limit) * 0.8 && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Credit Alert: Store is near its ₹{Number(selectedRetailer.credit_limit).toLocaleString('en-IN')} credit limit.
            </div>
          )}
        </div>

        {/* Success Notification */}
        {orderSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            {orderSuccess}
          </div>
        )}

        {/* Search & Category Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search Parle, Maggi, Atta, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product List */}
        <div className="space-y-2.5">
          {filteredProducts.map((product) => {
            const qty = cart[product.id] || 0;
            return (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {product.sku_code || 'SKU'}
                    </span>
                    <span className="text-xs text-slate-500">{product.category}</span>
                    <span className="text-xs text-slate-400">• Stock: {product.stock_qty}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-blue-700">
                      ₹{Number(product.rate).toLocaleString('en-IN')} / {product.unit}
                    </span>
                    {product.scheme_text && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                        <Tag className="w-3 h-3" />
                        {product.scheme_text}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Stepper */}
                <div className="flex items-center gap-2 shrink-0">
                  {qty === 0 ? (
                    <button
                      onClick={() => updateQty(product.id, 1)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
                    >
                      + Add
                    </button>
                  ) : (
                    <div className="flex items-center border border-blue-600 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQty(product.id, -1)}
                        className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 py-1 text-sm font-bold text-slate-900">
                        {qty}
                      </span>
                      <button
                        onClick={() => updateQty(product.id, 1)}
                        className="px-2.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Live Order Cart Summary */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm sticky top-36 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              Current Order Cart
            </h2>
            <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
              {totalBoxes} Units
            </span>
          </div>

          {cartItems.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              Tap "+ Add" on products to build an order.
            </p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {cartItems.map(({ product, qty, subtotal }) => (
                <div key={product.id} className="flex items-start justify-between text-sm gap-2">
                  <div>
                    <div className="font-medium text-slate-800">{product.name}</div>
                    <div className="text-xs text-slate-500">
                      {qty} × ₹{product.rate}
                    </div>
                  </div>
                  <div className="font-bold text-slate-900">
                    ₹{subtotal.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Delivery / Dispatch Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Send in evening tempo"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
            />
          </div>

          <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Order Total</span>
            <span className="text-xl font-extrabold text-slate-900">
              ₹{totalAmount.toLocaleString('en-IN')}
            </span>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={submitting || cartItems.length === 0 || !selectedRetailerId}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl shadow-sm transition"
          >
            {submitting ? 'Submitting Order...' : 'Confirm & Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}