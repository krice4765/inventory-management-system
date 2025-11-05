import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// 明朝体フォントを読み込んでBase64エンコード
async function loadSerifFont(): Promise<string> {
  const response = await fetch('/fonts/NotoSerifJP-Regular.ttf')
  const blob = await response.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.readAsDataURL(blob)
  })
}

// ゴシック体フォントを読み込んでBase64エンコード
async function loadSansFont(): Promise<string> {
  const response = await fetch('/fonts/NotoSansJP-SemiBold.ttf')
  const blob = await response.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.readAsDataURL(blob)
  })
}

interface PurchaseOrderItem {
  product_name: string
  product_code: string
  quantity: number
  unit_price: number
  total_price: number
}

interface PartnerInfo {
  name: string
  address?: string
  phone?: string
  contact_person?: string
}

interface CompanyInfo {
  name: string
  address: string
  phone: string
  fax?: string
}

interface PurchaseOrderData {
  order_no: string
  order_date: string
  delivery_deadline: string | null
  partner: PartnerInfo
  total_amount: number
  shipping_cost?: number
  shipping_tax_rate?: number
  items: PurchaseOrderItem[]
  notes?: string
  created_by?: string
  company: CompanyInfo
}

export const generatePurchaseOrderPDF = async (orderData: PurchaseOrderData) => {
  const doc = new jsPDF()

  // 日本語フォントを読み込んで追加（明朝体）
  const serifFontData = await loadSerifFont()

  doc.addFileToVFS('NotoSerifJP-Regular.ttf', serifFontData)
  doc.addFont('NotoSerifJP-Regular.ttf', 'NotoSerifJP', 'normal')

  // デフォルトは明朝体
  doc.setFont('NotoSerifJP')

  // 会社情報（データベースから取得）
  const companyInfo = orderData.company

  let yPos = 20

  // ===== ヘッダー: 発注書（中央） =====
  doc.setFont('NotoSerifJP')
  doc.setFontSize(16)
  doc.setTextColor(0, 0, 0)
  doc.text('発注書', 105, yPos, { align: 'center' })

  yPos += 15

  // ===== 左側：宛先「御中」 =====
  doc.setFont('NotoSerifJP')
  doc.setFontSize(11)
  const partnerNameWidth = doc.getTextWidth(orderData.partner.name)
  doc.text(orderData.partner.name, 20, yPos)
  doc.setFontSize(10)
  doc.text('御中', 20 + partnerNameWidth + 2, yPos)

  // ===== 右側：No. と 発注日 =====
  doc.setFont('NotoSerifJP')
  doc.setFontSize(8)
  doc.text('No.', 165, yPos - 2, { align: 'right' })
  doc.setFontSize(9)
  doc.text(orderData.order_no, 190, yPos - 2, { align: 'right' })

  doc.setFontSize(8)
  doc.text('発注日', 165, yPos + 4, { align: 'right' })
  doc.setFontSize(9)
  doc.text(orderData.order_date, 190, yPos + 4, { align: 'right' })

  // ===== 発注者情報（右上） =====
  let rightInfoY = yPos + 12
  doc.setFont('NotoSerifJP')
  doc.setFontSize(9)
  doc.text(companyInfo.name, 190, rightInfoY, { align: 'right' })

  rightInfoY += 4
  doc.setFontSize(7)
  // 住所から〒を除いて表示
  const addressWithoutPostal = companyInfo.address.replace(/^〒\d{3}-\d{4}\s*/, '')
  doc.text(addressWithoutPostal, 190, rightInfoY, { align: 'right' })

  rightInfoY += 3.5
  doc.text(companyInfo.phone, 190, rightInfoY, { align: 'right' })

  rightInfoY += 3.5
  // faxフィールドから「登録番号:」を除いてFAX情報のみ表示
  const faxInfo = companyInfo.fax?.includes('登録番号')
    ? `FAX: ${companyInfo.fax.split('登録番号')[0].replace('FAX:', '').trim()}`.replace('FAX: FAX:', 'FAX:')
    : companyInfo.fax || ''
  if (faxInfo && !faxInfo.includes('登録番号')) {
    doc.text(faxInfo, 190, rightInfoY, { align: 'right' })
  }

  yPos += 30

  // ===== 大きな金額ボックス =====
  const amountBoxWidth = 170
  const amountBoxHeight = 12
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.rect(20, yPos, amountBoxWidth, amountBoxHeight)

  doc.setFont('NotoSerifJP')
  doc.setFontSize(10)
  doc.text('合計金額', 25, yPos + 8)
  doc.setFontSize(12)
  doc.text(`¥${orderData.total_amount.toLocaleString()}-`, 185, yPos + 8, { align: 'right' })

  yPos += 17

  // ===== 但し、お品代、上記の通り... =====
  doc.setFont('NotoSerifJP')
  doc.setFontSize(9)
  // 「但し」の下線
  const tadashiY = yPos
  doc.text('但し', 25, tadashiY)
  doc.setLineWidth(0.5)
  doc.line(25, tadashiY + 0.8, 25 + doc.getTextWidth('但し'), tadashiY + 0.8)

  // 中央に「お品代」の下線
  const osinedaiText = 'お品代'
  const osinedaiWidth = doc.getTextWidth(osinedaiText)
  const centerX = 105
  doc.text(osinedaiText, centerX, tadashiY, { align: 'center' })
  doc.line(centerX - osinedaiWidth / 2, tadashiY + 0.8, centerX + osinedaiWidth / 2, tadashiY + 0.8)

  // 右側に「として」
  doc.text('として', 160, tadashiY)

  yPos += 5
  doc.setFontSize(9)
  doc.text('上記の通り発注いたします。', 25, yPos)

  yPos += 8

  // ===== 商品明細テーブル（背景色付き） =====
  const tableData = orderData.items.map((item) => [
    item.product_name,
    item.quantity.toLocaleString(),
    `¥${item.unit_price.toLocaleString()}`,
    `¥${item.total_price.toLocaleString()}`
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['品目', '数量', '単価', '金額']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'normal',
      fontSize: 8,
      font: 'NotoSerifJP',
      halign: 'center',
      cellPadding: 2,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    bodyStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontSize: 8,
      font: 'NotoSerifJP',
      cellPadding: 2,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' }
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.3
    },
    margin: { left: 20, right: 20 }
  })

  const finalY = (doc as any).lastAutoTable.finalY || yPos

  yPos = finalY + 5

  // ===== 左側：発注情報ボックス（背景色付き） =====
  const infoBoxWidth = 80
  const infoBoxHeight = 21
  const infoBoxX = 20

  doc.setFillColor(245, 245, 245)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.rect(infoBoxX, yPos, infoBoxWidth, infoBoxHeight, 'FD')

  // 横線を2本引いて3つのセクションに分割
  doc.line(infoBoxX, yPos + 7, infoBoxX + infoBoxWidth, yPos + 7)
  doc.line(infoBoxX, yPos + 14, infoBoxX + infoBoxWidth, yPos + 14)

  doc.setFont('NotoSerifJP')
  doc.setFontSize(8)

  // ラベルと値
  doc.text('発注日:', infoBoxX + 2, yPos + 5)
  doc.text(orderData.order_date, infoBoxX + 20, yPos + 5)

  doc.text('発注番号:', infoBoxX + 2, yPos + 12)
  doc.text(orderData.order_no, infoBoxX + 20, yPos + 12)

  doc.text('納期日:', infoBoxX + 2, yPos + 19)
  doc.text(orderData.delivery_deadline || '-', infoBoxX + 20, yPos + 19)

  // ===== 右側：金額詳細ボックス（背景色付き） =====
  const totalBoxWidth = 80
  const totalBoxHeight = 21
  const totalBoxX = infoBoxX + infoBoxWidth + 10

  doc.setFillColor(245, 245, 245)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.rect(totalBoxX, yPos, totalBoxWidth, totalBoxHeight, 'FD')

  // 横線を2本引いて3つのセクションに分割
  doc.line(totalBoxX, yPos + 7, totalBoxX + totalBoxWidth, yPos + 7)
  doc.line(totalBoxX, yPos + 14, totalBoxX + totalBoxWidth, yPos + 14)

  doc.setFont('NotoSerifJP')
  doc.setFontSize(8)

  // 商品小計を計算
  const itemsSubtotal = orderData.items.reduce((sum, item) => sum + item.total_price, 0)

  // 送料（税込）を計算
  const shippingCost = orderData.shipping_cost || 0
  const shippingTaxRate = orderData.shipping_tax_rate || 0
  const shippingWithTax = Math.round(shippingCost * (1 + shippingTaxRate))

  // ラベルと金額
  doc.text('商品小計', totalBoxX + 3, yPos + 5)
  doc.text(`¥${itemsSubtotal.toLocaleString()}`, totalBoxX + totalBoxWidth - 3, yPos + 5, { align: 'right' })

  doc.text('送料（税込）', totalBoxX + 3, yPos + 12)
  doc.text(`¥${shippingWithTax.toLocaleString()}`, totalBoxX + totalBoxWidth - 3, yPos + 12, { align: 'right' })

  doc.text('合計金額', totalBoxX + 3, yPos + 19)
  doc.text(`¥${orderData.total_amount.toLocaleString()}`, totalBoxX + totalBoxWidth - 3, yPos + 19, { align: 'right' })

  yPos += infoBoxHeight + 5

  // ===== 備考欄（背景色付き） =====
  doc.setFont('NotoSerifJP')
  doc.setFontSize(8)
  doc.text('備考欄', 20, yPos)

  yPos += 2

  const notesBoxHeight = 18
  doc.setFillColor(245, 245, 245)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.rect(20, yPos, 170, notesBoxHeight, 'FD')

  if (orderData.notes) {
    doc.setFont('NotoSerifJP')
    doc.setFontSize(7)
    const notesLines = doc.splitTextToSize(orderData.notes, 165)
    doc.text(notesLines, 22, yPos + 3)
  }

  // ===== フッター（右下に会社情報） =====
  const footerY = 275
  const footerX = 190

  doc.setFont('NotoSerifJP')
  doc.setFontSize(9)
  doc.text(companyInfo.name, footerX, footerY, { align: 'right' })

  doc.setFontSize(6.5)
  doc.text(companyInfo.address, footerX, footerY + 4, { align: 'right' })
  doc.text(companyInfo.phone, footerX, footerY + 8, { align: 'right' })
  doc.text(companyInfo.fax, footerX, footerY + 12, { align: 'right' })

  // PDFをダウンロード
  doc.save(`${orderData.order_no}_発注書.pdf`)
}
