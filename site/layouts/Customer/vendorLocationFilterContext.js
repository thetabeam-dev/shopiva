"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const VendorLocationFilterContext = createContext(null);

export function VendorLocationFilterProvider({ children }) {
  const [filter, setFilterState] = useState(null);
  const setFilter = useMemo(() => setFilterState, []);
  const value = useMemo(() => ({ filter, setFilter }), [filter, setFilter]);

  return (
    <VendorLocationFilterContext.Provider value={value}>
      {children}
    </VendorLocationFilterContext.Provider>
  );
}

export function useVendorLocationFilter() {
  return useContext(VendorLocationFilterContext)?.filter ?? null;
}

export function useRegisterVendorLocationFilter(filter) {
  const setFilter = useContext(VendorLocationFilterContext)?.setFilter;

  useEffect(() => {
    if (!setFilter) return;
    setFilter(filter);
  }, [setFilter, filter]);

  useEffect(() => {
    if (!setFilter) return undefined;
    return () => setFilter(null);
  }, [setFilter]);
}
