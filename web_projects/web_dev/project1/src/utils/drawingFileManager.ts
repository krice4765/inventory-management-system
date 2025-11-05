/**
 * Phase F2: 図面管理システム
 * PDF図面ファイル管理ユーティリティ
 * Supabase Storageを使用したファイルアップロード/ダウンロード/削除
 */

import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'drawings';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * ファイルバリデーション
 */
export const validateDrawingFile = (file: File): { valid: boolean; error?: string } => {
  // ファイル形式チェック
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'PDFファイルのみアップロード可能です' };
  }

  // ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'ファイルサイズは10MB以下にしてください' };
  }

  return { valid: true };
};

/**
 * 商品の標準図面PDFをアップロード
 */
export const uploadProductDrawing = async (
  productId: string,
  file: File
): Promise<{ success: boolean; filePath?: string; error?: string }> => {
  try {
    // バリデーション
    const validation = validateDrawingFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // ファイル名をサニタイズ
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `products/${productId}/${timestamp}_${sanitizedFileName}`;

    // アップロード
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { success: false, error: 'ファイルのアップロードに失敗しました' };
    }

    return { success: true, filePath };
  } catch (error) {
    console.error('Upload exception:', error);
    return { success: false, error: 'アップロード中にエラーが発生しました' };
  }
};

/**
 * 発注のカスタム図面PDFをアップロード
 */
export const uploadPurchaseOrderDrawing = async (
  orderId: string,
  file: File
): Promise<{ success: boolean; filePath?: string; error?: string }> => {
  try {
    // バリデーション
    const validation = validateDrawingFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // ファイル名をサニタイズ
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `purchase_orders/${orderId}/${timestamp}_${sanitizedFileName}`;

    // アップロード
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { success: false, error: 'ファイルのアップロードに失敗しました' };
    }

    return { success: true, filePath };
  } catch (error) {
    console.error('Upload exception:', error);
    return { success: false, error: 'アップロード中にエラーが発生しました' };
  }
};

/**
 * 図面PDFファイルを削除
 */
export const deleteDrawingFile = async (
  filePath: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return { success: false, error: 'ファイルの削除に失敗しました' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete exception:', error);
    return { success: false, error: '削除中にエラーが発生しました' };
  }
};

/**
 * 図面PDFの公開URLを取得（有効期限付き）
 */
export const getDrawingFileUrl = async (
  filePath: string,
  expiresIn: number = 3600 // デフォルト1時間
): Promise<{ url?: string; error?: string }> => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error || !data?.signedUrl) {
      console.error('URL generation error:', error);
      return { error: 'URLの生成に失敗しました' };
    }

    return { url: data.signedUrl };
  } catch (error) {
    console.error('URL generation exception:', error);
    return { error: 'URL生成中にエラーが発生しました' };
  }
};

/**
 * 図面PDFをダウンロード
 */
export const downloadDrawingFile = async (
  filePath: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filePath);

    if (error || !data) {
      console.error('Download error:', error);
      return { success: false, error: 'ファイルのダウンロードに失敗しました' };
    }

    // Blobからダウンロードリンクを作成
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Download exception:', error);
    return { success: false, error: 'ダウンロード中にエラーが発生しました' };
  }
};
