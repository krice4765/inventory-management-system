import { describe, it, expect } from 'vitest';
import {
  paymentFormSchema,
  productFormSchema,
  partnerFormSchema,
  orderFormSchema,
  getErrorMessage,
  type PaymentFormData,
  type ProductFormData,
  type PartnerFormData,
  type OrderFormData,
} from './validations';
import { z } from 'zod';

describe('validations', () => {
  describe('paymentFormSchema', () => {
    const validData: PaymentFormData = {
      payment_date: '2025-01-01',
      payment_method_cash: 10000,
      payment_method_check: 0,
      payment_method_note: 0,
      payment_method_bank_transfer: 0,
      payment_method_offset: 0,
      discount_amount: 0,
      other_amount: 0,
      transaction_fee: 0,
      issuing_bank_name: '',
      payee_bank_name: '',
    };

    it('should accept valid payment data', () => {
      expect(paymentFormSchema.safeParse(validData).success).toBe(true);
    });

    it('should reject when all payment methods are zero', () => {
      const data = { ...validData, payment_method_cash: 0 };
      expect(paymentFormSchema.safeParse(data).success).toBe(false);
    });

    it('should reject negative amounts', () => {
      const data = { ...validData, payment_method_cash: -1000 };
      expect(paymentFormSchema.safeParse(data).success).toBe(false);
    });

    it('should reject future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const data = { ...validData, payment_date: future.toISOString().split('T')[0] };
      expect(paymentFormSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('productFormSchema', () => {
    const validData: ProductFormData = {
      product_name: 'Test Product',
      product_code: 'TEST-001',
      category: 'Category A',
      unit: 'pcs',
      tax_category: 'standard_10',
      standard_cost: 1000,
      selling_price: 1500,
      current_stock: 100,
      min_stock_level: 10,
      drawing_number: '',
      drawing_revision: '',
      drawing_name: '',
      drawing_notes: '',
      drawing_file_path: '',
      drawing_file_name: '',
    };

    it('should accept valid product data', () => {
      expect(productFormSchema.safeParse(validData).success).toBe(true);
    });

    it('should reject empty product name', () => {
      const data = { ...validData, product_name: '' };
      expect(productFormSchema.safeParse(data).success).toBe(false);
    });

    it('should accept valid product codes', () => {
      ['ABC-123', 'TEST001', 'A-B-C'].forEach((code) => {
        expect(productFormSchema.safeParse({ ...validData, product_code: code }).success).toBe(true);
      });
    });

    it('should reject invalid product codes', () => {
      ['test-001', 'ABC_123', 'ABC 123'].forEach((code) => {
        expect(productFormSchema.safeParse({ ...validData, product_code: code }).success).toBe(false);
      });
    });

    it('should reject non-integer stock quantities', () => {
      const data = { ...validData, current_stock: 10.5 };
      expect(productFormSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('partnerFormSchema', () => {
    const validData: PartnerFormData = {
      partner_code: 'PARTNER-001',
      name: 'Test Partner',
      partner_type: 'supplier',
      contact_person: 'John Doe',
      email: 'test@example.com',
      phone: '03-1234-5678',
      fax: '',
      address: 'Tokyo',
      payment_terms: 'Monthly',
      closing_day: 31,
      payment_day: 31,
      payment_month_offset: 1,
      bank_name: '',
      branch_name: '',
      account_number: '',
      account_holder: '',
    };

    it('should accept valid partner data', () => {
      expect(partnerFormSchema.safeParse(validData).success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const data = { ...validData, email: 'invalid-email' };
      expect(partnerFormSchema.safeParse(data).success).toBe(false);
    });

    it('should validate closing_day range (0-31)', () => {
      expect(partnerFormSchema.safeParse({ ...validData, closing_day: -1 }).success).toBe(false);
      expect(partnerFormSchema.safeParse({ ...validData, closing_day: 32 }).success).toBe(false);
      expect(partnerFormSchema.safeParse({ ...validData, closing_day: 15 }).success).toBe(true);
    });

    it('should validate payment_month_offset range (0-3)', () => {
      expect(partnerFormSchema.safeParse({ ...validData, payment_month_offset: -1 }).success).toBe(false);
      expect(partnerFormSchema.safeParse({ ...validData, payment_month_offset: 4 }).success).toBe(false);
      expect(partnerFormSchema.safeParse({ ...validData, payment_month_offset: 2 }).success).toBe(true);
    });
  });

  describe('orderFormSchema', () => {
    const validData: OrderFormData = {
      partner_id: '123e4567-e89b-12d3-a456-426614174000',
      assigned_user_id: '123e4567-e89b-12d3-a456-426614174001',
      order_date: '2025-01-01',
      delivery_deadline: '2025-01-15',
      memo: 'Test memo',
      notes: 'Test notes',
      items: [{
        product_id: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 10,
        unit_price: 1000,
        total_amount: 10000,
      }],
      shipping_cost: 500,
      shipping_tax_rate: 0.1,
    };

    it('should accept valid order data', () => {
      expect(orderFormSchema.safeParse(validData).success).toBe(true);
    });

    it('should require at least one item', () => {
      const data = { ...validData, items: [] };
      expect(orderFormSchema.safeParse(data).success).toBe(false);
    });

    it('should validate delivery deadline is after order date', () => {
      const data = {
        ...validData,
        order_date: '2025-01-15',
        delivery_deadline: '2025-01-10',
      };
      expect(orderFormSchema.safeParse(data).success).toBe(false);
    });

    it('should accept optional delivery deadline', () => {
      const data = { ...validData, delivery_deadline: '' };
      expect(orderFormSchema.safeParse(data).success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const data = { ...validData, partner_id: 'invalid-uuid' };
      expect(orderFormSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from ZodError', () => {
      const schema = z.object({ name: z.string().min(1, 'Custom error') });
      const result = schema.safeParse({ name: '' });
      if (!result.success) {
        expect(getErrorMessage(result.error)).toBe('Custom error');
      }
    });

    it('should extract message from Error', () => {
      const error = new Error('Test error');
      expect(getErrorMessage(error)).toBe('Test error');
    });

    it('should return default message for unknown error', () => {
      expect(getErrorMessage('string error')).toContain('不明なエラー');
    });

    it('should return default message for empty ZodError', () => {
      const zodError = new z.ZodError([]);
      expect(getErrorMessage(zodError)).toBe('バリデーションエラー');
    });
  });
});
