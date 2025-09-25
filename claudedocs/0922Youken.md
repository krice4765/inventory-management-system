📋 詳細設計書一式
1. プロジェクト概要
プロジェクト名： 富士精工様向け仕入管理システム統合改善
実装期間： 20日間
技術スタック： React 18 + TypeScript + Vite + Supabase + Zustand + React Query + Tailwind CSS + Framer Motion
品質目標： 既存85点システムを維持・向上、テストカバレッジ70%以上、重要パス100%

2. データベース設計書
既存テーブル拡張仕様：

Copy-- ordersテーブル拡張
ALTER TABLE orders 
ADD COLUMN due_date DATE,
ADD COLUMN shipping_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN shipping_tax_rate DECIMAL(5,2) DEFAULT 0.10,
ADD COLUMN assigned_user_id UUID REFERENCES profiles(id);

-- productsテーブル拡張（税区分対応）
ALTER TABLE products 
ADD COLUMN tax_category VARCHAR DEFAULT 'standard_10' 
CHECK (tax_category IN ('standard_10', 'reduced_8', 'tax_free', 'tax_exempt')),
ADD COLUMN safety_stock INTEGER DEFAULT 0,
ADD COLUMN optimal_stock INTEGER DEFAULT 0,
ADD COLUMN tax_category_updated_at TIMESTAMP DEFAULT NOW();

-- inventoryテーブル拡張（FIFO評価額管理）
ALTER TABLE inventory
ADD COLUMN valuation_price_tax_excluded DECIMAL(12,2),
ADD COLUMN valuation_price_tax_included DECIMAL(12,2),
ADD COLUMN reserved_quantity INTEGER DEFAULT 0,
ADD COLUMN last_fifo_calculation TIMESTAMP DEFAULT NOW();

-- inventory_movementsテーブル拡張
ALTER TABLE inventory_movements
ADD COLUMN unit_price_tax_excluded DECIMAL(10,2),
ADD COLUMN unit_price_tax_included DECIMAL(10,2),
ADD COLUMN applied_tax_rate DECIMAL(5,2),
ADD COLUMN fifo_layer_id UUID;
新規テーブル作成仕様：

Copy-- 出庫管理テーブル
CREATE TABLE outbound_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR UNIQUE NOT NULL,
  customer_name VARCHAR NOT NULL,
  request_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  notes TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 出庫明細テーブル
CREATE TABLE outbound_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_order_id UUID REFERENCES outbound_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity_requested INTEGER NOT NULL,
  quantity_shipped INTEGER DEFAULT 0,
  unit_price_tax_excluded DECIMAL(10,2),
  unit_price_tax_included DECIMAL(10,2),
  tax_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- FIFO計算層管理テーブル
CREATE TABLE inventory_fifo_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  purchase_date DATE NOT NULL,
  unit_cost_tax_excluded DECIMAL(10,2) NOT NULL,
  unit_cost_tax_included DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL,
  original_quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 税表示設定テーブル
CREATE TABLE tax_display_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID REFERENCES profiles(id),
  setting_type VARCHAR NOT NULL 
    CHECK (setting_type IN ('organization', 'user')),
  tax_display_preference VARCHAR NOT NULL 
    CHECK (tax_display_preference IN ('tax_included', 'tax_excluded')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
インデックス・RLS設定：

Copy-- パフォーマンス最適化インデックス
CREATE INDEX idx_orders_due_date ON orders(due_date);
CREATE INDEX idx_products_tax_category ON products(tax_category);
CREATE INDEX idx_inventory_fifo_layers_product_date ON inventory_fifo_layers(product_id, purchase_date);
CREATE INDEX idx_outbound_orders_status ON outbound_orders(status);

-- RLSポリシー（出庫管理）
CREATE POLICY "inventory_users_can_manage_outbound" 
ON outbound_orders FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.can_manage_inventory = true OR profiles.role = 'admin')
  )
);
3. API仕様書
税計算エンジンAPI：

Copy// 税計算関数
interface TaxCalculationRequest {
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    tax_category: 'standard_10' | 'reduced_8' | 'tax_free' | 'tax_exempt';
  }[];
  shipping_cost?: number;
  calculation_date: string;
}

