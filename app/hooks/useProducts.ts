import { useEffect, useState, useCallback, useRef } from 'react';

export function useProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const shouldRefetchRef = useRef(false);

  const fetchProducts = useCallback(async () => {
    try {
      console.log('[useProducts] Fetching products...');
      const res = await fetch('/api/products', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      console.log('[useProducts] Produits récupérés:', data.length);
      setProducts(data);
      setIsLoading(false);
      setIsError(false);
      shouldRefetchRef.current = false;
    } catch (error) {
      console.error('[useProducts] Erreur:', error);
      setIsError(true);
      setIsLoading(false);
    }
  }, []);

  // Fetch initial
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Polling toutes les secondes pour vérifier si on doit refetch
  useEffect(() => {
    const interval = setInterval(() => {
      if (shouldRefetchRef.current) {
        console.log('[useProducts] Polling détecte un refetch nécessaire !');
        fetchProducts();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchProducts]);

  // Écouter les événements temps réel
  useEffect(() => {
    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type } = customEvent.detail;
      console.log('[useProducts] Événement reçu:', type);

      if (type === "product_created" || type === "product_deleted") {
        console.log('[useProducts] Marquage pour refetch !');
        shouldRefetchRef.current = true;
      }
    };

    window.addEventListener("cart-update", handleRealtimeUpdate);
    return () => window.removeEventListener("cart-update", handleRealtimeUpdate);
  }, []);

  return {
    products,
    isLoading,
    isError,
    mutate: fetchProducts,
  };
}

export function useProduct(id: string | null) {
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!id) {
      setProduct(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/product/${id}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      setProduct(data.product);
      setIsLoading(false);
      setIsError(false);
    } catch (error) {
      console.error('[useProduct] Erreur:', error);
      setIsError(true);
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  return {
    product,
    isLoading,
    isError,
    mutate: fetchProduct,
  };
}
