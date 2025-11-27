import { useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useProducts() {
  const { data, error, isLoading, mutate } = useSWR('/api/products', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // Ne pas refaire la même requête pendant 60 secondes
  });

  // Écouter les événements temps réel
  useEffect(() => {
    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type } = customEvent.detail;

      if (type === "product_created" || type === "product_deleted") {
        // Force la revalidation pour récupérer les nouveaux produits
        mutate(undefined, { revalidate: true });
      }
    };

    window.addEventListener("cart-update", handleRealtimeUpdate);
    return () => window.removeEventListener("cart-update", handleRealtimeUpdate);
  }, [mutate]);

  return {
    products: data || [],
    isLoading,
    isError: error,
    mutate, // Pour forcer un refresh si nécessaire
  };
}

export function useProduct(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/product/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    }
  );

  return {
    product: data?.product || null,
    isLoading,
    isError: error,
    mutate,
  };
}