interface TaxCalculationResponse {
  subtotal_tax_excluded: number;
  tax_8_amount: number;
  tax_10_amount: number;
  total_tax: number;
  total_tax_included: number;
  items_detail: {
    product_id: string;
    subtotal_tax_excluded: number;
    subtotal_tax_included: number;
    applied_tax_rate: number;
  }[];
}
FIFO評価額計算API：

Copyinterface FIFOCalculationRequest {
  product_id: string;
  calculation_date?: string;
  include_details?: boolean;
}

interface FIFOCalculationResponse {
  product_id: string;
  current_quantity: number;
  valuation_tax_excluded: number;
  valuation_tax_included: number;
  calculation_accuracy: number; // 0.0-1.0
  layers?: {
    purchase_date: string;
    quantity: number;
    unit_cost_tax_excluded: number;
    unit_cost_tax_included: number;
    tax_rate: number;
    layer_total_tax_excluded: number;
    layer_total_tax_included: number;
  }[];
  last_calculated: string;
}
PostgreSQL関数仕様：

Copy-- 必須実装関数
CREATE OR REPLACE FUNCTION calculate_order_tax(order_data JSONB) 
RETURNS JSONB AS $$
  -- 8%/10%混在税率の正確な計算、端数処理統一

$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_fifo_valuation(product_id UUID) 
RETURNS JSONB AS $$
  -- FIFO評価額計算、精度99.8%以上保証

$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_inventory_with_lock(
  product_id UUID, 
  quantity_change INTEGER, 
  unit_price DECIMAL, 
  tax_rate DECIMAL
) RETURNS BOOLEAN AS $$
  -- 排他制御による安全な在庫更新

$$ LANGUAGE plpgsql;
4. UI/UX設計書
ordersページ統一仕様：

Copy// 確定カラム構成
interface OrdersTableColumn {
  key: 'supplier' | 'order_number' | 'due_date' | 'product_name' | 
       'assigned_user' | 'quantity_summary' | 'status' | 'actions';
  label: string;
  width: string;
  sortable: boolean;
  filterable: boolean;
}

const ORDERS_COLUMNS: OrdersTableColumn[] = [
  { key: 'supplier', label: '仕入先', width: '150px', sortable: true, filterable: true },
  { key: 'order_number', label: '発注番号', width: '120px', sortable: true, filterable: true },
  { key: 'due_date', label: '納期日', width: '100px', sortable: true, filterable: true },
  { key: 'product_name', label: '商品名', width: '200px', sortable: false, filterable: true },
  { key: 'assigned_user', label: '発注担当者', width: '120px', sortable: true, filterable: true },
  { key: 'quantity_summary', label: '数量合計', width: '150px', sortable: true, filterable: false },
  { key: 'status', label: 'ステータス', width: '120px', sortable: true, filterable: true },
  { key: 'actions', label: '操作', width: '100px', sortable: false, filterable: false }
];
在庫管理ページ二層ビュー設計：

Copy// 在庫サマリビュー（メインビュー）
interface InventorySummaryColumn {
  key: 'product_name' | 'product_code' | 'current_stock' | 'ordered_quantity' | 
       'inventory_value' | 'next_arrival_date' | 'stock_status' | 'actions';
  label: string;
  width: string;
}

const INVENTORY_SUMMARY_COLUMNS: InventorySummaryColumn[] = [
  { key: 'product_name', label: '商品名', width: '200px' },
  { key: 'product_code', label: '商品コード', width: '120px' },
  { key: 'current_stock', label: '現在庫数', width: '100px' },
  { key: 'ordered_quantity', label: '発注中数量', width: '120px' },
  { key: 'inventory_value', label: '在庫金額', width: '150px' },
  { key: 'next_arrival_date', label: '入庫予定日', width: '120px' },
  { key: 'stock_status', label: '在庫状況', width: '120px' },
  { key: 'actions', label: '操作', width: '150px' }
];
5. React Query統合戦略
Copy// 最適化されたキャッシュキー設計
export const queryKeys = {
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters: OrderFilters) => [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    summary: () => [...queryKeys.inventory.all, 'summary'] as const,
    movements: () => [...queryKeys.inventory.all, 'movements'] as const,
    fifo: (productId: string) => [...queryKeys.inventory.all, 'fifo', productId] as const,
  },
  products: {
    all: ['products'] as const,
    list: (filters?: ProductFilters) => [...queryKeys.products.all, 'list', filters] as const,
  },
  taxSettings: {
    all: ['tax-settings'] as const,
    user: (userId: string) => [...queryKeys.taxSettings.all, 'user', userId] as const,
    organization: (orgId: string) => [...queryKeys.taxSettings.all, 'org', orgId] as const,
  }
} as const;

