import { useState, useEffect, useCallback } from 'react';
import { Product, Category, productsApi, categoriesApi } from '../lib/api';
import { localDb } from '../lib/db';
import { socketManager } from '../lib/socket';
import { useOnlineStatus } from './useOnlineStatus';

interface UseProductsReturn {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  selectedCategory: string | null;
  setSelectedCategory: (categoryId: string | null) => void;
  getProductsByCategory: (categoryId: string) => Product[];
  refreshProducts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isOnline } = useOnlineStatus();

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      if (isOnline) {
        const response = await categoriesApi.getAll();
        if (response.data.success && response.data.data) {
          setCategories(response.data.data);
          // Cache for offline use
          await localDb.cacheCategories(response.data.data);
        }
      } else {
        // Load from local cache
        const cached = await localDb.getCachedCategories();
        setCategories(cached);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      // Try to load from cache on error
      const cached = await localDb.getCachedCategories();
      if (cached.length > 0) {
        setCategories(cached);
      } else {
        setError('Error al cargar categorías');
      }
    }
  }, [isOnline]);

  // Load products
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (isOnline) {
        const response = await productsApi.getAll();
        if (response.data.success && response.data.data) {
          setProducts(response.data.data);
          // Cache for offline use
          await localDb.cacheProducts(response.data.data);
        }
      } else {
        // Load from local cache
        const cached = await localDb.getCachedProducts();
        setProducts(cached);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      // Try to load from cache on error
      const cached = await localDb.getCachedProducts();
      if (cached.length > 0) {
        setProducts(cached);
      } else {
        setError('Error al cargar productos');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  // Initial load
  useEffect(() => {
    loadCategories();
    loadProducts();
  }, [loadCategories, loadProducts]);

  // Socket listeners for real-time updates
  useEffect(() => {
    const unsubscribeProductUpdate = socketManager.on('product:updated', async () => {
      await loadProducts();
    });

    const unsubscribeProductDelete = socketManager.on('product:deleted', async () => {
      await loadProducts();
    });

    const unsubscribeCategoryUpdate = socketManager.on('category:updated', async () => {
      await loadCategories();
    });

    const unsubscribeCategoryDelete = socketManager.on('category:deleted', async () => {
      await loadCategories();
    });

    return () => {
      unsubscribeProductUpdate();
      unsubscribeProductDelete();
      unsubscribeCategoryUpdate();
      unsubscribeCategoryDelete();
    };
  }, [loadProducts, loadCategories]);

  // Get products filtered by category
  const getProductsByCategory = useCallback(
    (categoryId: string): Product[] => {
      return products.filter((p) => p.categoryId === categoryId);
    },
    [products]
  );

  // Refresh functions
  const refreshProducts = useCallback(async () => {
    await loadProducts();
  }, [loadProducts]);

  const refreshCategories = useCallback(async () => {
    await loadCategories();
  }, [loadCategories]);

  return {
    products,
    categories,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    getProductsByCategory,
    refreshProducts,
    refreshCategories,
  };
}
