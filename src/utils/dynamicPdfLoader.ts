/**
 * PDFライブラリの動的インポート管理システム
 * 初期バンドルサイズを削減し、必要時のみライブラリをロード
 */

import { useState } from 'react';
import { performanceMonitor } from './performanceMonitor';
import type { OrderPDFData, DeliveryNotePDFData, PDFOperationResult } from '../types/pdf';

// 動的インポート用の型定義
type OrderPDFGenerator = {
  generateOrderPDF: (orderData: OrderPDFData) => Promise<PDFOperationResult>;
  attachDrawingsToPDF: (orderPDF: Blob, drawingPDFs: Blob[]) => Promise<PDFOperationResult>;
  downloadPDF: (pdfBlob: Blob, filename: string) => void;
};

type JapanesePDFGenerator = {
  generateOrderPDF: (orderData: OrderPDFData) => Promise<PDFOperationResult>;
  generateDeliveryNotePDF: (deliveryData: DeliveryNotePDFData) => Promise<PDFOperationResult>;
  downloadPDF: (pdfBlob: Blob, filename: string) => void;
};

// キャッシュ管理
class PDFLibraryCache {
  private static instance: PDFLibraryCache;
  private orderPDFGenerator: OrderPDFGenerator | null = null;
  private japanesePDFGenerator: JapanesePDFGenerator | null = null;
  private loadingPromises: Map<string, Promise<any>> = new Map();

  static getInstance(): PDFLibraryCache {
    if (!PDFLibraryCache.instance) {
      PDFLibraryCache.instance = new PDFLibraryCache();
    }
    return PDFLibraryCache.instance;
  }

  async getOrderPDFGenerator(): Promise<OrderPDFGenerator> {
    if (this.orderPDFGenerator) {
      return this.orderPDFGenerator;
    }

    const loadKey = 'orderPDFGenerator';
    if (!this.loadingPromises.has(loadKey)) {
      this.loadingPromises.set(loadKey, this.loadOrderPDFGenerator());
    }

    return this.loadingPromises.get(loadKey)!;
  }

  async getJapanesePDFGenerator(): Promise<JapanesePDFGenerator> {
    if (this.japanesePDFGenerator) {
      return this.japanesePDFGenerator;
    }

    const loadKey = 'japanesePDFGenerator';
    if (!this.loadingPromises.has(loadKey)) {
      this.loadingPromises.set(loadKey, this.loadJapanesePDFGenerator());
    }

    return this.loadingPromises.get(loadKey)!;
  }

  private async loadOrderPDFGenerator(): Promise<OrderPDFGenerator> {
    const startTime = performance.now();

    try {
      const module = await import('../utils/pdfGenerator');
      this.orderPDFGenerator = module.OrderPDFGenerator;

      const loadTime = performance.now() - startTime;
      performanceMonitor.trackAPI('PDF Library Load (Order)', loadTime);
      console.log(`📦 PDF Library loaded: OrderPDFGenerator (${loadTime.toFixed(1)}ms)`);

      return this.orderPDFGenerator!;
    } catch (error) {
      console.error('Failed to load OrderPDFGenerator:', error);
      throw new Error('PDFライブラリの読み込みに失敗しました');
    }
  }

  private async loadJapanesePDFGenerator(): Promise<JapanesePDFGenerator> {
    const startTime = performance.now();

    try {
      const module = await import('../utils/japanesePdfGenerator');
      this.japanesePDFGenerator = module.JapanesePDFGenerator;

      const loadTime = performance.now() - startTime;
      performanceMonitor.trackAPI('PDF Library Load (Japanese)', loadTime);
      console.log(`📦 PDF Library loaded: JapanesePDFGenerator (${loadTime.toFixed(1)}ms)`);

      return this.japanesePDFGenerator!;
    } catch (error) {
      console.error('Failed to load JapanesePDFGenerator:', error);
      throw new Error('日本語PDFライブラリの読み込みに失敗しました');
    }
  }

  // メモリクリーンアップ用メソッド（必要に応じて）
  clearCache(): void {
    this.orderPDFGenerator = null;
    this.japanesePDFGenerator = null;
    this.loadingPromises.clear();
    console.log('📦 PDF library cache cleared');
  }
}

/**
 * 高レベルPDF操作API - 動的インポート対応
 */
export class DynamicPDFService {
  private static cache = PDFLibraryCache.getInstance();