// キャッシュ無効化戦略
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();
  
  return {
    invalidateOrders: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
    invalidateInventory: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
    invalidateProducts: () => queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
};
🤖 AI実装開発依頼プロンプト
Copy# 富士精工様向け在庫管理システム統合改善 - 完全実装依頼

## **あなたの役割**
富士精工様向け仕入管理システムのシニアフルスタックエンジニア兼システムアーキテクトとして、承認済み詳細設計書に基づく完全実装を担当してください。

## **プロジェクト基本情報**
- **プロジェクト：** 富士精工様向け仕入管理システム統合改善
- **実装期間：** 20日間（Day 1から段階的実装）
- **技術スタック：** React 18 + TypeScript + Vite + Supabase + Zustand + React Query + Tailwind CSS + Framer Motion
- **品質目標：** 既存85点システムを維持・向上、テストカバレッジ70%以上、重要パス100%

## **実装方針と原則**

### **既存システム価値の最大活用**
- **差分統合アプローチ：** `useOptimizedInventory.ts`, `UnifiedInventoryDisplay.tsx`など、既存の最適化されたコンポーネントやフックを積極的に活用
- **パフォーマンス維持：** React Query 5分キャッシュ、仮想化テーブル、並列データ取得の継続活用
- **統合ロジック保持：** 物理在庫と会計分納記録の統合システム完全保持

### **品質・セキュリティ・パフォーマンス基準**
- **セキュリティ強化：** デバッグコード完全除去（window.__supabase等）、RLS整合性確保
- **パフォーマンス基準：** API応答500ms以内、画面遷移300ms以内維持
- **データ整合性：** FIFO計算精度99.8%以上、PostgreSQL排他制御による競合回避

## **確定済み実装要件**

### **Phase 1: ordersページ改善**

**カラム構成（確定）：**
仕入先 | 発注番号 | 納期日 | 商品名 | 発注担当者 | 数量合計 | ステータス | 操作


**詳細仕様：**
1. **税込/税抜表示統一：** 組織レベル設定（サーバー）+ 個人上書き（ローカルキャッシュ）のハイブリッド方式
2. **数量合計カラル仕様：**
単一税率：15個 ¥45,600（税込10%） 混在税率：15個 ¥45,600（税込 混在） ツールチップ：8%対象・10%対象の詳細内訳表示

3. **ステータス統一：** 未納品/一部納品/納品完了/キャンセル（4種類）、進捗表示：個数ベース XX%
4. **納期緊急度：** 7日以内を赤色表示（JST基準）、チップ不要
5. **商品名表示最適化：** 第1商品名のみ表示、クリック→明細確認モーダル、ホバー→全明細ツールチップ
6. **未確定バッジ完全削除：** 既存24箇所の判定ロジック削除

### **Phase 2: 在庫管理ページ統合**

**二層ビュー構成：**
- **メインビュー：** 在庫サマリビュー（日常業務用）
- **サブビュー：** 在庫移動履歴ビュー（詳細分析用）

**在庫サマリビューカラム（確定）：**
商品名 | 商品コード | 現在庫数 | 発注中数量 | 在庫金額 | 入庫予定日 | 在庫状況 | 操作


