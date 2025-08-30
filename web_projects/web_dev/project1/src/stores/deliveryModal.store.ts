import { create } from 'zustand'

interface DeliveryModalState {
  isOpen: boolean
  selectedOrderId: string | null
  open: (orderId: string) => void
  close: () => void
}

export const useDeliveryModal = create<DeliveryModalState>((set) => ({
  isOpen: false,
  selectedOrderId: null,
  open: (orderId) => set({ isOpen: true, selectedOrderId: orderId }),
  close: () => set({ isOpen: false, selectedOrderId: null }),
}))