  /**
   * 発注書PDF生成（英語/標準版）
   */
  static async generateOrderPDF(orderData: OrderPDFData): Promise<PDFOperationResult> {
    const startTime = performance.now();

    try {
      const generator = await this.cache.getOrderPDFGenerator();
      const result = await generator.generateOrderPDF(orderData);

      const totalTime = performance.now() - startTime;
      performanceMonitor.trackAPI('Generate Order PDF', totalTime);

      return result;
    } catch (error) {
      console.error('Order PDF generation failed:', error);
      return {
        success: false,
        error: `発注書PDF生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 発注書PDF生成（日本語版）
   */
  static async generateJapaneseOrderPDF(orderData: OrderPDFData): Promise<PDFOperationResult> {
    const startTime = performance.now();

    try {
      const generator = await this.cache.getJapanesePDFGenerator();
      const result = await generator.generateOrderPDF(orderData);

      const totalTime = performance.now() - startTime;
      performanceMonitor.trackAPI('Generate Japanese Order PDF', totalTime);

      return result;
    } catch (error) {
      console.error('Japanese Order PDF generation failed:', error);
      return {
        success: false,
        error: `日本語発注書PDF生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 納品書PDF生成（日本語版）
   */
  static async generateDeliveryNotePDF(deliveryData: DeliveryNotePDFData): Promise<PDFOperationResult> {
    const startTime = performance.now();

    try {
      const generator = await this.cache.getJapanesePDFGenerator();
      const result = await generator.generateDeliveryNotePDF(deliveryData);

      const totalTime = performance.now() - startTime;
      performanceMonitor.trackAPI('Generate Delivery Note PDF', totalTime);

      return result;
    } catch (error) {
      console.error('Delivery Note PDF generation failed:', error);
      return {
        success: false,
        error: `納品書PDF生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 図面PDFと発注書PDFの結合
   */
  static async attachDrawingsToPDF(orderPDF: Blob, drawingPDFs: Blob[]): Promise<PDFOperationResult> {
    const startTime = performance.now();

    try {
      const generator = await this.cache.getOrderPDFGenerator();
      const result = await generator.attachDrawingsToPDF(orderPDF, drawingPDFs);

      const totalTime = performance.now() - startTime;
      performanceMonitor.trackAPI('Attach Drawings to PDF', totalTime);

      return result;
    } catch (error) {
      console.error('PDF attachment failed:', error);
      return {
        success: false,
        error: `PDF結合に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * PDFダウンロード（共通）
   */
  static async downloadPDF(pdfBlob: Blob, filename: string): Promise<void> {
    try {
      // 軽量なダウンロード機能のため、日本語PDFジェネレーターのdownloadPDFを使用
      const generator = await this.cache.getJapanesePDFGenerator();
      generator.downloadPDF(pdfBlob, filename);

      performanceMonitor.trackAPI('PDF Download', 0); // ダウンロードは即座に実行
    } catch (error) {
      console.error('PDF download failed:', error);
      // フォールバック: ネイティブダウンロード実装
      this.fallbackDownload(pdfBlob, filename);
    }
  }

  /**
   * フォールバックダウンロード実装
   */
  private static fallbackDownload(pdfBlob: Blob, filename: string): void {
    try {
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fallback download failed:', error);
      alert('PDFのダウンロードに失敗しました');
    }
  }

  /**
   * PDFライブラリの事前ロード（UX最適化用）
   */
  static async preloadPDFLibraries(): Promise<void> {
    try {
      console.log('📦 Pre-loading PDF libraries...');

      // 並列で両方のライブラリをロード
      await Promise.all([
        this.cache.getOrderPDFGenerator(),
        this.cache.getJapanesePDFGenerator()
      ]);

      console.log('✅ PDF libraries pre-loaded successfully');
    } catch (error) {
      console.warn('PDF library pre-loading failed:', error);
    }
  }

  /**
   * キャッシュクリーンアップ
   */
  static clearCache(): void {
    this.cache.clearCache();
  }
}

/**
 * React Hook: PDF生成状態管理
 */
export function usePDFGeneration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePDF = async (
    type: 'order' | 'japanese-order' | 'delivery',
    data: OrderPDFData | DeliveryNotePDFData
  ): Promise<PDFOperationResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      let result: PDFOperationResult;

      switch (type) {
        case 'order':
          result = await DynamicPDFService.generateOrderPDF(data as OrderPDFData);
          break;
        case 'japanese-order':
          result = await DynamicPDFService.generateJapaneseOrderPDF(data as OrderPDFData);
          break;
        case 'delivery':
          result = await DynamicPDFService.generateDeliveryNotePDF(data as DeliveryNotePDFData);
          break;
        default:
          throw new Error('Invalid PDF type');
      }

      if (!result.success && result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PDF生成エラーが発生しました';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generatePDF,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}


// デバッグ用: ブラウザ環境でのグローバル公開
if (typeof window !== 'undefined') {
  (window as any).DynamicPDFService = DynamicPDFService;
  (window as any).pdfPreload = () => DynamicPDFService.preloadPDFLibraries();
}