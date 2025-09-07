import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import type { OrderPDFData, PDFOperationResult } from '../types/pdf';
import { safeYenFormat, safeDateFormat, safeStringFormat } from './safeFormatters';

export class OrderPDFGenerator {
  /**
   * 富士精工様向け発注書PDFの生成（高品質版）
   */
  static async generateOrderPDF(orderData: OrderPDFData): Promise<PDFOperationResult> {
    try {
      const pdf = new jsPDF();
      
      // フォント設定
      pdf.setFont('helvetica');
      
      // ヘッダー部分
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('発 注 書', 105, 25, { align: 'center' });
      
      // 罫線
      pdf.setLineWidth(0.5);
      pdf.line(20, 30, 190, 30);
      
      // 発注情報
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      const startY = 45;
      
      pdf.text(`発注番号: ${safeStringFormat(orderData.order_no)}`, 20, startY);
      pdf.text(`発注日: ${safeDateFormat(orderData.created_at)}`, 20, startY + 10);
      pdf.text(`仕入先: ${safeStringFormat(orderData.partner_name)}`, 20, startY + 20);
      
      // 明細テーブルヘッダー
      const tableStartY = startY + 40;
      pdf.setFontSize(10);
      
      // テーブル枠線とヘッダー背景
      pdf.setFillColor(240, 240, 240);
      pdf.rect(15, tableStartY - 5, 180, 12, 'F');
      pdf.rect(15, tableStartY - 5, 180, 12);
      
      // ヘッダーテキスト
      pdf.setFont('helvetica', 'bold');
      pdf.text('No.', 20, tableStartY + 3);
      pdf.text('商品名', 35, tableStartY + 3);
      pdf.text('図面番号', 100, tableStartY + 3);
      pdf.text('数量', 140, tableStartY + 3);
      pdf.text('単価', 160, tableStartY + 3);
      pdf.text('金額', 180, tableStartY + 3);
      
      // 明細行
      pdf.setFont('helvetica', 'normal');
      let yPosition = tableStartY + 15;
      let totalAmount = 0;
      
      orderData.items.forEach((item, index) => {
        const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
        totalAmount += lineTotal;
        
        // 行の枠線
        pdf.rect(15, yPosition - 3, 180, 10);
        
        // データ
        pdf.text(`${index + 1}`, 20, yPosition + 2);
        
        // 商品名の長さ調整
        const productName = safeStringFormat(item.product_name);
        const truncatedName = productName.length > 30 ? 
          productName.substring(0, 30) + '...' : productName;
        pdf.text(truncatedName, 35, yPosition + 2);
        
        pdf.text(safeStringFormat(item.drawing_number), 100, yPosition + 2);
        pdf.text(`${item.quantity || 0}`, 140, yPosition + 2);
        pdf.text(safeYenFormat(item.unit_price), 160, yPosition + 2);
        pdf.text(safeYenFormat(lineTotal), 180, yPosition + 2);
        
        yPosition += 10;
      });
      
      // 合計金額
      yPosition += 10;
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`合計金額: ${safeYenFormat(orderData.total_amount || totalAmount)}`, 140, yPosition);
      
      // 備考
      if (orderData.notes) {
        yPosition += 20;
        pdf.setFont('helvetica', 'normal');
        pdf.text('備考:', 20, yPosition);
        
        // 備考の改行処理
        const noteLines = pdf.splitTextToSize(safeStringFormat(orderData.notes), 170);
        pdf.text(noteLines, 20, yPosition + 10);
      }
      
      // フッター
      const pageHeight = pdf.internal.pageSize.height;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`作成日時: ${new Date().toLocaleString('ja-JP')}`, 20, pageHeight - 10);
      
      const pdfBlob = pdf.output('blob');
      
      return {
        success: true,
        pdfBlob,
        filename: `発注書_${orderData.order_no}.pdf`
      };
      
    } catch (error) {
      console.error('PDF生成エラー:', error);
      return {
        success: false,
        error: `PDF生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * 図面PDFと発注書PDFの結合（富士精工様要件）
   */
  static async attachDrawingsToPDF(
    orderPDF: Blob, 
    drawingPDFs: Blob[]
  ): Promise<PDFOperationResult> {
    try {
      if (drawingPDFs.length === 0) {
        return {
          success: true,
          pdfBlob: orderPDF,
          attachedDrawings: 0
        };
      }
      
      const orderDoc = await PDFDocument.load(await orderPDF.arrayBuffer());
      let attachedCount = 0;
      
      // 各図面PDFを結合
      for (const drawingPDF of drawingPDFs) {
        try {
          const drawingDoc = await PDFDocument.load(await drawingPDF.arrayBuffer());
          const copiedPages = await orderDoc.copyPages(drawingDoc, drawingDoc.getPageIndices());
          
          copiedPages.forEach(page => {
            orderDoc.addPage(page);
          });
          
          attachedCount++;
        } catch (drawingError) {
          console.warn('個別図面PDF結合エラー（スキップして続行）:', drawingError);
        }
      }
      
      const pdfBytes = await orderDoc.save();
      const combinedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      return {
        success: true,
        pdfBlob: combinedBlob,
        attachedDrawings: attachedCount
      };
      
    } catch (error) {
      console.error('PDF結合エラー:', error);
      return {
        success: false,
        error: `PDF結合に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * PDFファイルのダウンロード
   */
  static downloadPDF(pdfBlob: Blob, filename: string): void {
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
      console.error('PDFダウンロードエラー:', error);
      alert('PDFのダウンロードに失敗しました');
    }
  }
}

/**
 * パフォーマンス監視付きPDF操作
 */
export class PDFPerformanceMonitor {
  static async measureOperation<T>(
    operation: () => Promise<T>,
    operationType: string
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      console.log(`PDF操作完了: ${operationType}, 実行時間: ${duration.toFixed(2)}ms`);
      
      // 5秒以上かかった場合は警告
      if (duration > 5000) {
        console.warn(`PDF操作が遅延: ${operationType}, ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`PDF操作エラー: ${operationType}, 実行時間: ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }
}