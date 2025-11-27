import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useOrders(status: 'pending' | 'history') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/order?status=${status}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30 secondes pour les commandes (plus dynamique)
    }
  );

  return {
    orders: data?.orders || [],
    isLoading,
    isError: error,
    mutate, // Pour forcer un refresh si nécessaire
  };
}

export function useUserOrders(orderView: 'pending' | 'history') {
  const statuses = orderView === "pending"
    ? "paid,preparing,ready,in_transit,out_for_delivery,return_requested"
    : "delivered,cancelled,returned";

  const { data, error, isLoading, mutate } = useSWR(
    `/api/order/user?statuses=${statuses}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
    }
  );

  return {
    orders: data?.orders || [],
    isLoading,
    isError: error,
    mutate,
  };
}
