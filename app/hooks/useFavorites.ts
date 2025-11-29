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
      dedupingInterval: 0,
    }
  );

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  // Écouter les événements temps réel pour revalider les données
  useEffect(() => {
    const handleFavoriteUpdate = async () => {
      // Simple refetch sans mise à jour optimiste
      await mutateRef.current();
    };

    window.addEventListener("cart-update", handleFavoriteUpdate);
    window.addEventListener("removed", handleFavoriteUpdate);
    window.addEventListener("favorite-added", handleFavoriteUpdate);
    return () => {
      window.removeEventListener("cart-update", handleFavoriteUpdate);
      window.removeEventListener("removed", handleFavoriteUpdate);
      window.removeEventListener("favorite-added", handleFavoriteUpdate);
    };
  }, []);

  return {
    favorites: data?.favorites || [],
    isLoading: status !== 'authenticated' || isLoading,
    isError: error,
    mutate,
  };
}
