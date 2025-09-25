/**
 * 在庫管理システム パフォーマンス測定スクリプト
 * 目標: レスポンス時間 500ms以内
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');

class PerformanceAnalyzer {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      baseUrl: 'http://localhost:5174',
      pages: {},
      networkMetrics: {},
      resourceSizes: {},
      coreWebVitals: {}
    };
  }

  async measurePagePerformance(page, pageName, url) {
    console.log(`📊 測定開始: ${pageName} - ${url}`);

    // Performance API開始
    await page.addInitScript(() => {
      window.performanceStartTime = performance.now();
    });

    const startTime = Date.now();

    // ネットワークリクエストを監視
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        timestamp: Date.now()
      });
    });

    const responses = [];
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        responseTime: Date.now() - responses.length, // 簡易計算
        headers: response.headers(),
        size: response.headers()['content-length'] || 0
      });
    });

    // ページナビゲーション
    await page.goto(url, { waitUntil: 'networkidle' });

    const navigationEndTime = Date.now();
    const navigationTime = navigationEndTime - startTime;

    // Core Web Vitals測定
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        // LCP (Largest Contentful Paint)
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lcp = entries[entries.length - 1];

          // FID (First Input Delay) - 代替指標としてloadイベント時間を使用
          const navigation = performance.getEntriesByType('navigation')[0];

          // CLS (Cumulative Layout Shift) - 簡易実装
          let cls = 0;
          new PerformanceObserver((layoutEntries) => {
            for (const entry of layoutEntries.getEntries()) {
              if (!entry.hadRecentInput) {
                cls += entry.value;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });

          setTimeout(() => {
            resolve({
              lcp: lcp ? lcp.startTime : 0,
              fid: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
              cls: cls,
              ttfb: navigation ? navigation.responseStart - navigation.fetchStart : 0,
              domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
              loadComplete: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0
            });
          }, 1000);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
    });

    // JavaScript実行時間測定
    const jsMetrics = await page.evaluate(() => {
      const scripts = performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('.js'))
        .map(entry => ({
          name: entry.name.split('/').pop(),
          transferSize: entry.transferSize,
          duration: entry.duration,
          responseEnd: entry.responseEnd
        }));

      return {
        scriptCount: scripts.length,
        totalJSSize: scripts.reduce((sum, s) => sum + (s.transferSize || 0), 0),
        totalJSTime: scripts.reduce((sum, s) => sum + (s.duration || 0), 0),
        scripts: scripts
      };
    });

    // メモリ使用量測定
    const memoryInfo = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    this.results.pages[pageName] = {
      url,
      navigationTime,
      webVitals,
      jsMetrics,
      memoryInfo,
      requestCount: requests.length,
      responseCount: responses.length,
      requests: requests.slice(0, 10), // 最初の10件のみ保存
      responses: responses.slice(0, 10)
    };

    console.log(`✅ ${pageName} 測定完了: ${navigationTime}ms`);
    return this.results.pages[pageName];
  }

  async measureApiPerformance(page) {
    console.log('🔍 API パフォーマンス測定開始');

    const apiEndpoints = [
      '/api/products',
      '/api/partners',
      '/api/purchase_orders',
      '/api/inventory_movements'
    ];

    const apiResults = {};

    for (const endpoint of apiEndpoints) {
      const fullUrl = `${this.results.baseUrl}${endpoint}`;
      try {
        const startTime = Date.now();

        const response = await page.request.get(fullUrl);
        const endTime = Date.now();

        const responseTime = endTime - startTime;
        const responseSize = (await response.text()).length;

        apiResults[endpoint] = {
          responseTime,
          status: response.status(),
          size: responseSize,
          headers: response.headers()
        };

        console.log(`📡 ${endpoint}: ${responseTime}ms (${response.status()})`);
      } catch (error) {
        apiResults[endpoint] = {
          error: error.message,
          responseTime: 0
        };
        console.log(`❌ ${endpoint}: エラー - ${error.message}`);
      }
    }

    this.results.networkMetrics = apiResults;
    return apiResults;
  }

  async analyzeBundleSize() {
    console.log('📦 バンドルサイズ分析');

    try {
      const distPath = 'C:/Users/kuris/Documents/AIproject/gemini-cli-tutorial/web_projects/web_dev/project1/dist';
      const { execSync } = require('child_process');

      // ファイルサイズ情報取得
      const sizeInfo = execSync(`cd "${distPath}" && find . -name "*.js" -o -name "*.css" | xargs ls -la`, { encoding: 'utf8' });

      this.results.resourceSizes = {
        bundleAnalysis: sizeInfo,
        totalDistSize: execSync(`cd "${distPath}" && du -sh .`, { encoding: 'utf8' }).trim()
      };

      console.log(`📊 Total bundle size: ${this.results.resourceSizes.totalDistSize}`);
    } catch (error) {
      console.log(`⚠️ バンドルサイズ分析エラー: ${error.message}`);
      this.results.resourceSizes = { error: error.message };
    }
  }

  generateReport() {
    const report = {
      summary: {
        timestamp: this.results.timestamp,
        totalPagesAnalyzed: Object.keys(this.results.pages).length,
        averageLoadTime: 0,
        performanceScore: 0
      },
      recommendations: []
    };

    // 平均ロード時間計算
    const loadTimes = Object.values(this.results.pages).map(page => page.navigationTime);
    report.summary.averageLoadTime = loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;

    // パフォーマンススコア計算 (簡易版)
    let score = 100;

    // LCP基準 (2.5秒以内で満点)
    const avgLCP = Object.values(this.results.pages)
      .map(page => page.webVitals.lcp)
      .reduce((sum, lcp) => sum + lcp, 0) / Object.keys(this.results.pages).length;

    if (avgLCP > 2500) score -= 20;
    else if (avgLCP > 1500) score -= 10;

    // ナビゲーション時間基準 (500ms以内で満点)
    if (report.summary.averageLoadTime > 1000) score -= 30;
    else if (report.summary.averageLoadTime > 500) score -= 15;

    report.summary.performanceScore = Math.max(0, score);

    // 改善提案生成
    if (report.summary.averageLoadTime > 500) {
      report.recommendations.push({
        priority: 'HIGH',
        category: 'Response Time',
        issue: `平均レスポンス時間が目標(500ms)を超過: ${Math.round(report.summary.averageLoadTime)}ms`,
        solution: 'バンドル分割、画像最適化、CDN導入を検討'
      });
    }

    if (avgLCP > 2500) {
      report.recommendations.push({
        priority: 'HIGH',
        category: 'Core Web Vitals',
        issue: `LCP(${Math.round(avgLCP)}ms)が基準(2.5秒)を超過`,
        solution: 'クリティカルリソースの優先読み込み、サーバーサイドレンダリング検討'
      });
    }

    return report;
  }

  async saveResults(filename = 'performance-analysis-results.json') {
    const report = this.generateReport();
    const fullResults = {
      ...this.results,
      report
    };

    fs.writeFileSync(filename, JSON.stringify(fullResults, null, 2));
    console.log(`💾 結果保存完了: ${filename}`);
    return fullResults;
  }
}

async function runPerformanceAnalysis() {
  console.log('🚀 在庫管理システム パフォーマンス分析開始');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const analyzer = new PerformanceAnalyzer();

  try {
    // 主要ページのパフォーマンス測定
    const pages = [
      { name: 'Dashboard', url: 'http://localhost:5174/' },
      { name: 'Inventory', url: 'http://localhost:5174/inventory' },
      { name: 'Products', url: 'http://localhost:5174/products' },
      { name: 'Orders', url: 'http://localhost:5174/orders' },
      { name: 'Partners', url: 'http://localhost:5174/partners' }
    ];

    for (const pageInfo of pages) {
      await analyzer.measurePagePerformance(page, pageInfo.name, pageInfo.url);
    }

    // API パフォーマンス測定
    await analyzer.measureApiPerformance(page);

    // バンドルサイズ分析
    await analyzer.analyzeBundleSize();

    // 結果保存
    const results = await analyzer.saveResults();

    // サマリー表示
    console.log('\n📊 パフォーマンス分析結果サマリー:');
    console.log(`平均ロード時間: ${Math.round(results.report.summary.averageLoadTime)}ms`);
    console.log(`パフォーマンススコア: ${results.report.summary.performanceScore}/100`);
    console.log(`分析対象ページ数: ${results.report.summary.totalPagesAnalyzed}`);

    if (results.report.recommendations.length > 0) {
      console.log('\n⚠️ 改善提案:');
      results.report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority}] ${rec.issue}`);
        console.log(`   💡 ${rec.solution}`);
      });
    }

  } catch (error) {
    console.error('❌ 分析エラー:', error.message);
  } finally {
    await browser.close();
  }
}

// スクリプト実行
if (require.main === module) {
  runPerformanceAnalysis().catch(console.error);
}

module.exports = { PerformanceAnalyzer, runPerformanceAnalysis };