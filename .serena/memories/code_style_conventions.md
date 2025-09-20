# コーディング規約・スタイル

## 📝 TypeScript設定
- **厳格モード**: `strict: true`
- **未使用変数チェック**: `noUnusedLocals: true`
- **未使用パラメータチェック**: `noUnusedParameters: true`
- **Switch文完全性**: `noFallthroughCasesInSwitch: true`

## 🎨 コーディングスタイル
- **ESLint**: 厳格なリンティング設定
- **関数コンポーネント**: React Hooks中心
- **TypeScript**: 全ファイルで型定義必須
- **命名規則**: camelCase（関数、変数）、PascalCase（コンポーネント）

## 📂 ファイル構成パターン
- **コンポーネント**: `Component.tsx`
- **フック**: `useFeature.ts`
- **ストア**: `featureStore.ts`
- **型定義**: `types/index.ts`
- **テスト**: `__tests__/Component.test.tsx`

## 🔧 インポート規約
```typescript
// 1. React関連
import React from 'react';
import { useState, useEffect } from 'react';

// 2. サードパーティライブラリ
import { useQuery } from '@tanstack/react-query';

// 3. 内部モジュール
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
```

## 🎯 コンポーネント設計
- **単一責任原則**: 1つのコンポーネント = 1つの責任
- **Props型定義**: 必須プロパティの明確化
- **エラーハンドリング**: ErrorBoundary使用
- **アクセシビリティ**: ARIA属性の適切な使用

## 📊 状態管理パターン
- **ローカル状態**: useState, useReducer
- **サーバー状態**: TanStack React Query
- **グローバル状態**: Zustand
- **フォーム状態**: React Hook Form