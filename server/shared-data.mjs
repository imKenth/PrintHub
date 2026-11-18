export const SERVICES = ['Documents', 'Photos', 'Graphics', 'Others']
export const PAPER_SIZES = ['A4', 'A3', 'Letter', 'Legal']
export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const ACCEPTED_DOCUMENT_TYPES = ['.pdf', '.doc', '.docx']
export const ACCEPTED_FILE_TYPES = ['.pdf', '.jpg', '.jpeg', '.png']

const serviceRates = [
  { service: 'Documents', rates: [[5, 12], [10, 20], [5, 12], [7, 15]] },
  { service: 'Photos', rates: [[8, 18], [16, 32], [8, 18], [10, 22]] },
  { service: 'Graphics', rates: [[12, 25], [24, 45], [12, 25], [15, 30]] },
  { service: 'Others', rates: [[6, 14], [12, 24], [6, 14], [8, 18]] },
]

export const DEFAULT_PRICING = serviceRates.flatMap(({ service, rates }) =>
  PAPER_SIZES.map((paperSize, index) => ({
    id: `${service.toLowerCase()}-${paperSize.toLowerCase()}`,
    service,
    paperSize,
    blackAndWhite: rates[index][0],
    color: rates[index][1],
  })),
)