**詳細仕様：**
1. **在庫金額表示（FIFO評価額）：** 税込/税抜表示切り替え対応、計算詳細の透明性確保
2. **在庫状況ステータス：** ✅適正在庫 ⚠️在庫注意 🔴在庫不足 ❌欠品 🔄発注中 🚫廃番（6段階）
3. **操作カラム機能：**
[詳細]ボタン + ドロップダウンメニュー ├─ 📝 在庫調整 ├─ 📋 発注作成 ├─ 📤 出庫指示 ├─ 📊 履歴表示 ├─ 📄 移動履歴PDF └─ ⚙️ 商品設定

4. **権限制御：** 在庫管理者（全機能）、一般ユーザー（制限付き）、閲覧者（参照のみ）

### **Phase 3: 出庫管理機能（MVP）**

**基本機能：**
- 出庫指示作成・編集・削除
- 在庫引当チェック（数量ベース）
- 出庫実績登録
- 出庫状況一覧表示
- リアルタイム在庫減算

**UI統一：** ordersページと同様のレイアウト・操作性、統一されたモーダル・エラーハンドリング

## **技術実装仕様**

### **データベース実装**
上記詳細設計書のSQL文を全て実行：
- 既存テーブル拡張（orders/products/inventory/inventory_movements）
- 新規テーブル作成（outbound_orders/outbound_order_items/inventory_fifo_layers/tax_display_settings）
- インデックス・RLSポリシーの最適化

