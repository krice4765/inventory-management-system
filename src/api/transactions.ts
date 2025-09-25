import { supabase } from '../lib/supabase';

export type TransactionType = 'purchase' | 'sale' | 'adjustment';
export type TransactionStatus = 'draft' | 'confirmed' | 'completed' | 'cancelled';

export interface Transaction {
  id: number;
  transaction_no: string;
  transaction_type: TransactionType;
  partner_id?: number | null;
  transaction_date: string;
  due_date?: string | null;
  status: TransactionStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  partners?: {
    id: number;
    name: string;
    partner_code: string;
  };
  transaction_items?: TransactionItem[];
}

export interface TransactionItem {
  id?: number;
  transaction_id?: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  line_total?: number;
  notes?: string | null;
  products?: {
    id: number;
    name: string;
    product_code: string;
    stock_quantity: number;
  };
}

export interface TransactionInsert {
  transaction_type: TransactionType;
  partner_id?: number | null;
  transaction_date?: string;
  due_date?: string | null;
  notes?: string | null;
  items: Omit<TransactionItem, 'id' | 'transaction_id' | 'line_total' | 'products'>[];
}

// 伝票番号自動生成
export async function generateTransactionNo(type: TransactionType): Promise<string> {
  const { data, error } = await supabase
    .rpc('generate_transaction_no', { trans_type: type });
  
  if (error) throw error;
  return data as string;
}

// 仕入伝票一覧取得
export async function getPurchaseOrders(limit = 50): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      partners:partner_id (
        id,
        name,
        partner_code
      ),
      transaction_items (
        id,
        product_id,
        quantity,
        unit_price,
        line_total,
        notes,
        products:product_id (
          id,
          name,
          product_code,
          stock_quantity
        )
      )
    `)
    .eq('transaction_type', 'purchase')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Transaction[];
}

// 仕入伝票作成
export async function createPurchaseOrder(payload: TransactionInsert): Promise<Transaction> {
  const transactionNo = await generateTransactionNo('purchase');

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      transaction_no: transactionNo,
      transaction_type: 'purchase',
      partner_id: payload.partner_id,
      transaction_date: payload.transaction_date || new Date().toISOString().split('T')[0],
      due_date: payload.due_date,
      notes: payload.notes,
      status: 'draft'
    })
    .select()
    .single();

  if (txError) throw txError;

  if (payload.items && payload.items.length > 0) {
    const items = payload.items.map(item => ({
      transaction_id: transaction.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      notes: item.notes
    }));

    const { error: itemsError } = await supabase
      .from('transaction_items')
      .insert(items);

    if (itemsError) throw itemsError;
  }

  return getPurchaseOrderById(transaction.id);
}

// 伝票詳細取得
export async function getPurchaseOrderById(id: number): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      partners:partner_id (
        id,
        name,
        partner_code
      ),
      transaction_items (
        id,
        product_id,
        quantity,
        unit_price,
        line_total,
        notes,
        products:product_id (
          id,
          name,
          product_code,
          stock_quantity
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Transaction;
}

// 伝票ステータス更新
export async function updateTransactionStatus(
  id: number, 
  status: TransactionStatus
): Promise<Transaction> {
  const { error } = await supabase
    .from('transactions')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return getPurchaseOrderById(id);
}

// 伝票削除
export async function deleteTransaction(id: number): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 分納追加RPC
export interface AddInstallmentParams {
  parentOrderId: string;
  amount: number;
  status?: TransactionStatus;
  dueDate?: string;
  memo?: string;
  quantities?: { [productId: string]: number };
}

export interface InstallmentResult {
  id: string;
  parent_order_id: string;
  installment_no: number;
  transaction_no: string;
  status: string;
  total_amount: number;
  memo: string | null;
  transaction_date: string;
  due_date: string;
  created_at: string;
}

export async function addPurchaseInstallment(params: AddInstallmentParams): Promise<InstallmentResult> {
  // 商品情報が含まれている場合はcreate_installment_v3を使用
  if (params.quantities && Object.keys(params.quantities).length > 0) {
    // 発注商品情報を取得してitems配列を構築
    const { data: orderItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select(`
        id, product_id, quantity, unit_price, total_amount
      `)
      .eq('purchase_order_id', params.parentOrderId);

    if (itemsError) throw itemsError;

    // 選択された商品情報を構築
    const items = Object.entries(params.quantities)
      .filter(([productId, quantity]) => quantity > 0)
      .map(([_productId, quantity]) => {
        const orderItem = orderItems?.find(item => item.product_id === productId);
        if (orderItem) {
          // 実際の分納単価を計算（分納金額 / 総数量）
          const totalSelectedQuantity = Object.values(params.quantities).reduce((sum: number, qty: number) => sum + qty, 0);
          const actualUnitPrice = Math.round(params.amount / totalSelectedQuantity);
          return {
            product_id: productId,
            quantity: quantity,
            unit_price: actualUnitPrice,
            total_amount: actualUnitPrice * quantity
          };
        }
        return null;
      }).filter(item => item !== null);

    // V3関数で商品情報付き分納を作成
    const { data, error } = await supabase.rpc('create_installment_v3', {
      p_parent_order_id: params.parentOrderId,
      p_partner_id: null, // 発注から自動取得
      p_transaction_date: new Date().toISOString().split('T')[0],
      p_due_date: params.dueDate || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
      p_total_amount: params.amount,
      p_memo: params.memo || '',
      p_items: items.length > 0 ? items : null
    });

    if (error) throw error;
    if (!data || !data.success) {
      throw new Error(data?.error || '商品情報付き分納の作成に失敗しました');
    }

    // V3結果をInstallmentResult形式に変換
    return {
      id: data.id,
      parent_order_id: params.parentOrderId,
      installment_no: data.installment_no,
      transaction_no: data.transaction_no,
      status: params.status || 'draft',
      total_amount: params.amount,
      memo: params.memo || null,
      transaction_date: new Date().toISOString().split('T')[0],
      due_date: params.dueDate || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
      created_at: data.created_at
    } as InstallmentResult;
  }

  // 既存のV2関数を使用（商品情報なし）
  const { data, error } = await supabase.rpc('add_purchase_installment_v2', {
    p_parent_order_id: params.parentOrderId,
    p_amount: params.amount,
    p_status: params.status || 'draft',
    p_due_date: params.dueDate,
    p_memo: params.memo,
  });

  if (error) throw error;

  if (!data) {
    throw new Error('分納の追加に失敗しました');
  }

  return data as InstallmentResult;
}
