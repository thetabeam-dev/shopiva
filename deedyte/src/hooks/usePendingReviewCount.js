import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchBuyerProductPendingReviews } from '../api/buyer';

let count = 0;
/** @type {Set<() => void>} */
const listeners = new Set();

function publish() {
  listeners.forEach((listener) => listener());
}

export async function refreshPendingReviewCount(activeRole) {
  if (activeRole !== 'customer') {
    count = 0;
    publish();
    return;
  }
  try {
    const data = await fetchBuyerProductPendingReviews();
    count = Array.isArray(data) ? data.length : 0;
  } catch {
    count = 0;
  }
  publish();
}

export function usePendingReviewCount() {
  const { activeRole } = useAuth();
  const [value, setValue] = useState(activeRole === 'customer' ? count : 0);

  useEffect(() => {
    const sync = () => setValue(activeRole === 'customer' ? count : 0);
    listeners.add(sync);
    refreshPendingReviewCount(activeRole).catch(() => {});
    return () => {
      listeners.delete(sync);
    };
  }, [activeRole]);

  return value;
}
