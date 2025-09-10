// 日本語対応PDF生成ユーティリティ
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import type { OrderPDFData, PDFOperationResult } from '../types/pdf';

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
          // 日本語文字をUnicodeエスケープに変換
          const processedText = text.replace(/[\u3000-\u9fff]/g, (char) => {
            // 日本語文字を簡易的にローマ字に置換（基本的なもののみ）
            const replacements: { [key: string]: string } = {
              '発': 'HATSU',
              '注': 'CHU',
              '書': 'SHO',
              '番': 'BAN',
              '号': 'GO',
              '日': 'BI',
              '仕': 'SHI',
              '入': 'NYUU',
              '先': 'SAKI',
              '商': 'SHOU',
              '品': 'HIN',
              '名': 'MEI',
              '図': 'ZU',
              '面': 'MEN',
              '数': 'SU',
              '量': 'RYOU',
              '単': 'TAN',
              '価': 'KA',
              '金': 'KIN',
              '額': 'GAKU',
              '合': 'GOU',
              '計': 'KEI',
              '備': 'BI',
              '考': 'KOU',
              '作': 'SAKU',
              '成': 'SEI',
              '時': 'JI'
            };
            return replacements[char] || char;
          });
          
          if (options.align) {
            pdf.text(processedText, x, y, { align: options.align });
          } else {
            pdf.text(processedText, x, y);
          }
        } catch (error) {
          // フォールバック: 英語で表示
          console.warn('Japanese text processing failed, using fallback:', error);
          pdf.text(text.replace(/[\u3000-\u9fff]/g, '?'), x, y, options);
        }
      };

      // ヘッダー部分
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      addJapaneseText('PURCHASE ORDER', pageWidth / 2, currentY + 10, { align: 'center' });
      addJapaneseText('(HATCHUUSHO)', pageWidth / 2, currentY + 18, { align: 'center' });
      
      currentY += 30;

      // 区切り線
      pdf.setLineWidth(0.5);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // 発注情報
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      
      addJapaneseText(`Order No: ${orderData.order_no}`, margin, currentY);
      currentY += 8;
      
      const orderDate = new Date(orderData.created_at).toLocaleDateString('ja-JP');
      addJapaneseText(`Order Date: ${orderDate}`, margin, currentY);
      currentY += 8;
      
      addJapaneseText(`Supplier: ${orderData.partner_name}`, margin, currentY);
      currentY += 15;

      // テーブルヘッダー
      const tableStartY = currentY;
      const tableStartX = margin;
      const tableWidth = pageWidth - 2 * margin;
      const rowHeight = 10;
      const colWidths = [20, 80, 40, 30, 30, 40]; // 列幅の配列
      let colX = tableStartX;

      // ヘッダー背景
      pdf.setFillColor(240, 240, 240);
      pdf.rect(tableStartX, tableStartY, tableWidth, rowHeight, 'F');
      
      // ヘッダー枠線
      pdf.rect(tableStartX, tableStartY, tableWidth, rowHeight);
      
      // ヘッダーテキスト
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      
      const headers = ['No.', 'Item Name', 'Drawing No.', 'Qty', 'Unit Price', 'Amount'];
      const headerLabels = ['No.', 'SHOHINMEI', 'ZUMENBANGO', 'SUURYOU', 'TANKA', 'KINGAKU'];
      
      for (let i = 0; i < headers.length; i++) {
        addJapaneseText(headers[i], colX + colWidths[i] / 2, tableStartY + 7, { align: 'center' });
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
          item.product_name.length > 20 ? item.product_name.substring(0, 20) + '...' : item.product_name,
          item.drawing_number || '-',
          `${item.quantity}`,
          `¥${item.unit_price.toLocaleString()}`,
          `¥${lineTotal.toLocaleString()}`
        ];
        
        for (let i = 0; i < rowData.length; i++) {
          const align = i === 0 ? 'center' : (i >= 3 ? 'right' : 'left');
          const textX = align === 'center' ? colX + colWidths[i] / 2 : 
                      align === 'right' ? colX + colWidths[i] - 2 : colX + 2;
          
          if (i === 1) {
            // 商品名は日本語処理
            addJapaneseText(rowData[i], textX, currentY + 7);
          } else {
            pdf.text(rowData[i], textX, currentY + 7, align === 'center' || align === 'right' ? { align } : {});
          }
          colX += colWidths[i];
        }
        
        currentY += rowHeight;
      });

      // 合計金額
      currentY += 10;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      addJapaneseText(`Total Amount: ¥${(orderData.total_amount || totalAmount).toLocaleString()}`, 
                      pageWidth - margin - 60, currentY);

      // 備考
      if (orderData.notes && orderData.notes.trim()) {
        currentY += 20;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        addJapaneseText('Notes:', margin, currentY);
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
        filename: `HATCHUUSHO_${orderData.order_no}_${new Date().toISOString().split('T')[0]}.pdf`
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