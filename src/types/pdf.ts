// 富士精工様向けPDF管理システム - 包括的型定義

export interface Drawing {
  id: string;
  drawing_number: string;
  drawing_name: string | null;
  version: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface PurchaseOrderAttachment {
  id: string;
  purchase_order_id: string;
  attachment_type: 'order_pdf' | 'drawing_pdf' | 'specification';
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  drawing_number: string | null;
  uploaded_from: 'web' | 'access';
  created_at: string;
}

export interface PDFGenerationOptions {
  includeDrawings: boolean;
  drawingNumbers: string[];
  outputFormat: 'blob' | 'base64' | 'url';
}

export interface DrawingUploadResult {
  success: boolean;
  drawing?: Drawing;
  error?: string;
  uploadedPath?: string;
}

export interface OrderPDFData {
  id: string;
  order_no: string;
  created_at: string;
  partner_name?: string;
  total_amount: number;
  notes?: string;
  items: Array<{
    product_name: string;
    drawing_number?: string;
    quantity: number;
    unit_price: number;
  }>;
}

export interface DeliveryNotePDFData {
  id: string;
  delivery_no: string;
  delivery_date: string;
  order_no: string;
  partner_name: string;
  delivery_sequence: number;
  total_amount: number;
  notes?: string;
  items: Array<{
    product_name: string;
    product_code: string;
    drawing_number?: string;
    delivered_quantity: number;
    unit_price: number;
    total_amount: number;
  }>;
}

export interface PDFOperationResult {
  success: boolean;
  pdfBlob?: Blob;
  filename?: string;
  attachedDrawings?: number;
  error?: string;
}