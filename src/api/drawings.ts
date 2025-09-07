import { supabase } from '../lib/supabase';
import type { Drawing, DrawingUploadResult } from '../types/pdf';

export class DrawingAPI {
  /**
   * 図面一覧取得（エラーハンドリング強化版）
   */
  static async getDrawings(): Promise<Drawing[]> {
    try {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('is_active', true)
        .order('drawing_number', { ascending: true });
      
      if (error) {
        console.error('図面一覧取得エラー:', error);
        throw new Error(`図面一覧の取得に失敗しました: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error('図面一覧取得処理エラー:', error);
      throw error;
    }
  }
  
  /**
   * 図面番号による検索
   */
  static async getDrawingByNumber(drawingNumber: string): Promise<Drawing | null> {
    try {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('drawing_number', drawingNumber)
        .eq('is_active', true)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // 見つからない場合
        }
        console.error('図面検索エラー:', error);
        throw new Error(`図面の検索に失敗しました: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('図面検索処理エラー:', error);
      if (error instanceof Error && error.message.includes('PGRST116')) {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * 図面PDFアップロード（包括的エラーハンドリング）
   */
  static async uploadDrawing(
    file: File,
    drawingNumber: string,
    drawingName?: string
  ): Promise<DrawingUploadResult> {
    // バリデーション
    if (!file) {
      return { success: false, error: 'ファイルが選択されていません' };
    }
    
    if (!drawingNumber?.trim()) {
      return { success: false, error: '図面番号は必須です' };
    }
    
    // ファイルサイズチェック（50MB制限）
    if (file.size > 50 * 1024 * 1024) {
      return { success: false, error: 'ファイルサイズが50MBを超えています' };
    }
    
    // ファイル形式チェック
    if (file.type !== 'application/pdf') {
      return { success: false, error: 'PDFファイルのみアップロード可能です' };
    }
    
    try {
      // 重複チェック
      const existingDrawing = await this.getDrawingByNumber(drawingNumber);
      if (existingDrawing) {
        return { success: false, error: '同じ図面番号が既に存在します' };
      }
      
      // Supabase Storageにアップロード
      const filePath = `${drawingNumber}/${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('drawings')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false // 重複を許可しない
        });
      
      if (uploadError) {
        console.error('ファイルアップロードエラー:', uploadError);
        return { success: false, error: `ファイルのアップロードに失敗しました: ${uploadError.message}` };
      }
      
      // drawingsテーブルに記録
      const { data: drawingData, error: dbError } = await supabase
        .from('drawings')
        .insert({
          drawing_number: drawingNumber.trim(),
          drawing_name: drawingName?.trim() || file.name.replace('.pdf', ''),
          file_path: uploadData.path,
          file_size: file.size,
          mime_type: file.type,
          version: '1.0',
          is_active: true
        })
        .select()
        .single();
      
      if (dbError) {
        // ロールバック: アップロードしたファイルを削除
        await supabase.storage.from('drawings').remove([uploadData.path]);
        console.error('データベース登録エラー:', dbError);
        return { success: false, error: `データベースへの登録に失敗しました: ${dbError.message}` };
      }
      
      return {
        success: true,
        drawing: drawingData,
        uploadedPath: uploadData.path
      };
      
    } catch (error) {
      console.error('図面アップロード処理エラー:', error);
      return {
        success: false,
        error: `予期しないエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * 図面PDFダウンロード用署名付きURL取得
   */
  static async getSignedURL(filePath: string): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from('drawings')
        .createSignedUrl(filePath, 3600); // 1時間有効
      
      if (error) {
        console.error('署名付きURL生成エラー:', error);
        throw new Error(`ダウンロードURLの生成に失敗しました: ${error.message}`);
      }
      
      return data.signedUrl;
    } catch (error) {
      console.error('署名付きURL取得処理エラー:', error);
      throw error;
    }
  }
  
  /**
   * 図面PDFの直接取得（Blob）
   */
  static async getDrawingPDF(filePath: string): Promise<Blob> {
    try {
      const { data, error } = await supabase.storage
        .from('drawings')
        .download(filePath);
      
      if (error) {
        console.error('図面PDFダウンロードエラー:', error);
        throw new Error(`図面PDFの取得に失敗しました: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('図面PDFダウンロード処理エラー:', error);
      throw error;
    }
  }
  
  /**
   * 複数図面番号による一括取得
   */
  static async getDrawingsByNumbers(drawingNumbers: string[]): Promise<Drawing[]> {
    if (drawingNumbers.length === 0) return [];
    
    try {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .in('drawing_number', drawingNumbers)
        .eq('is_active', true);
      
      if (error) {
        console.error('複数図面取得エラー:', error);
        throw new Error(`図面の一括取得に失敗しました: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error('複数図面取得処理エラー:', error);
      throw error;
    }
  }
}