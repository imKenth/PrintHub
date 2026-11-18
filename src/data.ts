import type { PrintOrder, PricingRule, StaffMember } from './types'

export const SERVICES = ['Documents', 'Photos', 'Graphics', 'Others'] as const
export const PAPER_SIZES = ['A4', 'A3', 'Letter', 'Legal'] as const
export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const ACCEPTED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
export const ACCEPTED_DOCUMENT_TYPES = ['.pdf', '.doc', '.docx']

const serviceRates = [
  { service: 'Documents', rates: [[5, 12], [10, 20], [5, 12], [7, 15]] },
  { service: 'Photos', rates: [[8, 18], [16, 32], [8, 18], [10, 22]] },
  { service: 'Graphics', rates: [[12, 25], [24, 45], [12, 25], [15, 30]] },
  { service: 'Others', rates: [[6, 14], [12, 24], [6, 14], [8, 18]] },
] as const

export const DEFAULT_PRICING: PricingRule[] = serviceRates.flatMap(
  ({ service, rates }) =>
    PAPER_SIZES.map((paperSize, index) => ({
      id: `${service.toLowerCase()}-${paperSize.toLowerCase()}`,
      service,
      paperSize,
      blackAndWhite: rates[index][0],
      color: rates[index][1],
      active: true,
    })),
)

export const MOCK_ORDERS: PrintOrder[] = [
  {
    id: 'mock-5',
    reference: 'PH-0005',
    customerName: 'Juan Dela Cruz',
    contactNumber: '09171234567',
    email: 'juan@example.com',
    service: 'Documents',
    paperSize: 'A4',
    color: 'Black & White',
    quantity: 10,
    instructions: 'Please staple each set.',
    fileName: 'project-proposal.pdf',
    unitPrice: 5,
    total: 50,
    paymentStatus: 'Unpaid',
    status: 'Pending Payment',
    createdAt: '2026-11-18T14:30:00',
  },
  {
    id: 'mock-4',
    reference: 'PH-0004',
    customerName: 'Maria Santos',
    contactNumber: '09181234567',
    email: 'maria@example.com',
    service: 'Photos',
    paperSize: 'A4',
    color: 'Color',
    quantity: 8,
    instructions: '',
    fileName: 'event-photos.jpg',
    unitPrice: 18,
    total: 144,
    paymentStatus: 'Paid',
    paymentMethod: 'GCash',
    paymentReference: 'GC-84012',
    paidAt: '2026-11-18T13:40:00',
    status: 'Processing',
    createdAt: '2026-11-18T13:15:00',
  },
  {
    id: 'mock-3',
    reference: 'PH-0003',
    customerName: 'Kenji Tanaka',
    contactNumber: '09191234567',
    email: '',
    service: 'Graphics',
    paperSize: 'A4',
    color: 'Color',
    quantity: 5,
    instructions: 'Matte finish, please.',
    fileName: 'poster-design.png',
    unitPrice: 25,
    total: 125,
    paymentStatus: 'Paid',
    paymentMethod: 'Cash',
    paidAt: '2026-11-18T12:50:00',
    status: 'Ready for Pickup',
    createdAt: '2026-11-18T11:45:00',
  },
  {
    id: 'mock-2',
    reference: 'PH-0002',
    customerName: 'Alyssa Reyes',
    contactNumber: '09201234567',
    email: '',
    service: 'Documents',
    paperSize: 'Letter',
    color: 'Black & White',
    quantity: 20,
    instructions: '',
    fileName: 'class-notes.pdf',
    unitPrice: 5,
    total: 100,
    paymentStatus: 'Paid',
    paymentMethod: 'Cash',
    paidAt: '2026-11-17T15:10:00',
    status: 'Completed',
    createdAt: '2026-11-17T14:00:00',
  },
]

export const MOCK_STAFF: StaffMember[] = [
  { id: 'owner', name: 'Micah Casile', email: 'owner@printhub.test', role: 'Admin', active: true },
  { id: 'staff-1', name: 'PrintHub Staff', email: 'staff@printhub.test', role: 'Staff', active: true },
]
