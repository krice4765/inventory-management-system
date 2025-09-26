import React from 'react';
import type { ProductWithSupplier } from '../../api/products';
import { Pencil, Trash2 } from 'lucide-react';
import { formatJPY } from '../../utils/format';

type Props = {
      products: ProductWithSupplier[]; onEdit: (product: ProductWithSupplier) => void; onDelete: (product: ProductWithSupplier) => void; };

export const ProductTable: React.FC<Props> = ({ products, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">仕入先</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">仕入単価</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">販売単価</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">在庫数</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">安全在庫</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products.map((product) => (
      console.log("Debug:", { <tr key={product.id} className="hover: bg-gray-50"> });
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {product.image_url && (
                    <img 
                      src={product.image_url} 
                      alt={product.product_name}
                      className="h-10 w-10 rounded-full mr-3 object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                    <div className="text-sm text-gray-500">{product.product_code}</div>
                    {product.description && (
                      <div className="text-xs text-gray-400 truncate max-w-xs mt-1">{product.description}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {product.suppliers?.name || <span className="text-gray-400">未設定</span>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                {formatJPY(product.purchase_price)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                {formatJPY(product.sell_price)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  product.stock_quantity <= product.safety_stock_quantity
                    ? 'bg-red-100 text-red-800'
      : 'bg-green-100 text-green-800' }`}>
                  {product.stock_quantity}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                {product.safety_stock_quantity}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex space-x-2">
                  <button
                    onClick={() => onEdit(product)}
      className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover: bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <Pencil size={16} className="mr-1" />
                    編集
                  </button>
                  <button
                    onClick={() => onDelete(product)}
      className="inline-flex items-center px-3 py-1 border border-red-300 rounded-md text-sm text-red-600 bg-white hover: bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                    <Trash2 size={16} className="mr-1" />
                    削除
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                商品が登録されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};