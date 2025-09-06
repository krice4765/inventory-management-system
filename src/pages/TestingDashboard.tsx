/**
 * API統合テスト実行ダッシュボード
 * 本格運用開始前の最終動作確認用
 */

import React, { useState, useCallback } from 'react';
import { InstallmentApiTester } from '../utils/api-test';
import { ErrorDisplay, ErrorToast } from '../components/shared/ErrorDisplay';
import { useErrorHandler, UserFriendlyError } from '../utils/error-handler';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

interface ApiTestSuite {
  suiteName: string;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
}

export const TestingDashboard: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<ApiTestSuite | null>(null);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [error, setError] = useState<UserFriendlyError | null>(null);
  const { handleError } = useErrorHandler();

  // テストスイート実行（引数不要版）
  const runTestSuite = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setTestResults(null);
    setCurrentTest('テストスイート開始中...');

    try {
      const tester = new InstallmentApiTester();
      const results = await tester.runAllTests(); // 引数不要
      setTestResults(results);
      setCurrentTest('');

    } catch (err) {
      const userError = handleError(err);
      setError(userError);
      setCurrentTest('');
    } finally {
      setIsRunning(false);
    }
  }, [handleError]);

  // 個別テスト実行
  const runIndividualTest = useCallback(async (testType: 'success' | 'error' | 'staff' | 'health') => {
    setIsRunning(true);
    setError(null);

    try {
      const tester = new InstallmentApiTester();
      let result: TestResult;

      switch (testType) {
        case 'success':
          setCurrentTest('分納作成成功テスト実行中...');
          result = await tester.testCreateInstallmentSuccess();
          break;
        case 'error':
          setCurrentTest('P0001エラーハンドリングテスト実行中...');
          result = await tester.testP0001ErrorHandling();
          break;
        case 'staff':
          setCurrentTest('担当者一覧取得テスト実行中...');
          result = await tester.testStaffMembersList();
          break;
        case 'health':
          setCurrentTest('システムヘルスチェック実行中...');
          result = await tester.testSystemHealth();
          break;
        default:
          throw new Error('無効なテストタイプ');
      }

      // 個別テスト結果を表示
      setTestResults({
        suiteName: '個別テスト',
        results: [result],
        totalTests: 1,
        passedTests: result.success ? 1 : 0,
        failedTests: result.success ? 0 : 1,
        duration: result.duration
      });

    } catch (err) {
      const userError = handleError(err);
      setError(userError);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  }, [handleError]);

  // テスト結果のエクスポート
  const exportResults = useCallback(() => {
    if (!testResults) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      testSuite: testResults,
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        isDev: import.meta.env.DEV
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [testResults]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🧪 API統合テスト ダッシュボード
          </h1>
          <p className="text-gray-600">
            本格運用開始前の最終動作確認を実行します。すべてのテストが成功することを確認してください。
          </p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6">
            <ErrorDisplay
              error={error}
              onDismiss={() => setError(null)}
              onRetry={runTestSuite}
              showTechnicalDetails={import.meta.env.DEV}
            />
          </div>
        )}

        {/* 進行状況表示 */}
        {isRunning && currentTest && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-blue-700 font-medium">{currentTest}</p>
            </div>
          </div>
        )}

        {/* テスト実行ボタン */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">テスト実行</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 全テスト実行 */}
            <button
              onClick={runTestSuite}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium"
            >
              {isRunning ? '実行中...' : '🚀 全テスト実行'}
            </button>

            {/* 個別テスト */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => runIndividualTest('success')}
                disabled={isRunning}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm"
              >
                ✅ 成功テスト
              </button>
              <button
                onClick={() => runIndividualTest('error')}
                disabled={isRunning}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm"
              >
                🚨 エラーテスト
              </button>
              <button
                onClick={() => runIndividualTest('staff')}
                disabled={isRunning}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm"
              >
                👥 担当者テスト
              </button>
              <button
                onClick={() => runIndividualTest('health')}
                disabled={isRunning}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm"
              >
                💊 ヘルステスト
              </button>
            </div>
          </div>
        </div>

        {/* テスト結果表示 */}
        {testResults && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                📊 テスト結果: {testResults.suiteName}
              </h2>
              <button
                onClick={exportResults}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
              >
                📥 結果をエクスポート
              </button>
            </div>

            {/* サマリー */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-2xl font-bold text-gray-900">{testResults.totalTests}</div>
                <div className="text-sm text-gray-600">総テスト数</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">{testResults.passedTests}</div>
                <div className="text-sm text-gray-600">成功</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-600">{testResults.failedTests}</div>
                <div className="text-sm text-gray-600">失敗</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">{testResults.duration}ms</div>
                <div className="text-sm text-gray-600">実行時間</div>
              </div>
            </div>

            {/* 詳細結果 */}
            <div className="space-y-3">
              {testResults.results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">
                        {result.success ? '✅' : '❌'}
                      </span>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {result.testName}
                        </h3>
                        {result.error && (
                          <p className="text-sm text-red-600 mt-1">
                            {result.error}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {result.duration}ms
                    </span>
                  </div>
                  
                  {/* テストデータの詳細表示 */}
                  {result.data && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-gray-600">
                        詳細データを表示
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>

            {/* 運用開始判定 */}
            {testResults.failedTests === 0 ? (
              <div className="mt-6 p-4 bg-green-50 border-l-4 border-green-400">
                <div className="flex">
                  <div className="text-green-400 mr-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-green-800 font-medium">
                      🎉 本格運用開始可能！
                    </h3>
                    <p className="text-green-700 text-sm mt-1">
                      すべてのテストが成功しました。システムは本格運用に対応しています。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
                <div className="flex">
                  <div className="text-yellow-400 mr-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-yellow-800 font-medium">
                      ⚠️ 修正が必要です
                    </h3>
                    <p className="text-yellow-700 text-sm mt-1">
                      {testResults.failedTests}個のテストが失敗しました。問題を修正してから本格運用を開始してください。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* システム情報 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔧 システム情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>環境:</strong> {import.meta.env.DEV ? '開発' : '本番'}
            </div>
            <div>
              <strong>実行時刻:</strong> {new Date().toLocaleString()}
            </div>
            <div>
              <strong>ブラウザ:</strong> {navigator.userAgent.split(' ').slice(-2).join(' ')}
            </div>
            <div>
              <strong>URL:</strong> {window.location.href}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};