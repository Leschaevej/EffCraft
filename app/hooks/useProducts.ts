import { useEffect, useRef } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useProducts() {
  const { data, error, isLoading, mutate } = useSWR('/api/products', fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 0, // CRITIQUE: 0 pour permettre les refetch immédiats
  });

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  // Écouter les événements temps réel
  useEffect(() => {
    const handleRealtimeUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type } = customEvent.detail;

      if (type === "product_created" || type === "product_deleted") {
        // Force SWR à refetch avec revalidate
        await mutateRef.current();
      }
    };

    window.addEventListener("cart-update", handleRealtimeUpdate);
    return () => window.removeEventListener("cart-update", handleRealtimeUpdate);
  }, []);

  return {
    products: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useProduct(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/product/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 0,
    }
  );

  return {
    product: data?.product || null,
    isLoading,
    isError: error,
    mutate,
  };
}
