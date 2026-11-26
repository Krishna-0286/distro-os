'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, DEMO_DISTRIBUTOR_ID } from '@/lib/supabase';

export interface Distributor {
  id: string;
  company_name: string;
  owner_name: string;
  city: string;
  gst_number: string;
  phone: string;
}

interface DistributorContextType {
  distributors: Distributor[];
  activeDistributor: Distributor | null;
  setActiveDistributorId: (id: string) => void;
  refreshDistributors: () => Promise<void>;
  loading: boolean;
}

const DistributorContext = createContext<DistributorContextType>({
  distributors: [],
  activeDistributor: null,
  setActiveDistributorId: () => {},
  refreshDistributors: async () => {},
  loading: true,
});

export function DistributorProvider({ children }: { children: React.ReactNode }) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [activeId, setActiveId] = useState<string>(DEMO_DISTRIBUTOR_ID);
  const [loading, setLoading] = useState(true);

  const fetchDistributors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      setDistributors(data);
      const exists = data.find((d) => d.id === activeId);
      if (!exists) {
        setActiveId(data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDistributors();
  }, []);

  const activeDistributor =
    distributors.find((d) => d.id === activeId) || distributors[0] || null;

  return (
    <DistributorContext.Provider
      value={{
        distributors,
        activeDistributor,
        setActiveDistributorId: setActiveId,
        refreshDistributors: fetchDistributors,
        loading,
      }}
    >
      {children}
    </DistributorContext.Provider>
  );
}

export const useDistributor = () => useContext(DistributorContext);