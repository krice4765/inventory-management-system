import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/products';
import type { ProductInsert, ProductUpdate, ProductWithSupplier } from '../api/products';

// --- Start: Keep existing query hooks ---
const PRODUCTS_KEY = ['products'] as const;
const SUPPLIERS_KEY = ['suppliers'] as const;

/**
 * 商品一覧を取得するクエリ
 */
export function useProducts() {
  return useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: api.getProducts,
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });
}

/**
 * 仕入先一覧を取得するクエリ
 */
export function useSuppliers() {
  return useQuery({
    queryKey: SUPPLIERS_KEY,
    queryFn: api.getSuppliers,
    staleTime: 10 * 60 * 1000, // 10分間キャッシュ
  });
}
// --- End: Keep existing query hooks ---


// --- Start: New mutation hooks from user ---
export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.createProduct,
    onMutate: async (newProduct: ProductInsert) => {
      // 進行中のクエリをキャンセル
      await queryClient.cancelQueries({ queryKey: ['products'] });
      
      // 現在のデータを保存（ロールバック用）
      const previousProducts = queryClient.getQueryData<ProductWithSupplier[]>(['products']);
      
      // 楽観的更新: 新商品を一時的に追加
      queryClient.setQueryData<ProductWithSupplier[]>(['products'], (old = []) => {
        const tempProduct: ProductWithSupplier = {
          id: `temp-${Date.now()}` as unknown as number, // 一時的なID
          product_code: newProduct.product_code,
          name: newProduct.name,
          description: newProduct.description,
          purchase_price: newProduct.purchase_price,
          sell_price: newProduct.sell_price,
          stock_quantity: newProduct.stock_quantity,
          safety_stock_quantity: newProduct.safety_stock_quantity,
          main_supplier_id: newProduct.main_supplier_id,
          image_url: newProduct.image_url,
          suppliers: undefined, // 後で正しい値に更新される
        };
        return [...old, tempProduct];
      });
      
      return { previousProducts };
    },
    onError: (_err, _newProduct, context) => {
      // エラー時は元のデータに戻す
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
    },
    onSettled: () => {
      // 成功・失敗に関わらずデータを再取得
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProductUpdate }) =>
      api.updateProduct(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      const previousProducts = queryClient.getQueryData<ProductWithSupplier[]>(['products']);
      
      // 楽観的更新: 該当商品を即座に更新
      queryClient.setQueryData<ProductWithSupplier[]>(['products'], (old = []) => {
        return old.map((product) =>
          product.id === id ? { ...product, ...payload } : product
        );
      });
      
      return { previousProducts };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.deleteProduct,
    onMutate: async (productId: number) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      const previousProducts = queryClient.getQueryData<ProductWithSupplier[]>(['products']);
      
      // 楽観的更新: 該当商品を即座に削除
      queryClient.setQueryData<ProductWithSupplier[]>(['products'], (old = []) => {
        return old.filter((product) => product.id !== productId);
      });
      
      return { previousProducts };
    },
    onError: (_err, _productId, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};