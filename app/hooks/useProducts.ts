import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useProducts() {
  const { data, error, isLoading, mutate } = useSWR('/api/products', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // Ne pas refaire la même requête pendant 60 secondes
  });

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
