import type { PrintColor, PrintService, PricingRule } from './types'

export function getUnitPrice(
  rules: PricingRule[],
  service: PrintService,
  paperSize: string,
  color: PrintColor,
): number | null {
  const rule = rules.find(
    (item) => item.service === service && item.paperSize === paperSize && item.active,
  )

  if (!rule) return null
  return color === 'Color' ? rule.color : rule.blackAndWhite
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount)
}
