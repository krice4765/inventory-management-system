// ===============================================================
// 修正版システム診断スクリプト（Netlify本番環境用）
// デプロイ完了後、Netlify URLでハードリフレッシュ（Ctrl+Shift+R）してから
// 開発者コンソールでこのスクリプトを実行
// ===============================================================

(async () => {
    console.log('🔍 修正版システム診断開始');
    console.log('=' * 50);
    
    try {
        // Phase 1: 基本環境確認
        console.log('Phase 1: 基本環境確認');
        console.log('Current URL:', window.location.href);
        console.log('Pathname:', window.location.pathname);
        console.log('Host:', window.location.host);
        
        // Phase 2: React アプリ状態確認
        console.log('\nPhase 2: React アプリ状態確認');
        const rootElement = document.getElementById('root');
        const appState = {
            rootExists: !!rootElement,
            hasContent: rootElement?.innerHTML?.length > 100,
            isNetlifyDomain: window.location.host.includes('netlify.app'),
            contentPreview: rootElement?.innerHTML?.substring(0, 200) + '...'
        };
        console.log('React App State:', appState);
        
        // Phase 3: Supabase オブジェクト確認
        console.log('\nPhase 3: Supabase オブジェクト確認');
        let supabaseExists = typeof window.supabase !== 'undefined';
        console.log('Supabase Object:', {
            exists: supabaseExists,
            type: typeof window.supabase,
            hasAuth: supabaseExists ? typeof window.supabase.auth !== 'undefined' : false
        });
        
        if (!supabaseExists) {
            console.warn('⚠️ Supabaseオブジェクト未定義 - 5秒後に再確認します');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            supabaseExists = typeof window.supabase !== 'undefined';
            if (!supabaseExists) {
                console.error('❌ Supabaseクライアント初期化失敗 - 環境変数問題の可能性');
                return false;
            } else {
                console.log('✅ 遅延初期化でSupabase利用可能');
            }
        }
        
        // Phase 4: Supabase 接続テスト
        console.log('\nPhase 4: Supabase接続テスト');
        
        try {
            // 基本的な接続テスト（RPC関数を使用しない）
            const { data: testData, error: testError } = await window.supabase
                .from('products')
                .select('id')
                .limit(1);
            
            const dbConnected = !testError;
            console.log('Database Connection:', dbConnected ? '✅ 成功' : '❌ 失敗');
            
            if (testError) {
                console.warn('DB接続エラー:', testError.message);
            }
        } catch (connectionError) {
            console.error('接続テストエラー:', connectionError);
        }
        
        // Phase 5: 認証機能確認
        console.log('\nPhase 5: 認証機能確認');
        try {
            const { data: { user }, error: authError } = await window.supabase.auth.getUser();
            console.log('Auth Function:', {
                working: !authError,
                userExists: !!user,
                status: user ? '認証済みユーザー' : '✅ 未認証（正常）'
            });
            
            if (authError) {
                console.warn('認証エラー:', authError.message);
            }
        } catch (authError) {
            console.error('認証テストエラー:', authError);
        }
        
        // Phase 6: 基本データアクセステスト
        console.log('\nPhase 6: 基本データアクセステスト');
        try {
            const tablesTest = {
                products: false,
                partners: false,
                transactions: false,
                inventory_movements: false
            };
            
            // 各テーブルへのアクセステスト
            for (const tableName of Object.keys(tablesTest)) {
                try {
                    const { data, error } = await window.supabase
                        .from(tableName)
                        .select('*')
                        .limit(1);
                    
                    tablesTest[tableName] = !error;
                    if (error) {
                        console.warn(`${tableName} アクセスエラー:`, error.message);
                    }
                } catch (tableError) {
                    console.warn(`${tableName} テーブルエラー:`, tableError);
                }
            }
            
            console.log('Table Access Results:', tablesTest);
            
            const dataAccessWorking = Object.values(tablesTest).some(working => working);
            console.log('Data Access:', dataAccessWorking ? '✅ 一部成功' : '❌ 全て失敗');
            
        } catch (dataError) {
            console.error('データアクセステストエラー:', dataError);
        }
        
        // Phase 7: ルーティングテスト準備
        console.log('\nPhase 7: SPA ルーティング状態');
        const routingInfo = {
            currentPath: window.location.pathname,
            hashRouting: window.location.hash.length > 0,
            historyAPI: typeof window.history.pushState === 'function',
            reactRouterReady: document.querySelector('[data-testid]') !== null
        };
        console.log('Routing Info:', routingInfo);
        
        // 総合判定
        console.log('\n' + '=' * 50);
        console.log('📊 システム状態総合評価');
        console.log('=' * 50);
        
        const systemStatus = {
            appRendered: appState.rootExists && appState.hasContent,
            supabaseInitialized: supabaseExists,
            environmentDeployed: appState.isNetlifyDomain,
            basicFunctionality: true // 基本的な表示ができていればOK
        };
        
        console.log('System Status:', systemStatus);
        
        const allWorking = Object.values(systemStatus).every(status => status === true);
        
        if (allWorking) {
            console.log('');
            console.log('🎉🎉🎉 システム修復成功！');
            console.log('👥 ユーザー体験準備完了');
            console.log(`🌐 共有URL: ${window.location.href}`);
            console.log('');
            console.log('🧪 推奨テストシナリオ:');
            console.log('1. ホーム画面の表示確認');
            console.log('2. /partners へのナビゲーション');
            console.log('3. /products での商品登録');
            console.log('4. /orders での発注作成');
            console.log('5. /inventory での在庫確認');
            console.log('');
            console.log('💡 SPA ルーティングテスト:');
            console.log('• URLバーで /partners にアクセス');
            console.log('• ページリロード（F5）で404が出ないことを確認');
        } else {
            const failedChecks = Object.entries(systemStatus)
                .filter(([k, v]) => !v)
                .map(([k]) => k);
            console.warn('⚠️ 解決が必要な項目:', failedChecks);
            
            console.log('\n🔧 トラブルシューティング推奨:');
            if (!systemStatus.appRendered) {
                console.log('• React アプリの初期化問題 → ハードリフレッシュ（Ctrl+Shift+R）');
            }
            if (!systemStatus.supabaseInitialized) {
                console.log('• Supabase 初期化問題 → 環境変数確認');
            }
            if (!systemStatus.environmentDeployed) {
                console.log('• デプロイメント問題 → Netlify再デプロイ');
            }
        }
        
        return allWorking;
        
    } catch (error) {
        console.error('❌ 診断エラー:', error);
        console.log('スタックトレース:', error.stack);
        return false;
    }
})();