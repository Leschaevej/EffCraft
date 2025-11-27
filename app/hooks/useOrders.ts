import { useEffect, useRef } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useOrders(status: 'pending' | 'history') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/order?status=${status}`,
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

      if (type === "order_created" || type === "order_deleted" || type === "order_status_updated") {
        await mutateRef.current();
      }
    };

    window.addEventListener("cart-update", handleRealtimeUpdate);
    return () => window.removeEventListener("cart-update", handleRealtimeUpdate);
  }, []);

  return {
    orders: data?.orders || [],
    isLoading,
    isError: error,
    mutate,
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
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 0,
    }
  );

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  // Écouter les événements temps réel
  useEffect(() => {
    const handleRealtimeUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type } = customEvent.detail;

      if (type === "order_created" || type === "order_deleted" || type === "order_status_updated") {
        await mutateRef.current();
      }
    };

    window.addEventListener("cart-update", handleRealtimeUpdate);
    return () => window.removeEventListener("cart-update", handleRealtimeUpdate);
  }, []);

  return {
    orders: data?.orders || [],
    isLoading,
    isError: error,
    mutate,
  };
}
