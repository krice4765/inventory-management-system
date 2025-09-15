// 継続監視システムの実行スクリプト
// ブラウザコンソールで実行用

console.log('🔄 継続監視システム開始');
console.log('=====================================');

// 最終検証の実行
console.log('📊 最終システム検証を実行中...');
try {
  const verificationResult = await window.performFinalVerification();
  console.log('✅ 最終検証結果:', verificationResult);
} catch (error) {
  console.error('❌ 最終検証エラー:', error);
}

console.log('');
console.log('📋 プロジェクト総括生成中...');
try {
  const summaryResult = await window.generateProjectSummary();
  console.log('✅ プロジェクト総括:', summaryResult);
} catch (error) {
  console.error('❌ 総括生成エラー:', error);
}

console.log('');
console.log('🔍 継続監視システムテスト実行中...');
try {
  const monitoringTest = await window.testContinuousMonitoring();
  console.log('✅ 監視システムテスト:', monitoringTest);
} catch (error) {
  console.error('❌ 監視テストエラー:', error);
}

console.log('');
console.log('🎉 継続監視システム実行完了');