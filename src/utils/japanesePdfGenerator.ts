// 日本語対応PDF生成ユーティリティ
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import type { OrderPDFData, DeliveryNotePDFData, PDFOperationResult } from '../types/pdf';

export class JapanesePDFGenerator {
  /**
   * 日本語対応の発注書PDF生成
   */
  static async generateOrderPDF(orderData: OrderPDFData): Promise<PDFOperationResult> {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // 基本設定
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      let currentY = margin;

      // フォント設定（日本語対応のため、シンプルなアプローチを使用）
      pdf.setFont('helvetica');
      
      // 日本語テキストを安全に処理する関数
      const addJapaneseText = (text: string, x: number, y: number, options: any = {}) => {
        try {
          // 日本語文字を直接表示（より自然な表示）
          if (options.align) {
            pdf.text(text, x, y, { align: options.align });
          } else {
            pdf.text(text, x, y);
          }
        } catch (error) {
          // フォールバック: 英語表示
          console.warn('Japanese text processing failed, using fallback:', error);
          const fallbackText = text.replace(/[\u3000-\u9fff]/g, '?');
          if (options.align) {
            pdf.text(fallbackText, x, y, { align: options.align });
          } else {
            pdf.text(fallbackText, x, y);
          }
        }
      };

      // ヘッダー部分
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      addJapaneseText('発注書 / PURCHASE ORDER', pageWidth / 2, currentY + 10, { align: 'center' });
      pdf.setFontSize(16);
      addJapaneseText('(HATCHUUSHO)', pageWidth / 2, currentY + 18, { align: 'center' });
      
      currentY += 30;

      // 区切り線
      pdf.setLineWidth(0.5);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // 発注情報
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      
      addJapaneseText(`発注番号 / Order No: ${orderData.order_no}`, margin, currentY);
      currentY += 8;
      
      const orderDate = new Date(orderData.created_at).toLocaleDateString('ja-JP');
      addJapaneseText(`発注日 / Order Date: ${orderDate}`, margin, currentY);
      currentY += 8;
      
      addJapaneseText(`仕入先 / Supplier: ${orderData.partner_name}`, margin, currentY);
      currentY += 15;

      // テーブルヘッダー
      const tableStartY = currentY;
      const tableStartX = margin;
      const tableWidth = pageWidth - 2 * margin;
      const rowHeight = 12; // 行の高さを少し増やす
      const colWidths = [15, 75, 35, 25, 30, 35]; // 列幅を調整（Unit Price, Amountを広く）
      let colX = tableStartX;

      // ヘッダー背景
      pdf.setFillColor(240, 240, 240);
      pdf.rect(tableStartX, tableStartY, tableWidth, rowHeight, 'F');
      
      // ヘッダー枠線
      pdf.rect(tableStartX, tableStartY, tableWidth, rowHeight);
      
      // ヘッダーテキスト
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      
      const headers = ['No.', '商品名\nItem Name', '図面番号\nDrawing No.', '数量\nQty', '単価\nUnit Price', '金額\nAmount'];
      
      for (let i = 0; i < headers.length; i++) {
        const lines = headers[i].split('\n');
        if (lines.length > 1) {
          // 日本語と英語の2行表示
          addJapaneseText(lines[0], colX + colWidths[i] / 2, tableStartY + 4, { align: 'center' });
          pdf.setFontSize(7);
          pdf.text(lines[1], colX + colWidths[i] / 2, tableStartY + 9, { align: 'center' });
          pdf.setFontSize(9);
        } else {
          addJapaneseText(headers[i], colX + colWidths[i] / 2, tableStartY + 7, { align: 'center' });
        }
        colX += colWidths[i];
      }
      
      currentY += rowHeight;

      // 明細行
      pdf.setFont('helvetica', 'normal');
      let totalAmount = 0;

      orderData.items.forEach((item, index) => {
        const lineTotal = item.quantity * item.unit_price;
        totalAmount += lineTotal;
        
        // 行の枠線
        pdf.rect(tableStartX, currentY, tableWidth, rowHeight);
        
        // データ行
        colX = tableStartX;
        const rowData = [
          `${index + 1}`,
          item.product_name.length > 25 ? item.product_name.substring(0, 25) + '...' : item.product_name,
          item.drawing_number || '-',
          `${item.quantity}`,
          `¥${item.unit_price.toLocaleString()}`,
          `¥${lineTotal.toLocaleString()}`
        ];
        
        for (let i = 0; i < rowData.length; i++) {
          const align = i === 0 ? 'center' : (i >= 3 ? 'right' : 'left');
          const textX = align === 'center' ? colX + colWidths[i] / 2 : 
                      align === 'right' ? colX + colWidths[i] - 3 : colX + 3;
          
          if (i === 1) {
            // 商品名は日本語処理
            addJapaneseText(rowData[i], textX, currentY + 8);
          } else {
            pdf.setFontSize(9);
            pdf.text(rowData[i], textX, currentY + 8, align === 'center' || align === 'right' ? { align } : {});
          }
          colX += colWidths[i];
        }
        
        currentY += rowHeight;
      });

      // 合計金額
      currentY += 10;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      addJapaneseText(`合計金額 / Total Amount: ¥${(orderData.total_amount || totalAmount).toLocaleString()}`, 
                      pageWidth - margin - 80, currentY);

      // 備考
      if (orderData.notes && orderData.notes.trim()) {
        currentY += 20;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        addJapaneseText('備考 / Notes:', margin, currentY);
        currentY += 8;
        
        // 備考の改行処理
        const noteLines = pdf.splitTextToSize(orderData.notes, pageWidth - 2 * margin);
        noteLines.forEach((line: string) => {
          addJapaneseText(line, margin, currentY);
          currentY += 6;
        });
      }

      // フッター
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const footerText = `Generated: ${new Date().toLocaleString('ja-JP')}`;
      addJapaneseText(footerText, margin, pageHeight - 15);

      const pdfBlob = pdf.output('blob');
      
      return {
        success: true,
        pdfBlob,
        filename: `発注書_${orderData.order_no}_${new Date().toISOString().split('T')[0]}.pdf`
      };
      
    } catch (error) {
      console.error('Japanese PDF generation error:', error);
      return {
        success: false,
        error: `PDF生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 日本語対応の納品書PDF生成
   */
  static async generateDeliveryNotePDF(deliveryData: DeliveryNotePDFData): Promise<PDFOperationResult> {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // 基本設定
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      let currentY = margin;

      // フォント設定（発注書と同じ日本語対応）
      pdf.setFont('helvetica');
      
      // 日本語テキストを安全に処理する関数（再利用）
      const addJapaneseText = (text: string, x: number, y: number, options: any = {}) => {
        try {
          // 日本語文字を直接表示（より自然な表示）
          if (options.align) {
            pdf.text(text, x, y, { align: options.align });
          } else {
            pdf.text(text, x, y);
          }
        } catch (error) {
          // フォールバック: 英語表示
          console.warn('Japanese text processing failed, using fallback:', error);
          const fallbackText = text.replace(/[\u3000-\u9fff]/g, '?');
          if (options.align) {
            pdf.text(fallbackText, x, y, { align: options.align });
          } else {
            pdf.text(fallbackText, x, y);
          }
        }
      };

      // ヘッダー部分
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      addJapaneseText('納品書 / DELIVERY NOTE', pageWidth / 2, currentY + 10, { align: 'center' });
      pdf.setFontSize(16);
      addJapaneseText('(NOUHINNSHO)', pageWidth / 2, currentY + 18, { align: 'center' });
      
      currentY += 30;

      // 区切り線
      pdf.setLineWidth(0.5);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // 納品情報
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      
      addJapaneseText(`納品番号 / Delivery No: ${deliveryData.delivery_no}`, margin, currentY);
      currentY += 8;
      
      const deliveryDate = new Date(deliveryData.delivery_date).toLocaleDateString('ja-JP');
      addJapaneseText(`納品日 / Delivery Date: ${deliveryDate}`, margin, currentY);
      currentY += 8;
      
      addJapaneseText(`関連発注 / Related Order: ${deliveryData.order_no}`, margin, currentY);
      currentY += 8;
      
      addJapaneseText(`分納回次 / Delivery Sequence: 第${deliveryData.delivery_sequence}回目`, margin, currentY);
      currentY += 8;
      
      addJapaneseText(`仕入先 / Supplier: ${deliveryData.partner_name}`, margin, currentY);
      currentY += 15;

      // テーブルヘッダー
      const tableStartY = currentY;
      const tableStartX = margin;
      const tableWidth = pageWidth - 2 * margin;
      const rowHeight = 12;
      const colWidths = [15, 65, 35, 25, 25, 30, 35]; // 納品書用に列幅調整
      let colX = tableStartX;

      // ヘッダー背景
      pdf.setFillColor(240, 240, 240);
      pdf.rect(tableStartX, tableStartY, tableWidth, rowHeight, 'F');
      
      // ヘッダー枠線
      pdf.rect(tableStartX, tableStartY, tableWidth, rowHeight);
      
      // ヘッダーテキスト
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      
      const headers = ['No.', '商品名\nItem Name', '商品コード\nCode', '図面番号\nDrawing', '納品数\nDelivered', '単価\nUnit Price', '金額\nAmount'];
      
      for (let i = 0; i < headers.length; i++) {
        const lines = headers[i].split('\n');
        if (lines.length > 1) {
          // 日本語と英語の2行表示
          addJapaneseText(lines[0], colX + colWidths[i] / 2, tableStartY + 4, { align: 'center' });
          pdf.setFontSize(7);
          pdf.text(lines[1], colX + colWidths[i] / 2, tableStartY + 9, { align: 'center' });
          pdf.setFontSize(9);
        } else {
          addJapaneseText(headers[i], colX + colWidths[i] / 2, tableStartY + 7, { align: 'center' });
        }
        colX += colWidths[i];
      }
      
      currentY += rowHeight;

      // 明細行
      pdf.setFont('helvetica', 'normal');
      let _totalAmount = 0;

      deliveryData.items.forEach((item, index) => {
        _totalAmount += item.total_amount;
        
        // 行の枠線
        pdf.rect(tableStartX, currentY, tableWidth, rowHeight);
        
        // データ行
        colX = tableStartX;
        const rowData = [
          `${index + 1}`,
          item.product_name.length > 20 ? item.product_name.substring(0, 20) + '...' : item.product_name,
          item.product_code || '-',
          item.drawing_number || '-',
          `${item.delivered_quantity}`,
          `¥${item.unit_price.toLocaleString()}`,
          `¥${item.total_amount.toLocaleString()}`
        ];
        
        for (let i = 0; i < rowData.length; i++) {
          const align = i === 0 ? 'center' : (i >= 4 ? 'right' : 'left');
          const textX = align === 'center' ? colX + colWidths[i] / 2 : 
                      align === 'right' ? colX + colWidths[i] - 3 : colX + 3;
          
          if (i === 1) {
            // 商品名は日本語処理
            addJapaneseText(rowData[i], textX, currentY + 8);
          } else {
            pdf.setFontSize(9);
            pdf.text(rowData[i], textX, currentY + 8, align === 'center' || align === 'right' ? { align } : {});
          }
          colX += colWidths[i];
        }
        
        currentY += rowHeight;
      });

      // 合計金額
      currentY += 10;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      addJapaneseText(`納品合計 / Total Delivery Amount: ¥${deliveryData.total_amount.toLocaleString()}`, 
                      pageWidth - margin - 90, currentY);

      // 備考
      if (deliveryData.notes && deliveryData.notes.trim()) {
        currentY += 20;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        addJapaneseText('Notes:', margin, currentY);
        currentY += 8;
        
        // 備考の改行処理
        const noteLines = pdf.splitTextToSize(deliveryData.notes, pageWidth - 2 * margin);
        noteLines.forEach((line: string) => {
          addJapaneseText(line, margin, currentY);
          currentY += 6;
        });
      }

      // 分納情報
      currentY += 15;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      addJapaneseText(`※ 発注番号 ${deliveryData.order_no} の第${deliveryData.delivery_sequence}回目分納`, margin, currentY);

      // フッター
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const footerText = `Generated: ${new Date().toLocaleString('ja-JP')}`;
      addJapaneseText(footerText, margin, pageHeight - 15);

      const pdfBlob = pdf.output('blob');
      
      return {
        success: true,
        pdfBlob,
        filename: `納品書_${deliveryData.delivery_no}_${new Date().toISOString().split('T')[0]}.pdf`
      };
      
    } catch (error) {
      console.error('Delivery note PDF generation error:', error);
      return {
        success: false,
        error: `納品書PDF生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * PDFファイルのダウンロード
   */
  static downloadPDF(pdfBlob: Blob, filename: string): void {
    try {
      saveAs(pdfBlob, filename);
    } catch (error) {
      console.error('PDF download error:', error);
      alert('PDFのダウンロードに失敗しました');
    }
  }
}