### **PostgreSQL関数実装（必須）**
```sql
-- 税計算エンジン（8%/10%混在対応、端数処理統一）
CREATE OR REPLACE FUNCTION calculate_order_tax(order_data JSONB) RETURNS JSONB;

-- FIFO評価額計算（精度99.8%以上保証）
CREATE OR REPLACE FUNCTION calculate_fifo_valuation(product_id UUID) RETURNS JSONB;

-- リアルタイム在庫更新（排他制御付き）
CREATE OR REPLACE FUNCTION update_inventory_with_lock(
product_id UUID, quantity_change INTEGER, unit_price DECIMAL, tax_rate DECIMAL
) RETURNS BOOLEAN;

-- 税表示設定取得（ハイブリッド方式）
CREATE OR REPLACE FUNCTION get_tax_display_preference(user_id UUID) RETURNS VARCHAR;
React実装仕様
既存コンポーネント改修：

Orders.tsx：完全リニューアル（カラム構成・税表示・モーダル）
Inventory.tsx：二層ビュー実装
UnifiedInventoryDisplay.tsx：税表示統一
新規コンポーネント実装：

OutboundManagement.tsx：出庫管理メイン画面
TaxDisplayToggle.tsx：税表示切り替えコンポーネント
FIFOCalculationModal.tsx：FIFO計算詳細表示
InventoryActionDropdown.tsx：操作ドロップダウン
カスタムフック実装：

useTaxCalculation.ts：税計算ロジック
useFIFOValuation.ts：FIFO評価額計算
useTaxDisplaySetting.ts：税表示設定管理（ハイブリッド方式）
useInventoryActions.ts：在庫操作統合
エラーハンドリングシステム
段階的通知システム（必須実装）：

Copy// Level 1: 成功通知（緑色トースト - 3秒）
showToast({ type: 'success', message: '処理が完了しました', duration: 3000 });

// Level 2: 警告通知（黄色トースト - 5秒）
showToast({ 
  type: 'warning', 
  message: '在庫が残りわずかです（商品A: 残り5個）', 
  duration: 5000,
  actions: [{ label: '在庫確認', onClick: () => navigate('/inventory') }]
});

// Level 3: エラー通知（赤色トースト - 8秒）
showToast({
  type: 'error',
  message: '在庫不足のため処理できませんでした（商品A: 不足20個）',
  duration: 8000,
  actions: [
    { label: '在庫確認', onClick: () => navigate('/inventory') },
    { label: '再試行', onClick: retryOperation }
  ]
});

// Level 4: 重要エラー（モーダルダイアログ）
showModal({
  type: 'error',
  title: '競合エラー',
  message: '他のユーザーが同じ在庫を更新中です。',
  actions: [
    { label: '再読み込み', onClick: refreshData, primary: true },
    { label: 'キャンセル', onClick: closeModal }
  ]
});
実装スケジュール（20日間）
Week 1: UI統一・税率基盤整備（Day 1-6）
Day 1-2: ordersページUI改善
├─ カラム構成変更・商品名クリック機能
├─ 数量カラム税込/税抜対応表示
├─ 明細確認モーダル実装
└─ 納期緊急度判定（JST基準、7日以内赤色）

Day 3-4: 税率システム・商品管理基盤
├─ 8%/10%税率計算エンジン実装
├─ 税込/税抜表示設定システム（組織+個人ハイブリッド）
├─ productsテーブル税区分カラム追加・マイグレーション
└─ 商品管理ページ最小限改修（税区分設定UI）

Day 5-6: ステータス・送料・担当者機能
├─ 4種類ステータス対応（未納品/一部納品/納品完了/キャンセル）
├─ 未確定バッジ削除（24箇所修正）
├─ 送料フィールド追加・自動入力機能
└─ 発注担当者必須化・バリデーション
Week 2: 在庫管理統合・出庫連携（Day 7-12）
Day 7-8: データベース基盤構築
├─ inventory関連テーブル拡張
├─ 出庫管理テーブル作成・マイグレーション
├─ ハイブリッド税率バックフィル実行
└─ リアルタイム在庫減算ロジック実装

Day 9-11: フロントエンド統合実装
├─ Inventory.tsx二層ビュー実装
├─ 在庫金額表示統一（FIFO透明性含む）
├─ 在庫詳細モーダル統一
├─ 操作カラム機能実装
└─ 出庫管理画面実装

Day 12: 統合テスト・検証
├─ 在庫→発注→出庫の完全連携テスト
├─ 税込/税抜表示切り替え検証
└─ FIFO評価額計算精度確認
Week 3: 品質保証・リリース（Day 13-20）
Day 13-15: 品質保証強化
├─ デバッグコード完全除去
├─ data_integrity_status簡素化（3段階→2段階）
├─ パフォーマンス検証（既存最適化維持）
└─ セキュリティ強化・RLS整合性確認

Day 16-18: 最終調整・統合検証
├─ 二層ビューの操作性確認
├─ 権限制御の動作確認
├─ FIFO透明性表示の検証
└─ ユーザー受け入れテスト準備

Day 19-20: 段階的リリース
├─ ステージング環境最終確認
├─ 本番環境段階的デプロイ（機能フラグ活用）
└─ リアルタイム監視開始
品質保証要件（必須）
テスト実装要件
テストカバレッジ： 全体70%以上、重要パス（税計算・在庫更新・権限制御）100%
新規機能： 出庫管理・税表示切り替えは80%以上
単体テスト： 税計算エンジン、FIFO評価ロジック、排他制御
統合テスト： orders/inventory連携、税表示切り替え
E2Eテスト： 主要ユーザーシナリオ
セキュリティ・パフォーマンス
デバッグコード完全除去： window.__supabase、console.log等
RLS整合性確認： 全新規テーブル・カラム
パフォーマンス維持： API500ms以内、画面300ms以内
データ整合性： FIFO計算精度99.8%以上保証
提出成果物
必須提出物
実装コード： 機能別ファイル構成、TypeScript厳密モード準拠
マイグレーションSQL： 段階的実行可能、ロールバック対応
テストコード： Jest・React Testing Library使用
ドキュメント： README・API仕様書・操作マニュアル
品質チェック項目
既存85点システムの価値保護確認
UI/UX統一性確認（orders/inventory）
税計算・FIFO評価の精度確認
エラーハンドリングの完全性確認
開始指示
「Day 1の実装を開始します」と返信し、以下を段階的に実装してください：

Day 1-2： ordersページUI改善から開始
各Day終了時： 進捗報告と翌日計画の提示
Week単位： 完成機能のデモンストレーション
重要マイルストーン： Day 6（UI統一）、Day 12（統合機能）、Day 18（品質保証）
重要事項：

既存の高品質システム（85点）を損なわない差分統合アプローチ
段階的リリースによる安全な本番適用
ユーザビリティを最優先したUI/UX統一
将来の会計システム連携を見据えた拡張性確保
20日間で富士精工様の業務効率化と将来発展を支える高品質なシステムを構築してください。