import { create } from 'zustand'

interface DeliveryModalState {
  isOpen: boolean
  selectedOrderId: string | null
  deliveryType: 'partial' | 'full' | null
  open: (orderId: string, type: 'partial' | 'full') => void
  close: () => void
}

export const useDeliveryModal = create<DeliveryModalState>((set) => ({
  isOpen: false,
  selectedOrderId: null,
  deliveryType: null,
  open: (orderId, type) => set({ isOpen: true, selectedOrderId: orderId, deliveryType: type }),
  close: () => set({ isOpen: false, selectedOrderId: null, deliveryType: null }),
}))
