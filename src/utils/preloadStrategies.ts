// プリロード戦略管理
export class PreloadManager {
  private static preloadedRoutes = new Set<string>();
  private static preloadPromises = new Map<string, Promise<any>>();

  // ルートベースのプリローディング
  static preloadRoute(routeName: string): Promise<any> {
    if (this.preloadedRoutes.has(routeName)) {
      return Promise.resolve();
    }

    if (this.preloadPromises.has(routeName)) {
      return this.preloadPromises.get(routeName)!;
    }

    let preloadPromise: Promise<any>;

    switch (routeName) {
      case 'products':
        preloadPromise = import('../pages/Products');
        break;
      case 'inventory':
        preloadPromise = import('../pages/Inventory');
        break;
      case 'orders':
        preloadPromise = import('../pages/Orders');
        break;
      case 'partners':
        preloadPromise = import('../pages/Partners');
        break;
      case 'purchase-orders':
        preloadPromise = import('../pages/PurchaseOrders');
        break;
      case 'delivery-modal':
        preloadPromise = import('../components/DeliveryModal');
        break;
      default:
        return Promise.resolve();
    }

    this.preloadPromises.set(routeName, preloadPromise);

    preloadPromise.then(() => {
      this.preloadedRoutes.add(routeName);
      this.preloadPromises.delete(routeName);
    });

    return preloadPromise;
  }

  // ユーザーの行動パターンに基づいたインテリジェントプリロード
  static preloadLikelyRoutes() {
    // ダッシュボード表示後に高確率でアクセスされるページをプリロード
    setTimeout(() => {
      this.preloadRoute('products');
      this.preloadRoute('inventory');
    }, 2000); // 2秒後にプリロード開始

    // 中優先度のページをより遅くプリロード
    setTimeout(() => {
      this.preloadRoute('orders');
    }, 5000); // 5秒後

    // 管理画面は必要時のみプリロード
    setTimeout(() => {
      this.preloadRoute('partners');
    }, 10000); // 10秒後
  }

  // ホバー時のプリロード（ナビゲーション要素用）
  static onHoverPreload(routeName: string) {
    // ホバー時に200ms遅延でプリロード開始
    const timeoutId = setTimeout(() => {
      this.preloadRoute(routeName);
    }, 200);

    // マウスが離れた場合のクリーンアップ用に返す
    return () => clearTimeout(timeoutId);
  }
}

// パフォーマンス監視
export class PerformanceMonitor {
  private static loadTimes = new Map<string, number>();

  static recordLoadTime(routeName: string, startTime: number) {
    const loadTime = performance.now() - startTime;
    this.loadTimes.set(routeName, loadTime);
    
    console.log(`Route ${routeName} loaded in ${loadTime.toFixed(2)}ms`);
    
    // 200ms を超える場合は警告
    if (loadTime > 200) {
      console.warn(`Route ${routeName} load time exceeds 200ms target: ${loadTime.toFixed(2)}ms`);
    }
  }

  static getAverageLoadTime(): number {
    const times = Array.from(this.loadTimes.values());
    if (times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  static getSlowRoutes(): string[] {
    return Array.from(this.loadTimes.entries())
      .filter(([, time]) => time > 200)
      .map(([route]) => route);
  }
}