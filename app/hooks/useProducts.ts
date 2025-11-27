import { useEffect, useRef } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useProducts() {
  const { data, error, isLoading, mutate } = useSWR('/api/products', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // Ne pas refaire la même requête pendant 60 secondes
  });

  // Utiliser une ref pour avoir toujours la dernière version de mutate
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  // Écouter les événements temps réel
  useEffect(() => {
    const handleRealtimeUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type } = customEvent.detail;

      console.log('[useProducts] Événement reçu:', type);

      if (type === "product_created" || type === "product_deleted") {
        console.log('[useProducts] Fetch immédiat des produits...');
        // Fetch direct qui bypass complètement le cache et le dedupingInterval
        try {
          const freshData = await fetch('/api/products', {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          }).then(res => res.json());
          console.log('[useProducts] Nouvelles données reçues:', freshData.length, 'produits');
          // Met à jour le cache SWR avec les nouvelles données
          mutateRef.current(freshData, false);
        } catch (error) {
          console.error('[useProducts] Erreur lors du fetch:', error);
        }
      }
    };

    console.log('[useProducts] Hook monté, écoute des événements cart-update');
    window.addEventListener("cart-update", handleRealtimeUpdate);
    return () => {
      console.log('[useProducts] Hook démonté');
      window.removeEventListener("cart-update", handleRealtimeUpdate);
    };
  }, []); // Pas de dépendances pour éviter les re-souscriptions

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
