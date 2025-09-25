// データ整合性管理画面
import React, { useState } from 'react';
import { IntegrityDashboard } from '../components/IntegrityDashboard';
import { IntegrityCorrectionPanel } from '../components/IntegrityCorrectionPanel';
import { Shield, Database, AlertTriangle, Settings } from 'lucide-react';

type TabType = 'dashboard' | 'correction' | 'settings';

export const IntegrityManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const tabs = [
    {
      id: 'dashboard' as TabType,
      label: '整合性ダッシュボード',
      icon: Shield,
      description: '現在の整合性状態を確認'
    },
    {
      id: 'correction' as TabType,
      label: '修正実行パネル',
      icon: Database,
      description: '整合性問題を修正'
    },
    {
      id: 'settings' as TabType,
      label: '設定・監視',
      icon: Settings,
      description: '監視設定と履歴'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  システム整合性管理
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  データベースの整合性チェックと自動修正機能
                </p>
              </div>
            </div>

            {/* タブナビゲーション */}
            <nav className="flex space-x-1 mt-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      isActive
                        ? 'bg-blue-100 text-blue-700 border-blue-500'
                        : 'text-gray-500 hover:text-gray-700 border-transparent hover:bg-gray-100'
                    } flex items-center px-4 py-2 border-b-2 font-medium text-sm transition-colors`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    整合性ダッシュボード
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    システム全体のデータ整合性をリアルタイムで監視します。
                    不整合が検出された場合は、修正実行パネルで対処してください。
                  </p>
                </div>
              </div>
            </div>

            <IntegrityDashboard
              className=""
              showDetailedResults={true}
              enableMonitoring={false}
            />
          </div>
        )}

        {activeTab === 'correction' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    ⚠️ 重要：修正実行前の注意事項
                  </h3>
                  <ul className="text-sm text-yellow-700 mt-2 list-disc list-inside space-y-1">
                    <li>修正処理は不可逆的な操作です</li>
                    <li>必ずバックアップを作成してから実行してください</li>
                    <li>本番環境では営業時間外の実行を推奨します</li>
                    <li>修正後は整合性ダッシュボードで結果を確認してください</li>
                  </ul>
                </div>
              </div>
            </div>

            <IntegrityCorrectionPanel />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                設定・監視機能
              </h3>
              <p className="text-gray-600">
                自動監視設定、修正履歴、アラート設定などの機能は今後実装予定です。
              </p>
            </div>

            {/* 将来の機能プレースホルダー */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  自動監視設定
                </h4>
                <p className="text-xs text-gray-600">
                  定期的な整合性チェックの間隔と通知設定
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  修正履歴
                </h4>
                <p className="text-xs text-gray-600">
                  過去の修正処理の詳細ログと結果
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  アラート設定
                </h4>
                <p className="text-xs text-gray-600">
                  重大な整合性問題発生時の通知設定
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  パフォーマンス統計
                </h4>
                <p className="text-xs text-gray-600">
                  チェック処理時間と修正処理の統計情報
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  カスタムルール
                </h4>
                <p className="text-xs text-gray-600">
                  独自の整合性チェックルールの追加・編集
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  レポート出力
                </h4>
                <p className="text-xs text-gray-600">
                  整合性状況のPDFレポート自動生成
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrityManagement;