// バンドル最適化ユーティリティ
import { BundleAnalysisReport } from '../types/performance';

/**
 * バンドル分析データの生成
 */
export class BundleOptimizer {
  private static instance: BundleOptimizer;
  private analysisCache: Map<string, BundleAnalysisReport> = new Map();

  private constructor() {}

  static getInstance(): BundleOptimizer {
    if (!BundleOptimizer.instance) {
      BundleOptimizer.instance = new BundleOptimizer();
    }
    return BundleOptimizer.instance;
  }

  /**
   * 動的インポート形式に変換
   */
  generateDynamicImports(components: string[]): string[] {
    return components.map(component => {
      const componentName = this.extractComponentName(component);
      return `const ${componentName} = lazy(() => import('${component}'));`;
    });
  }

  /**
   * バンドル分析レポートの生成
   */
  async generateBundleAnalysis(): Promise<BundleAnalysisReport> {
    const cacheKey = 'current_analysis';

    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    // 実際のプロダクションでは webpack-bundle-analyzer や rollup-plugin-analyzer の結果を使用
    const analysis = await this.performBundleAnalysis();
    this.analysisCache.set(cacheKey, analysis);

    return analysis;
  }

  /**
   * バンドル分析の実行（モック版）
   */
  private async performBundleAnalysis(): Promise<BundleAnalysisReport> {
    // 実際の環境では build 情報を取得
    const analysis: BundleAnalysisReport = {
      total_size_mb: 2.5,
      gzipped_size_mb: 0.8,
      chunk_count: 8,
      largest_chunks: [
        { name: 'vendor', size_mb: 1.2, percentage: 48 },
        { name: 'main', size_mb: 0.6, percentage: 24 },
        { name: 'components', size_mb: 0.4, percentage: 16 },
        { name: 'utils', size_mb: 0.3, percentage: 12 }
      ],
      vendor_size_mb: 1.2,
      app_size_mb: 1.3,
      unused_exports: this.detectUnusedExports(),
      optimization_opportunities: this.generateOptimizationOpportunities()
    };

    return analysis;
  }

  /**
   * 未使用エクスポートの検出
   */
  private detectUnusedExports(): string[] {
    // 実際の実装では AST 解析や build ツールの出力を使用
    return [
      'src/utils/deprecatedHelper.ts:oldFunction',
      'src/components/legacy/OldComponent.tsx:default',
      'src/hooks/unusedHook.ts:useDeprecatedFeature'
    ];
  }

  /**
   * 最適化機会の生成
   */
  private generateOptimizationOpportunities() {
    return [
      {
        type: 'code_splitting' as const,
        description: 'ルートベースのコード分割で初期ロード時間を短縮',
        potential_savings_mb: 0.8
      },
      {
        type: 'tree_shaking' as const,
        description: '未使用のライブラリ関数を除去してバンドルサイズを削減',
        potential_savings_mb: 0.3
      },
      {
        type: 'lazy_loading' as const,
        description: 'モーダルやタブコンポーネントの遅延読み込み',
        potential_savings_mb: 0.4
      },
      {
        type: 'compression' as const,
        description: 'Brotli圧縮の有効化で転送サイズを20%削減',
        potential_savings_mb: 0.16
      }
    ];
  }

  /**
   * コンポーネント名の抽出
   */
  private extractComponentName(path: string): string {
    const match = path.match(/\/([^\/]+)\.tsx?$/);
    return match ? match[1] : 'Component';
  }

  /**
   * 遅延読み込み設定の生成
   */
  generateLazyLoadingConfig(routes: Array<{path: string, component: string}>): string {
    const imports = routes.map(route => {
      const componentName = this.extractComponentName(route.component);
      return `const ${componentName} = lazy(() => import('${route.component}'));`;
    }).join('\n');

    const routeConfig = routes.map(route => {
      const componentName = this.extractComponentName(route.component);
      return `  { path: '${route.path}', element: <Suspense fallback={<LoadingSpinner />}><${componentName} /></Suspense> }`;
    }).join(',\n');

    return `import { lazy, Suspense } from 'react';
import { LoadingSpinner } from './components/LoadingSpinner';

${imports}

export const routes = [
${routeConfig}
];`;
  }

  /**
   * Webpack設定の最適化提案
   */
  generateWebpackOptimizations(): Record<string, any> {
    return {
      optimization: {
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[/\\]node_modules[/\\]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10
            },
            common: {
              minChunks: 2,
              chunks: 'all',
              name: 'common',
              priority: 5
            }
          }
        },
        usedExports: true,
        sideEffects: false
      },
      resolve: {
        alias: {
          '@': './src'
        }
      }
    };
  }

  /**
   * Vite設定の最適化提案
   */
  generateViteOptimizations(): Record<string, any> {
    return {
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              ui: ['@tanstack/react-query', 'zustand'],
              utils: ['date-fns', 'lodash-es']
            }
          }
        },
        chunkSizeWarningLimit: 1000,
        sourcemap: false
      },
      optimizeDeps: {
        include: ['react', 'react-dom', '@tanstack/react-query']
      }
    };
  }

  /**
   * パフォーマンス予算の設定
   */
  generatePerformanceBudget() {
    return {
      maxInitialChunkSize: 200 * 1024, // 200KB
      maxAssetSize: 250 * 1024, // 250KB
      maxEntrypointSize: 250 * 1024, // 250KB
      warnings: {
        assetFilter: (assetFilename: string) => {
          return !/(\.map$|^runtime\..*\.js$)/.test(assetFilename);
        }
      }
    };
  }

  /**
   * 圧縮設定の最適化
   */
  generateCompressionConfig() {
    return {
      gzip: {
        enabled: true,
        options: {
          level: 6,
          threshold: 10240 // 10KB以上のファイルを圧縮
        }
      },
      brotli: {
        enabled: true,
        options: {
          level: 6,
          threshold: 10240
        }
      }
    };
  }

  /**
   * 最適化実行計画の生成
   */
  generateOptimizationPlan(analysis: BundleAnalysisReport) {
    const plan = [];

    if (analysis.total_size_mb > 3) {
      plan.push({
        priority: 'high',
        action: 'Enable code splitting for routes',
        expectedSavings: '30-40% initial bundle size',
        effort: 'moderate'
      });
    }

    if (analysis.unused_exports.length > 0) {
      plan.push({
        priority: 'medium',
        action: 'Remove unused exports',
        expectedSavings: `${analysis.unused_exports.length} unused exports`,
        effort: 'easy'
      });
    }

    if (analysis.vendor_size_mb > 1) {
      plan.push({
        priority: 'medium',
        action: 'Optimize vendor chunk splitting',
        expectedSavings: '15-20% vendor bundle size',
        effort: 'easy'
      });
    }

    return plan;
  }

  /**
   * キャッシュのクリア
   */
  clearCache(): void {
    this.analysisCache.clear();
  }
}

// シングルトンインスタンスのエクスポート
export const bundleOptimizer = BundleOptimizer.getInstance();

// ユーティリティ関数

/**
 * ファイルサイズの人間可読形式変換
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

/**
 * 圧縮率の計算
 */
export function calculateCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 0;
  return Math.round(((original - compressed) / original) * 100);
}

/**
 * パフォーマンス予算チェック
 */
export function checkPerformanceBudget(
  fileSize: number,
  budget: number,
  filename: string
): { passed: boolean; message: string } {
  const passed = fileSize <= budget;
  const message = passed
    ? `✅ ${filename}: ${formatFileSize(fileSize)} (予算内)`
    : `❌ ${filename}: ${formatFileSize(fileSize)} (予算${formatFileSize(budget)}を超過)`;

  return { passed, message };
}

/**
 * バンドル分析の可視化データ生成
 */
export function generateBundleVisualizationData(analysis: BundleAnalysisReport) {
  return {
    pieChart: {
      labels: analysis.largest_chunks.map(chunk => chunk.name),
      datasets: [{
        data: analysis.largest_chunks.map(chunk => chunk.size_mb),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF'
        ]
      }]
    },
    barChart: {
      labels: ['Total Size', 'Gzipped Size', 'Vendor Size', 'App Size'],
      datasets: [{
        label: 'Size (MB)',
        data: [
          analysis.total_size_mb,
          analysis.gzipped_size_mb,
          analysis.vendor_size_mb,
          analysis.app_size_mb
        ],
        backgroundColor: '#36A2EB'
      }]
    }
  };
}