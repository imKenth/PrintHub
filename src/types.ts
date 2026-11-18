export type PrintService = 'Documents' | 'Photos' | 'Graphics' | 'Others'
export type PrintColor = 'Black & White' | 'Color'
export type OrderStatus = 'Pending Payment' | 'Paid' | 'Processing' | 'Ready for Pickup' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Unpaid' | 'Pending' | 'Paid' | 'Failed' | 'Expired' | 'Refunded'

export interface PricingRule {
  id: string
  service: PrintService
  paperSize: string
  blackAndWhite: number
  color: number
  active: boolean
}

export interface PrintOrder {
  id: string
  reference: string
  customerName: string
  contactNumber: string
  email: string
  service: PrintService
  paperSize: string
  color: PrintColor
  quantity: number
  instructions: string
  fileName: string
  file?: File
  unitPrice: number
  total: number
  paymentStatus: PaymentStatus
  paymentMethod?: string
  paymentReference?: string
  paidAt?: string
  status: OrderStatus
  createdAt: string
}

export interface StaffMember {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Staff'
  active: boolean
}
