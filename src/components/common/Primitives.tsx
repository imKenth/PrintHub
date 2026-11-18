import { useEffect, type ReactNode } from 'react'
import printerIllustration from '../../assets/printer-illustration.svg?url'
import { Icon } from '../Icon'
import type { OrderStatus, PaymentStatus, PrintOrder } from '../../types'

const timelineStatuses: OrderStatus[] = ['Pending Payment', 'Paid', 'Processing', 'Ready for Pickup', 'Completed']

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand${small ? ' brand-small' : ''}`}>
      <span className="brand-mark"><Icon name="printer" size={small ? 19 : 21} /></span>
      <span>Print<span>Hub</span></span>
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return <button className={`button button-${variant} ${className}`} type={type} onClick={onClick} disabled={disabled}>{children}</button>
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label">{label}{required && <span className="required-mark"> *</span>}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'pink' | 'green' | 'amber' | 'purple' | 'red' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = status === 'Pending Payment' ? 'amber' : status === 'Processing' ? 'purple' : status === 'Paid' || status === 'Ready for Pickup' ? 'green' : status === 'Cancelled' ? 'red' : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone = status === 'Paid' ? 'green' : status === 'Pending' ? 'purple' : status === 'Failed' || status === 'Expired' ? 'red' : status === 'Refunded' ? 'neutral' : 'amber'
  const label = status === 'Unpaid' ? 'Unpaid' : status === 'Pending' ? 'Pending' : status
  return <Badge tone={tone}>{label}</Badge>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="package" size={23} /></span><h3>{title}</h3><p>{description}</p>{action}</div>
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-heading">
        <div className="modal-heading"><h2 id="modal-heading">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
        {children}
      </section>
    </div>
  )
}

export function PrinterIllustration() {
  return <img className="printer-illustration" src={printerIllustration} alt="Pink desktop printer with a printed page, surrounded by sparkles." />
}

export function OrderTimeline({ order }: { order: PrintOrder }) {
  const current = order.status === 'Cancelled' ? -1 : timelineStatuses.indexOf(order.status)
  return (
    <div className="timeline">
      {timelineStatuses.map((status, index) => (
        <div className={`timeline-step${index <= current ? ' is-done' : ''}${index === current ? ' is-current' : ''}`} key={status}>
          <span className="timeline-dot">{index < current ? <Icon name="check" size={14} /> : index + 1}</span>
          <span className="timeline-label">{status === 'Pending Payment' ? 'Awaiting payment' : status === 'Paid' ? 'Payment confirmed' : status}</span>
          {index === 0 && <span className="timeline-note">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}</span>}
          {index === 1 && order.paymentStatus === 'Paid' && <span className="timeline-note">Payment verified</span>}
        </div>
      ))}
    </div>
  )
}
