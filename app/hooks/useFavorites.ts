import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useFavorites() {
  const { status } = useSession();

  const { data, error, isLoading, mutate } = useSWR(
    status === 'authenticated' ? '/api/user?type=favorites' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 0, // CRITIQUE: 0 pour permettre les refetch immédiats
    }
  );

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  // Écouter les événements temps réel
  useEffect(() => {
    const handleRealtimeUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type } = customEvent.detail;

      if (type === "product_deleted" || type === "favorite_added" || type === "favorite_removed") {
        // Force SWR à refetch
        await mutateRef.current();
      }
    };

    window.addEventListener("cart-update", handleRealtimeUpdate);
    window.addEventListener("removed", handleRealtimeUpdate);
    return () => {
      window.removeEventListener("cart-update", handleRealtimeUpdate);
      window.removeEventListener("removed", handleRealtimeUpdate);
    };
  }, []);

  return {
    favorites: data?.favorites || [],
    isLoading: status !== 'authenticated' || isLoading,
    isError: error,
    mutate,
  };
}
