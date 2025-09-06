import { create } from 'zustand'

interface AddInstallmentModalState {
  isOpen: boolean
  selectedOrderId: string | null
  open: (orderId: string) => void
  close: () => void
}

export const useAddInstallmentModal = create<AddInstallmentModalState>((set) => ({
  isOpen: false,
  selectedOrderId: null,
  open: (orderId) => set({ isOpen: true, selectedOrderId: orderId }),
  close: () => set({ isOpen: false, selectedOrderId: null }),
}))