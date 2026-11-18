import type { PrintColor, PrintService } from '../types'

export type Page = 'home' | 'order' | 'confirmation' | 'payment-result' | 'track' | 'login' | 'dashboard' | 'orders' | 'order-detail' | 'history' | 'pricing' | 'staff'

export type OrderForm = {
  customerName: string
  contactNumber: string
  email: string
  service: PrintService
  paperSize: string
  color: PrintColor
  quantity: number
  instructions: string
}

export const initialForm: OrderForm = {
  customerName: '',
  contactNumber: '',
  email: '',
  service: 'Documents',
  paperSize: 'A4',
  color: 'Black & White',
  quantity: 1,
  instructions: '',
}

export const protectedPages: Page[] = ['dashboard', 'orders', 'order-detail', 'history']
export const adminPages: Page[] = ['pricing', 'staff']
export const landingSections = ['features', 'how-it-works', 'contact']
export const publicPages: Page[] = ['home', 'order', 'confirmation', 'payment-result', 'track', 'login']
export const MAX_ORDER_QUANTITY = 500
