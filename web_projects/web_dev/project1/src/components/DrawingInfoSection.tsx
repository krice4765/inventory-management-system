/**
 * Phase F2: 図面管理システム
 * 図面情報表示・編集コンポーネント
 * 商品マスター、発注フォームで使用
 */

import { useState, useRef } from 'react';
import { FileText, Upload, Download, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  uploadProductDrawing,
  uploadPurchaseOrderDrawing,
  deleteDrawingFile,
  getDrawingFileUrl,
  downloadDrawingFile,
} from '../utils/drawingFileManager';

interface DrawingInfo {
  drawing_number?: string | null;
  drawing_revision?: string | null;
  drawing_name?: string | null;
  drawing_notes?: string | null;
  drawing_file_path?: string | null;
  drawing_file_name?: string | null;
}

interface DrawingInfoSectionProps {
  // 図面情報データ
  drawingInfo: DrawingInfo;
  // 図面情報更新コールバック
  onDrawingInfoChange: (info: DrawingInfo) => void;
  // アップロード対象のID（product_id または purchase_order_id）
  targetId?: string;
  // アップロード種別
  uploadType: 'product' | 'purchase_order';
  // 編集可能フラグ
  readOnly?: boolean;
  // タイトル
  title?: string;
}

export default function DrawingInfoSection({
  drawingInfo,
  onDrawingInfoChange,
  targetId,
  uploadType,
  readOnly = false,
  title = '図面情報',
}: DrawingInfoSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 図面情報フィールド更新
  const handleFieldChange = (field: keyof DrawingInfo, value: string) => {
    onDrawingInfoChange({
      ...drawingInfo,
      [field]: value,
    });
  };

  // PDFファイルアップロード
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetId) return;

    setUploading(true);

    try {
      // アップロード実行
      const uploadFn =
        uploadType === 'product'
          ? uploadProductDrawing
          : uploadPurchaseOrderDrawing;

      const result = await uploadFn(targetId, file);

      if (!result.success) {
        toast.error(result.error || 'アップロードに失敗しました');
        return;
      }

      // 図面情報を更新
      onDrawingInfoChange({
        ...drawingInfo,
        drawing_file_path: result.filePath,
        drawing_file_name: file.name,
      });

      toast.success('図面PDFをアップロードしました');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('アップロード中にエラーが発生しました');
    } finally {
      setUploading(false);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // PDFファイル削除
  const handleFileDelete = async () => {
    if (!drawingInfo.drawing_file_path) return;

    if (!confirm('図面PDFを削除しますか？')) return;

    try {
      const result = await deleteDrawingFile(drawingInfo.drawing_file_path);

      if (!result.success) {
        toast.error(result.error || '削除に失敗しました');
        return;
      }

      // 図面ファイル情報をクリア
      onDrawingInfoChange({
        ...drawingInfo,
        drawing_file_path: null,
        drawing_file_name: null,
      });

      toast.success('図面PDFを削除しました');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('削除中にエラーが発生しました');
    }
  };

  // PDF プレビュー表示
  const handlePreview = async () => {
    if (!drawingInfo.drawing_file_path) return;

    try {
      const result = await getDrawingFileUrl(drawingInfo.drawing_file_path);

      if (!result.url) {
        toast.error(result.error || 'プレビューURLの取得に失敗しました');
        return;
      }

      setPreviewUrl(result.url);
      setShowPreview(true);
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('プレビュー表示中にエラーが発生しました');
    }
  };

  // PDFダウンロード
  const handleDownload = async () => {
    if (!drawingInfo.drawing_file_path || !drawingInfo.drawing_file_name) return;

    try {
      const result = await downloadDrawingFile(
        drawingInfo.drawing_file_path,
        drawingInfo.drawing_file_name
      );

      if (!result.success) {
        toast.error(result.error || 'ダウンロードに失敗しました');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('ダウンロード中にエラーが発生しました');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 図番 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            図番
          </label>
          <input
            type="text"
            value={drawingInfo.drawing_number || ''}
            onChange={(e) => handleFieldChange('drawing_number', e.target.value)}
            disabled={readOnly}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="例: DRW-001"
          />
        </div>

        {/* リビジョン */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            リビジョン
          </label>
          <input
            type="text"
            value={drawingInfo.drawing_revision || ''}
            onChange={(e) => handleFieldChange('drawing_revision', e.target.value)}
            disabled={readOnly}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="例: Rev.A"
          />
        </div>

        {/* 図面名称 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            図面名称
          </label>
          <input
            type="text"
            value={drawingInfo.drawing_name || ''}
            onChange={(e) => handleFieldChange('drawing_name', e.target.value)}
            disabled={readOnly}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="例: フレーム組立図"
          />
        </div>

        {/* 備考 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            備考
          </label>
          <textarea
            value={drawingInfo.drawing_notes || ''}
            onChange={(e) => handleFieldChange('drawing_notes', e.target.value)}
            disabled={readOnly}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="図面に関する注意事項など"
          />
        </div>

        {/* PDFファイル管理 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            図面PDFファイル
          </label>

          {drawingInfo.drawing_file_path ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <FileText className="w-5 h-5 text-red-600" />
              <span className="flex-1 text-sm truncate">
                {drawingInfo.drawing_file_name}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                  title="プレビュー"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-2 text-green-600 hover:bg-green-50 rounded transition"
                  title="ダウンロード"
                >
                  <Download className="w-4 h-4" />
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleFileDelete}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              {!readOnly && targetId && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="drawing-file-upload"
                  />
                  <label
                    htmlFor="drawing-file-upload"
                    className={`
                      flex items-center justify-center gap-2 px-4 py-3
                      border-2 border-dashed border-gray-300 rounded-lg
                      cursor-pointer hover:border-blue-500 hover:bg-blue-50
                      transition ${uploading ? 'opacity-50 pointer-events-none' : ''}
                    `}
                  >
                    <Upload className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {uploading ? 'アップロード中...' : 'PDFファイルを選択'}
                    </span>
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    ※ PDFファイルのみ、最大10MBまで
                  </p>
                </>
              )}
              {!targetId && !readOnly && (
                <p className="text-sm text-gray-500 p-3 bg-yellow-50 rounded">
                  保存後にPDFをアップロードできます
                </p>
              )}
              {readOnly && (
                <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded">
                  ファイルなし
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PDFプレビューモーダル */}
      {showPreview && previewUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">図面プレビュー</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={previewUrl}
                className="w-full h-full min-h-[600px]"
                title="図面PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
