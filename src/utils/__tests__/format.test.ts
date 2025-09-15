import { describe, it, expect } from 'vitest'
import { formatCurrency, formatNumber, formatDate } from '../format'

describe('format utilities', () => {
  describe('formatCurrency', () => {
    it('正の数値を正しくフォーマットする', () => {
      expect(formatCurrency(1234)).toBe('￥1,234')
      expect(formatCurrency(1234567)).toBe('￥1,234,567')
    })

    it('ゼロを正しくフォーマットする', () => {
      expect(formatCurrency(0)).toBe('￥0')
    })

    it('負の数値を正しくフォーマットする', () => {
      expect(formatCurrency(-1234)).toBe('-￥1,234')
    })

    it('小数点を正しく処理する', () => {
      expect(formatCurrency(1234.56)).toBe('￥1,235') // 四捨五入
    })

    it('undefinedやnullを安全に処理する', () => {
      expect(formatCurrency(undefined as any)).toBe('￥0')
      expect(formatCurrency(null as any)).toBe('￥0')
      expect(formatCurrency(NaN)).toBe('￥0')
    })
  })

  describe('formatNumber', () => {
    it('数値を正しくフォーマットする', () => {
      expect(formatNumber(1234)).toBe('1,234')
      expect(formatNumber(1234567)).toBe('1,234,567')
    })

    it('ゼロを正しくフォーマットする', () => {
      expect(formatNumber(0)).toBe('0')
    })

    it('小数点を正しく処理する', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56')
    })
  })

  describe('formatDate', () => {
    it('日付文字列を正しくフォーマットする', () => {
      expect(formatDate('2024-01-15')).toBe('2024/01/15')
      expect(formatDate('2024-12-31')).toBe('2024/12/31')
    })

    it('Dateオブジェクトを正しくフォーマットする', () => {
      const date = new Date('2024-01-15')
      expect(formatDate(date)).toBe('2024/01/15')
    })

    it('無効な日付を安全に処理する', () => {
      expect(formatDate('')).toBe('-')
      expect(formatDate(null)).toBe('-')
      expect(formatDate(undefined)).toBe('-')
    })
  })
})