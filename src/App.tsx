import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { Icon } from './components/Icon'
import { ACCEPTED_DOCUMENT_TYPES, ACCEPTED_FILE_TYPES, MAX_FILE_SIZE, MOCK_STAFF, PAPER_SIZES, SERVICES } from './data'
import { formatCurrency, getUnitPrice } from './pricing'
import type { OrderStatus, PaymentStatus, PrintColor, PrintOrder, PrintService, PricingRule, StaffMember } from './types'
import './App.css'

type Page = 'home' | 'order' | 'confirmation' | 'payment-result' | 'track' | 'login' | 'dashboard' | 'orders' | 'order-detail' | 'history' | 'pricing' | 'staff'
type OrderForm = {
  customerName: string
  contactNumber: string
  email: string
  service: PrintService
  paperSize: string
  color: PrintColor
  quantity: number
  instructions: string
}

const initialForm: OrderForm = {
  customerName: '',
  contactNumber: '',
  email: '',
  service: 'Documents',
  paperSize: 'A4',
  color: 'Black & White',
  quantity: 1,
  instructions: '',
}

const allStatuses: OrderStatus[] = ['Pending Payment', 'Paid', 'Processing', 'Ready for Pickup', 'Completed', 'Cancelled']
const timelineStatuses: OrderStatus[] = ['Pending Payment', 'Paid', 'Processing', 'Ready for Pickup', 'Completed']
const protectedPages: Page[] = ['dashboard', 'orders', 'order-detail', 'history']
const adminPages: Page[] = ['pricing', 'staff']
const MAX_ORDER_QUANTITY = 500

function quantityUnit(service: PrintService, quantity: number) {
  return service === 'Documents' ? (quantity === 1 ? 'page' : 'pages') : (quantity === 1 ? 'copy' : 'copies')
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new Error('PrintHub server is unavailable. Start the API server and try again.')
  }
  const body = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.')
  return body
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read the selected file.'))
        return
      }
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand${small ? ' brand-small' : ''}`}>
      <span className="brand-mark"><Icon name="printer" size={small ? 19 : 21} /></span>
      <span>Print<span>Hub</span></span>
    </span>
  )
}

function Button({
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

function Field({
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

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'pink' | 'green' | 'amber' | 'purple' | 'red' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = status === 'Pending Payment' ? 'amber' : status === 'Processing' ? 'purple' : status === 'Paid' || status === 'Ready for Pickup' ? 'green' : status === 'Cancelled' ? 'red' : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone = status === 'Paid' ? 'green' : status === 'Pending' ? 'purple' : status === 'Failed' || status === 'Expired' ? 'red' : status === 'Refunded' ? 'neutral' : 'amber'
  const label = status === 'Unpaid' ? 'Unpaid' : status === 'Pending' ? 'Pending' : status
  return <Badge tone={tone}>{label}</Badge>
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="package" size={23} /></span><h3>{title}</h3><p>{description}</p>{action}</div>
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
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

function PrinterIllustration() {
  return <img className="printer-illustration" src="/printer-illustration.svg" alt="Pink desktop printer with a printed page, surrounded by sparkles." />
}

function OrderTimeline({ order }: { order: PrintOrder }) {
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

function OrderTable({
  orders,
  onView,
  mode = 'full',
}: {
  orders: PrintOrder[]
  onView: (order: PrintOrder) => void
  mode?: 'compact' | 'full' | 'history'
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [paymentFilter, setPaymentFilter] = useState('All payments')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = mode === 'compact' ? 5 : 6
  const filtered = useMemo(() => orders.filter((order) => {
    const text = `${order.reference} ${order.customerName} ${order.service}`.toLowerCase()
    const date = order.createdAt.slice(0, 10)
    return text.includes(query.toLowerCase())
      && (statusFilter === 'All statuses' || order.status === statusFilter)
      && (paymentFilter === 'All payments' || order.paymentStatus === paymentFilter)
      && (!fromDate || date >= fromDate)
      && (!toDate || date <= toDate)
  }), [orders, query, statusFilter, paymentFilter, fromDate, toDate])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="table-section">
      <div className="table-toolbar">
        <label className="search-box"><Icon name="search" size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search reference, customer..." aria-label="Search orders" /></label>
        <div className="toolbar-filters">
          {mode === 'history' && <><label className="date-filter"><span>From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="From date" /></label><label className="date-filter"><span>To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="To date" /></label></>}
          <label className="select-filter"><Icon name="filter" size={16} /><select aria-label="Filter by order status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option>All statuses</option>{allStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="select-filter"><select aria-label="Filter by payment status" value={paymentFilter} onChange={(event) => { setPaymentFilter(event.target.value); setPage(1) }}><option>All payments</option>{(['Unpaid', 'Pending', 'Paid', 'Failed', 'Expired', 'Refunded'] as PaymentStatus[]).map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>
      </div>
      <div className="table-scroll">
        <table className="orders-table">
          <thead><tr><th>Order reference</th><th>Customer</th><th>Service</th><th>Qty.</th><th>Final amount</th><th>Payment</th><th>Status</th><th /></tr></thead>
          <tbody>{visible.map((order) => (
            <tr key={order.id}>
              <td><button className="text-link reference-link" onClick={() => onView(order)}>{order.reference}</button><span className="table-subtext">{new Date(order.createdAt).toLocaleDateString()}</span></td>
              <td>{order.customerName}<span className="table-subtext">{order.contactNumber}</span></td>
              <td>{order.service}<span className="table-subtext">{order.paperSize} · {order.color}</span></td>
              <td>{order.quantity} {quantityUnit(order.service, order.quantity)}</td>
              <td className="amount-cell">{formatCurrency(order.total)}</td>
              <td><PaymentBadge status={order.paymentStatus} /></td>
              <td><StatusBadge status={order.status} /></td>
              <td><button className="table-action" onClick={() => onView(order)}>View <Icon name="arrow" size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
        {!visible.length && <EmptyState title="No orders match" description="Try changing your search or filters." />}
      </div>
      <div className="table-pagination"><span>{filtered.length ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} orders` : 'No results'}</span><div><button className="page-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page">‹</button><span className="page-number">{currentPage} / {pages}</span><button className="page-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} aria-label="Next page">›</button></div></div>
    </div>
  )
}

function App() {
  const [page, setPage] = useState<Page>(() => {
    if (new URLSearchParams(window.location.search).has('payment')) return 'payment-result'
    const initial = window.location.hash.slice(1) as Page
    if (protectedPages.includes(initial) || adminPages.includes(initial)) return 'login'
    return ['home', 'order', 'confirmation', 'payment-result', 'track', 'login'].includes(initial) ? initial : 'home'
  })
  const [orders, setOrders] = useState<PrintOrder[]>([])
  const [pricing, setPricing] = useState<PricingRule[]>([])
  const [staff, setStaff] = useState<StaffMember[]>(MOCK_STAFF)
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState<OrderForm>(initialForm)
  const [orderRequestId, setOrderRequestId] = useState(() => crypto.randomUUID())
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [orderStep, setOrderStep] = useState(1)
  const [formError, setFormError] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [automaticPageCount, setAutomaticPageCount] = useState(false)
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [acceptedPrice, setAcceptedPrice] = useState(false)
  const [confirmedOrderId, setConfirmedOrderId] = useState('')
  const [paymentContact, setPaymentContact] = useState(() => {
    const reference = new URLSearchParams(window.location.search).get('reference')
    return reference ? window.sessionStorage.getItem(`printhub:${reference}`) ?? '' : ''
  })
  const [paymentReferenceInput] = useState(() => new URLSearchParams(window.location.search).get('reference') ?? '')
  const [paymentContactInput, setPaymentContactInput] = useState('')
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [paymentResultError, setPaymentResultError] = useState('')
  const [paymentStatusLoading, setPaymentStatusLoading] = useState(false)
  const [paymentRefreshCount, setPaymentRefreshCount] = useState(0)
  const [trackingReference, setTrackingReference] = useState('')
  const [trackingContact, setTrackingContact] = useState('')
  const [trackingError, setTrackingError] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [statusChange, setStatusChange] = useState<{ orderId: string; status: OrderStatus } | null>(null)
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const currentOrder = orders.find((order) => order.id === selectedOrderId)
  const confirmedOrder = orders.find((order) => order.id === confirmedOrderId)
  const paymentResultReference = new URLSearchParams(window.location.search).get('reference') ?? ''
  const paymentResultOrder = orders.find((order) => order.reference === paymentResultReference)
  const trackedOrder = orders.find((order) =>
    order.reference.toLowerCase() === trackingReference.trim().toLowerCase()
    && order.contactNumber.replace(/\D/g, '') === trackingContact.replace(/\D/g, ''),
  )
  const unitPrice = getUnitPrice(pricing, form.service, form.paperSize, form.color)
  const total = unitPrice === null ? null : unitPrice * form.quantity

  useEffect(() => {
    const handlePopState = () => {
      if (new URLSearchParams(window.location.search).has('payment')) {
        setPage('payment-result')
        return
      }
      const target = window.location.hash.slice(1) as Page
      if (protectedPages.includes(target) && !currentUser) {
        setPage('login')
        return
      }
      if (adminPages.includes(target) && currentUser?.role !== 'Admin') {
        setPage(currentUser ? 'dashboard' : 'login')
        return
      }
      setPage(target || 'home')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [currentUser])

  useEffect(() => {
    document.title = `${page === 'home' ? 'PrintHub' : `${page.replace('-', ' ')} · PrintHub`}`
  }, [page])

  useEffect(() => {
    let active = true
    void Promise.all([
      apiRequest<{ pricing: PricingRule[] }>('/pricing'),
      apiRequest<{ user: { role: StaffMember['role']; email?: string; name?: string } | null }>('/staff/session'),
    ]).then(([priceResponse, sessionResponse]) => {
      if (!active) return
      setPricing(priceResponse.pricing)
      if (sessionResponse.user) {
        const role = sessionResponse.user.role
        setCurrentUser({
          id: role.toLowerCase(),
          name: sessionResponse.user.name || (role === 'Admin' ? 'PrintHub Admin' : 'PrintHub Staff'),
          email: sessionResponse.user.email || '',
          role,
          active: true,
        })
      }
    }).catch((error: unknown) => {
      if (active) setToast(error instanceof Error ? error.message : 'PrintHub server is unavailable.')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    let active = true
    void apiRequest<{ orders: PrintOrder[] }>('/orders').then((result) => {
      if (active) setOrders(result.orders)
    }).catch((error: unknown) => {
      if (active) setToast(error instanceof Error ? error.message : 'Could not load orders.')
    })
    return () => { active = false }
  }, [currentUser])

  useEffect(() => {
    if (page !== 'payment-result' || !paymentResultReference || !paymentContact) return
    let active = true
    let timer: number | undefined
    const refresh = async () => {
      setPaymentStatusLoading(true)
      setPaymentResultError('')
      try {
        const result = await apiRequest<{ order: PrintOrder }>('/payments/status', {
          method: 'POST',
          body: JSON.stringify({ reference: paymentResultReference, contactNumber: paymentContact }),
        })
        if (!active) return
        setOrders((previous) => [result.order, ...previous.filter((order) => order.id !== result.order.id)])
        if (result.order.paymentStatus === 'Pending' || result.order.paymentStatus === 'Unpaid') {
          timer = window.setTimeout(() => setPaymentRefreshCount((count) => count + 1), 5000)
        }
      } catch (error) {
        if (active) setPaymentResultError(error instanceof Error ? error.message : 'Could not retrieve payment status.')
      } finally {
        if (active) setPaymentStatusLoading(false)
      }
    }
    void refresh()
    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [page, paymentResultReference, paymentContact, paymentRefreshCount])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  function navigate(target: Page) {
    if (protectedPages.includes(target) && !currentUser) {
      target = 'login'
      setLoginError('Please sign in with a staff account to access this area.')
    }
    if (adminPages.includes(target) && currentUser?.role !== 'Admin') {
      setToast('Admin access is required for this page.')
      return
    }
    setPage(target)
    setMobileNavOpen(false)
    if (window.location.hash !== `#${target}`) window.history.pushState({}, '', `#${target}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startOrder() {
    setForm(initialForm)
    setOrderRequestId(crypto.randomUUID())
    setUploadedFile(null)
    setAutomaticPageCount(false)
    setOrderStep(1)
    setAcceptedPrice(false)
    setFormError('')
    navigate('order')
  }

  async function handleFile(file: File | undefined) {
    if (!file || isReadingFile) return
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!ACCEPTED_FILE_TYPES.includes(extension)) {
      setFormError('Choose a PDF, DOC, DOCX, JPG, JPEG, or PNG file.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFormError('Your file must be 10 MB or smaller.')
      return
    }
    if (form.service === 'Documents' && !ACCEPTED_DOCUMENT_TYPES.includes(extension)) {
      setFormError('For document printing, upload a PDF, DOC, or DOCX file.')
      return
    }
    if (form.service !== 'Documents' && ACCEPTED_DOCUMENT_TYPES.includes(extension) && extension !== '.pdf') {
      setFormError('Word files are supported for the Documents service. Choose a PDF or image for this service.')
      return
    }
    setUploadedFile(file)
    setAutomaticPageCount(false)
    setFormError('')
    if (form.service !== 'Documents') return

    if (extension !== '.pdf') {
      setForm((previous) => ({ ...previous, quantity: 1 }))
      return
    }

    setIsReadingFile(true)
    try {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ])
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
      const pdf = await task.promise
      const pageCount = pdf.numPages
      await task.destroy()
      if (pageCount > MAX_ORDER_QUANTITY) {
        setUploadedFile(null)
        setFormError(`This file has ${pageCount} pages. The maximum supported order quantity is ${MAX_ORDER_QUANTITY} pages.`)
        return
      }
      setForm((previous) => ({ ...previous, quantity: pageCount }))
      setAutomaticPageCount(true)
    } catch {
      setUploadedFile(null)
      setFormError('We couldn’t read this PDF. Please try a valid, unprotected PDF or upload a DOC/DOCX file and enter its page count.')
    } finally {
      setIsReadingFile(false)
    }
  }

  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    void handleFile(event.dataTransfer.files[0])
  }

  function validateOrderDetails() {
    if (!form.customerName.trim()) return 'Enter the name for this order.'
    const digits = form.contactNumber.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) return 'Enter a valid contact number (7–15 digits).'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address.'
    if (!form.quantity || form.quantity < 1 || form.quantity > MAX_ORDER_QUANTITY) return `Quantity must be between 1 and ${MAX_ORDER_QUANTITY}.`
    if (unitPrice === null) return 'This option is currently unavailable. Choose another print specification.'
    return ''
  }

  function continueOrder() {
    setFormError('')
    if (orderStep === 1) {
      const error = validateOrderDetails()
      if (error) { setFormError(error); return }
      setOrderStep(2)
    } else if (orderStep === 2) {
      if (isReadingFile) { setFormError('Wait for the PDF page count to finish reading.'); return }
      if (!uploadedFile) { setFormError('Upload a file to continue.'); return }
      setOrderStep(3)
    } else if (orderStep === 3) {
      setOrderStep(4)
    }
  }

  async function beginCheckout(order: PrintOrder) {
    setCheckoutLoading(true)
    setToast('')
    try {
      window.sessionStorage.setItem(`printhub:${order.reference}`, order.contactNumber)
      const result = await apiRequest<{ checkoutUrl: string; order: PrintOrder }>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ reference: order.reference, contactNumber: order.contactNumber }),
      })
      if (new URL(result.checkoutUrl).hostname !== 'checkout.paymongo.com') {
        throw new Error('The payment provider returned an invalid checkout link.')
      }
      window.location.assign(result.checkoutUrl)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not start GCash checkout.')
      setCheckoutLoading(false)
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (orderSubmitting) return
    const detailError = validateOrderDetails()
    if (detailError) {
      setFormError(detailError)
      return
    }
    if (!acceptedPrice || unitPrice === null || !uploadedFile) {
      setFormError('Review the final price and accept it before submitting.')
      return
    }
    setOrderSubmitting(true)
    setFormError('')
    try {
      const file = await fileToBase64(uploadedFile)
      const result = await apiRequest<{ order: PrintOrder }>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          requestId: orderRequestId,
          acceptedTotal: total,
          ...form,
          file: { name: uploadedFile.name, base64: file },
        }),
      })
      const order = result.order
      setOrders((previous) => [order, ...previous.filter((item) => item.id !== order.id)])
      setConfirmedOrderId(order.id)
      setPaymentContact(order.contactNumber)
      window.sessionStorage.setItem(`printhub:${order.reference}`, order.contactNumber)
      navigate('confirmation')
      await beginCheckout(order)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save your order.')
    } finally {
      setOrderSubmitting(false)
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError('')
    try {
      const result = await apiRequest<{ user: { email: string; name: string; role: StaffMember['role'] } }>('/staff/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const member: StaffMember = { ...result.user, id: result.user.email, active: true }
      setCurrentUser(member)
      setOrders([])
      setPage('dashboard')
      window.history.pushState({}, '', '#dashboard')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'We couldn’t sign you in.')
    }
  }

  async function logout() {
    try {
      await apiRequest('/staff/logout', { method: 'POST', body: JSON.stringify({}) })
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not sign out.')
    }
    setCurrentUser(null)
    setOrders([])
    setToast('You have signed out.')
    navigate('home')
  }

  function changeOrderStatus(order: PrintOrder, status: OrderStatus) {
    if (['Paid', 'Processing', 'Ready for Pickup', 'Completed'].includes(status) && order.paymentStatus !== 'Paid') {
      setToast('Verify full payment before starting a print job.')
      return
    }
    const nextByStatus: Partial<Record<OrderStatus, OrderStatus>> = {
      Paid: 'Processing',
      Processing: 'Ready for Pickup',
      'Ready for Pickup': 'Completed',
      'Pending Payment': 'Cancelled',
    }
    if (status !== nextByStatus[order.status]) {
      setToast('Orders can only move to the next status in the workflow.')
      return
    }
    setStatusChange({ orderId: order.id, status })
  }

  function confirmOrderStatus() {
    if (!statusChange) return
    const order = orders.find((item) => item.id === statusChange.orderId)
    if (!order) {
      setStatusChange(null)
      setToast('This order is no longer available.')
      return
    }
    if (['Paid', 'Processing', 'Ready for Pickup', 'Completed'].includes(statusChange.status) && order.paymentStatus !== 'Paid') {
      setStatusChange(null)
      setToast('Verify full payment before starting a print job.')
      return
    }
    void apiRequest<{ order: PrintOrder }>(`/orders/${encodeURIComponent(order.reference)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: statusChange.status }),
    }).then(({ order: updated }) => {
      setOrders((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      setToast(`${updated.reference} moved to ${updated.status}.`)
    }).catch((error: unknown) => setToast(error instanceof Error ? error.message : 'Could not update order status.'))
    setStatusChange(null)
  }

  async function updatePricing(id: string, changes: Partial<PricingRule>) {
    setPricing((previous) => previous.map((rule) => rule.id === id ? { ...rule, ...changes } : rule))
    try {
      const rule = pricing.find((item) => item.id === id)
      if (!rule) return
      await apiRequest(`/pricing/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ blackAndWhite: changes.blackAndWhite ?? rule.blackAndWhite, color: changes.color ?? rule.color, active: changes.active ?? rule.active }),
      })
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not save pricing.')
      void apiRequest<{ pricing: PricingRule[] }>('/pricing').then((result) => setPricing(result.pricing)).catch(() => {})
    }
  }

  function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = newStaffEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setToast('Enter a valid staff email address.')
      return
    }
    if (staff.some((member) => member.email.toLowerCase() === email)) {
      setToast('That email already has staff access.')
      return
    }
    setStaff((previous) => [...previous, {
      id: `staff-${crypto.randomUUID()}`,
      name: email.split('@')[0].replace(/[._-]/g, ' '),
      email,
      role: 'Staff',
      active: true,
    }])
    setNewStaffEmail('')
    setToast('Staff access added in this demo session.')
  }

  function openOrder(order: PrintOrder) {
    setSelectedOrderId(order.id)
    navigate('order-detail')
  }

  async function downloadOrderFile(order: PrintOrder) {
    try {
      const response = await fetch(`/api/orders/file?reference=${encodeURIComponent(order.reference)}`, { credentials: 'include' })
      if (!response.ok) throw new Error('You are not authorized to download this order file.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = order.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not download the order file.')
    }
  }

  const isStaffPage = [...protectedPages, ...adminPages].includes(page)
  const navItems: { page: Page; label: string; icon: 'home' | 'clipboard' | 'clock' | 'settings' | 'users' }[] = [
    { page: 'dashboard', label: 'Dashboard', icon: 'home' },
    { page: 'orders', label: 'Orders', icon: 'clipboard' },
    { page: 'history', label: 'Order history', icon: 'clock' },
    ...(currentUser?.role === 'Admin' ? [
      { page: 'pricing' as Page, label: 'Pricing', icon: 'settings' as const },
      { page: 'staff' as Page, label: 'Staff access', icon: 'users' as const },
    ] : []),
  ]

  function renderLanding() {
    return (
      <>
        <header className="public-header">
          <a href="#home" className="brand-anchor" onClick={(event) => { event.preventDefault(); navigate('home') }}><Logo /></a>
          <nav className="public-nav" aria-label="Main navigation">
            <a href="#features">Why PrintHub</a><a href="#how-it-works">How it works</a><a href="#contact">Contact</a>
          </nav>
          <div className="header-actions"><button className="header-login" onClick={() => navigate('login')}>Staff sign in</button><Button onClick={startOrder}>Order now <Icon name="arrow" size={17} /></Button></div>
        </header>
        <main>
          <section className="hero-section page-width">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> Your neighborhood print shop, made simple</span>
              <h1>Print smarter,<br /><span>not harder.</span></h1>
              <p>From your first upload to pickup, getting beautiful prints should be the easiest part of your day.</p>
              <div className="hero-actions"><Button onClick={startOrder}>Start an order <Icon name="arrow" size={18} /></Button><button className="text-action" onClick={() => navigate('track')}>Track an order <Icon name="arrow" size={16} /></button></div>
              <div className="hero-proof"><span className="proof-avatar"><Icon name="shield" size={16} /></span><span>Clear prices. Quality prints. Ready when you are.</span></div>
            </div>
            <div className="hero-visual"><div className="visual-caption"><span className="caption-dot" /><span>Made for your next big idea</span></div><PrinterIllustration /><div className="floating-note"><span className="note-icon"><Icon name="sparkles" size={17} /></span><span><b>Prints that feel</b><br />a little more personal</span></div><div className="floating-sticker"><Icon name="heart" size={19} /></div></div>
          </section>
          <section className="feature-section page-width" id="features">
            <div className="section-heading"><span className="eyebrow">A better way to print</span><h2>Small details. <span>Big difference.</span></h2><p>Everything you need to get your prints done without the back-and-forth.</p></div>
            <div className="feature-grid">
              <article className="feature-card"><span className="feature-icon icon-pink"><Icon name="sparkles" size={22} /></span><h3>Fast & easy ordering</h3><p>Choose your print options, upload your file, and see the exact price before you submit.</p><button className="card-link" onClick={startOrder}>Create an order <Icon name="arrow" size={15} /></button></article>
              <article className="feature-card"><span className="feature-icon icon-lilac"><Icon name="package" size={22} /></span><h3>Track your order</h3><p>Follow every step from payment verification to pickup—no account needed.</p><button className="card-link" onClick={() => navigate('track')}>Find your order <Icon name="arrow" size={15} /></button></article>
              <article className="feature-card"><span className="feature-icon icon-peach"><Icon name="star" size={22} /></span><h3>Quality prints, always</h3><p>Every order gets the care and attention you'd expect from your local print shop.</p><button className="card-link" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>See how it works <Icon name="arrow" size={15} /></button></article>
            </div>
          </section>
          <section className="how-section" id="how-it-works"><div className="page-width how-inner"><div className="section-heading"><span className="eyebrow">Just four easy steps</span><h2>From file to <span>finished.</span></h2><p>Your time is precious. We made ordering straightforward.</p></div><div className="how-grid"><div className="how-step"><span>01</span><h3>Tell us what you need</h3><p>Pick your service, paper, color, and quantity.</p></div><div className="how-step"><span>02</span><h3>Upload your file</h3><p>Share your PDF or image securely with your order.</p></div><div className="how-step"><span>03</span><h3>Know your final price</h3><p>Review and agree to the exact price before submitting.</p></div><div className="how-step"><span>04</span><h3>Pick up & enjoy</h3><p>Track progress and collect your prints when they're ready.</p></div></div><div className="how-cta"><div><h3>Ready when you are.</h3><p>Great prints start with one simple order.</p></div><Button onClick={startOrder}>Place an order <Icon name="arrow" size={17} /></Button></div></div></section>
        </main>
        <footer className="public-footer" id="contact"><div className="page-width footer-content"><div><Logo /><p>A little more joy in every print.</p></div><div className="footer-shop"><b>Micah's Printing Shop</b><span>Local pickup · Contact the shop for current hours and payment options</span></div><div className="footer-bottom"><span>© {new Date().getFullYear()} PrintHub. Made with care.</span><button onClick={() => navigate('login')}>Staff portal <Icon name="arrow" size={14} /></button></div></div></footer>
      </>
    )
  }

  function renderOrder() {
    const steps = ['Print details', 'Add your file', 'Price summary', 'Review & confirm']
    const subtotal = total ?? 0
    return (
      <div className="customer-shell">
        <header className="simple-header"><button className="back-link" onClick={() => navigate('home')}><Icon name="arrow" size={17} /> Back to home</button><Logo small /><button className="simple-help" onClick={() => navigate('track')}>Track an order</button></header>
        <main className="order-main page-width">
          <div className="page-intro"><span className="eyebrow">A fresh batch starts here</span><h1>Let's make something <span>great.</span></h1><p>Tell us what you'd like printed. Your final price is shown before you place the order.</p></div>
          <div className="stepper" aria-label={`Step ${orderStep} of 4`}>
            {steps.map((label, index) => <div key={label} className={`stepper-item${orderStep === index + 1 ? ' active' : ''}${orderStep > index + 1 ? ' complete' : ''}`}><span className="stepper-number">{orderStep > index + 1 ? <Icon name="check" size={15} /> : index + 1}</span><span>{label}</span></div>)}
          </div>
          <div className="order-layout">
            <section className="panel order-panel">
              {orderStep === 1 && <div className="order-step-content"><div className="panel-title"><span className="panel-icon"><Icon name="clipboard" /></span><div><h2>Printing details</h2><p>How can we bring your print to life?</p></div></div>
                <div className="form-grid">
                  <Field label="Your name" required><input className="input" autoComplete="name" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="e.g. Micah Casile" /></Field>
                  <Field label="Contact number" required hint="We'll use this to verify and track your order."><input className="input" autoComplete="tel" inputMode="tel" value={form.contactNumber} onChange={(event) => setForm({ ...form, contactNumber: event.target.value })} placeholder="e.g. 0917 123 4567" /></Field>
                  <Field label="Email address" hint="Optional — for order updates."><input className="input" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></Field>
                  <Field label="Print service" required><select className="input" value={form.service} onChange={(event) => { const service = event.target.value as PrintService; setForm((previous) => ({ ...previous, service, quantity: service === 'Documents' ? 1 : 10 })); setUploadedFile(null); setAutomaticPageCount(false); setFormError('') }}>{SERVICES.map((service) => <option value={service} key={service}>{service}</option>)}</select></Field>
                  <Field label="Paper size" required><select className="input" value={form.paperSize} onChange={(event) => setForm({ ...form, paperSize: event.target.value })}>{PAPER_SIZES.map((size) => <option key={size}>{size}</option>)}</select></Field>
                  <Field label="Print color" required><div className="choice-row">{(['Black & White', 'Color'] as PrintColor[]).map((color) => <button key={color} type="button" className={`choice-button${form.color === color ? ' selected' : ''}`} onClick={() => setForm({ ...form, color })}>{color === 'Color' ? <Icon name="palette" size={17} /> : <Icon name="document" size={17} />}{color}</button>)}</div></Field>
                  {form.service !== 'Documents' && <Field label="Quantity" required hint="Number of copies."><div className="quantity-control"><button aria-label="Decrease quantity" disabled={form.quantity <= 1} onClick={() => setForm({ ...form, quantity: Math.max(1, form.quantity - 1) })}><Icon name="minus" size={16} /></button><input aria-label="Quantity" type="number" min="1" max={MAX_ORDER_QUANTITY} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} /><button aria-label="Increase quantity" disabled={form.quantity >= MAX_ORDER_QUANTITY} onClick={() => setForm({ ...form, quantity: Math.min(MAX_ORDER_QUANTITY, form.quantity + 1) })}><Icon name="plus" size={16} /></button></div></Field>}
                  <Field label="Additional instructions" hint="Optional — add finishing or handling notes."><textarea className="input textarea" rows={3} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} placeholder="Anything else we should know?" /></Field>
                </div>
                {unitPrice === null && <p className="inline-alert"><Icon name="info" size={16} /> This printing option is currently unavailable. Please choose another one.</p>}
              </div>}
              {orderStep === 2 && <div className="order-step-content"><div className="panel-title"><span className="panel-icon"><Icon name="upload" /></span><div><h2>Add your print file</h2><p>Upload the file you'd like us to print.</p></div></div>
                <div className="upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={handleFileDrop}><span className="upload-icon"><Icon name="upload" size={24} /></span><h3>Drop your file here</h3><p>or browse from your device</p><Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={isReadingFile}><Icon name="plus" size={17} /> Browse files</Button><span className="upload-note">{form.service === 'Documents' ? 'PDF, DOC, or DOCX · Up to 10 MB' : 'PDF, JPG, JPEG, or PNG · Up to 10 MB'}</span><input ref={fileInput} className="visually-hidden" type="file" accept={form.service === 'Documents' ? ACCEPTED_DOCUMENT_TYPES.join(',') : ACCEPTED_FILE_TYPES.filter((type) => type !== '.doc' && type !== '.docx').join(',')} onChange={(event: ChangeEvent<HTMLInputElement>) => { void handleFile(event.target.files?.[0]); event.target.value = '' }} /></div>
                {isReadingFile && <p className="file-processing" role="status"><Icon name="clock" size={15} /> Reading PDF pages…</p>}
                {uploadedFile && <div className="uploaded-file"><span className="file-icon"><Icon name="file" /></span><div><b>{uploadedFile.name}</b><span>{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB · {form.service === 'Documents' && automaticPageCount ? `${form.quantity} pages detected automatically` : 'Ready to attach'}</span></div><button className="remove-file" disabled={isReadingFile} onClick={() => { setUploadedFile(null); setAutomaticPageCount(false); if (form.service === 'Documents') setForm((previous) => ({ ...previous, quantity: 1 })) }} aria-label="Remove uploaded file"><Icon name="close" size={17} /></button></div>}
                {form.service === 'Documents' && uploadedFile && !automaticPageCount && !isReadingFile && <Field label="Document page count" required hint="Word documents do not contain a reliable printed page count. Enter the page count from your document editor."><input className="input" type="number" min="1" max={MAX_ORDER_QUANTITY} value={form.quantity} onChange={(event) => setForm((previous) => ({ ...previous, quantity: Number(event.target.value) }))} /></Field>}
                {form.service === 'Documents' && !uploadedFile && <p className="page-count-note"><Icon name="info" size={15} /> PDF page count is detected automatically. For DOC/DOCX, enter the page count after uploading.</p>}
                <div className="privacy-note"><Icon name="lock" size={17} /><p>Your file is uploaded to the PrintHub server and is only available to authorized staff.</p></div>
              </div>}
              {orderStep === 3 && <div className="order-step-content"><div className="panel-title"><span className="panel-icon"><Icon name="wallet" /></span><div><h2>Your price summary</h2><p>Transparent pricing, based on the shop's current rates.</p></div></div><div className="price-breakdown"><div><span>Service</span><b>{form.service}</b></div><div><span>Paper size</span><b>{form.paperSize}</b></div><div><span>Print color</span><b>{form.color}</b></div><div><span>Quantity</span><b>{form.quantity} {quantityUnit(form.service, form.quantity)}</b></div><div><span>Unit price</span><b>{unitPrice === null ? 'Unavailable' : formatCurrency(unitPrice)}</b></div><div className="breakdown-total"><span>FINAL PRICE</span><b>{total === null ? 'Unavailable' : formatCurrency(subtotal)}</b></div></div><div className="selected-payment"><span className="gcash-mark">G</span><span><b>Pay with GCash</b><small>Secure hosted checkout · PayMongo TEST mode</small></span><Icon name="check" size={18} /></div><p className="price-note"><Icon name="info" size={16} /> Your order and amount are verified by the server before checkout. No real money is charged in test mode.</p></div>}
              {orderStep === 4 && <div className="order-step-content"><div className="panel-title"><span className="panel-icon"><Icon name="check" /></span><div><h2>One last look</h2><p>Make sure your details are right before sending your order.</p></div></div><div className="review-block"><div className="review-heading"><div><span className="eyebrow">Order for</span><h3>{form.customerName}</h3></div><button className="text-link" onClick={() => setOrderStep(1)}>Edit details</button></div><div className="review-grid"><div><span>Contact number</span><b>{form.contactNumber}</b></div><div><span>Email</span><b>{form.email || 'Not provided'}</b></div><div><span>Service</span><b>{form.service}</b></div><div><span>Paper & color</span><b>{form.paperSize} · {form.color}</b></div><div><span>Quantity</span><b>{form.quantity} {quantityUnit(form.service, form.quantity)}</b></div><div><span>Your file</span><b className="review-file"><Icon name="file" size={15} /> {uploadedFile?.name}</b></div><div className="review-total"><span>FINAL PRICE</span><b>{total === null ? 'Unavailable' : formatCurrency(total)}</b></div></div>{form.instructions && <div className="review-instructions"><span>Instructions</span><p>{form.instructions}</p></div>}</div><label className="accept-price"><input type="checkbox" checked={acceptedPrice} onChange={(event) => setAcceptedPrice(event.target.checked)} /><span>I agree to the final price of <b>{total === null ? 'Unavailable' : formatCurrency(total)}</b> and will continue to secure GCash checkout in test mode.</span></label></div>}
              {formError && <p className="form-error-banner" role="alert"><Icon name="info" size={17} />{formError}</p>}
              <div className="order-navigation">{orderStep > 1 ? <Button variant="quiet" onClick={() => { setFormError(''); setOrderStep(orderStep - 1) }}><Icon name="arrow" size={16} /> Back</Button> : <span className="secure-caption"><Icon name="lock" size={15} /> No account needed</span>}{orderStep < 4 ? <Button onClick={continueOrder} disabled={(orderStep === 3 && total === null) || (orderStep === 1 && pricing.length === 0)}>Continue <Icon name="arrow" size={17} /></Button> : <Button onClick={() => { const formElement = document.getElementById('order-submit-form') as HTMLFormElement | null; formElement?.requestSubmit() }} disabled={!acceptedPrice || orderSubmitting || checkoutLoading}>{orderSubmitting || checkoutLoading ? 'Connecting to checkout…' : 'Place order & pay with GCash'} <Icon name="arrow" size={17} /></Button>}</div>
              <form id="order-submit-form" onSubmit={submitOrder} />
            </section>
            <aside className="panel price-card"><div className="price-card-header"><span className="price-card-icon"><Icon name="sparkles" size={19} /></span><div><span>Your order</span><b>Live price summary</b></div></div><div className="mini-order"><div><span>Print service</span><b>{form.service}</b></div><div><span>Paper size</span><b>{form.paperSize}</b></div><div><span>Print color</span><b>{form.color}</b></div><div><span>Quantity</span><b>{form.quantity} {quantityUnit(form.service, form.quantity)}</b></div></div><div className="mini-total"><span>FINAL PRICE</span><b>{total === null ? '—' : formatCurrency(total)}</b></div><p className="price-card-note">Your total updates automatically using the shop's current pricing.</p><div className="price-assurance"><Icon name="shield" size={17} /><span>Price locked in when you accept and submit.</span></div></aside>
          </div>
        </main>
        <footer className="simple-footer">Questions? Contact Micah's Printing Shop for help with your order.</footer>
      </div>
    )
  }

  function renderConfirmation() {
    if (!confirmedOrder) return <main className="standalone-page"><EmptyState title="No recent order found" description="Start a new order to receive a reference code." action={<Button onClick={startOrder}>Start an order</Button>} /></main>
    return (
      <div className="customer-shell"><header className="simple-header"><button className="back-link" onClick={() => navigate('home')}><Icon name="arrow" size={17} /> Home</button><Logo small /><button className="simple-help" onClick={() => navigate('track')}>Track an order</button></header><main className="confirmation-page page-width"><div className="success-illustration"><span><Icon name="check" size={34} /></span><i>✦</i><i>♡</i></div><span className="eyebrow">Your order is saved</span><h1>Thanks, {confirmedOrder.customerName.split(' ')[0]}! <span>One last step.</span></h1><p className="confirmation-intro">Your order is saved. Complete secure GCash checkout in PayMongo test mode to confirm it for printing.</p><div className="reference-card"><span>YOUR ORDER REFERENCE</span><div><b>{confirmedOrder.reference}</b><button className="copy-button" onClick={async () => { try { await navigator.clipboard.writeText(confirmedOrder.reference); setToast('Order reference copied.') } catch { setToast('Copy is unavailable here. Please select the reference to copy it.') } }} aria-label="Copy order reference"><Icon name="copy" size={17} /> Copy</button></div></div><div className="confirmation-details"><div><span>Final printing price</span><b className="confirmation-amount">{formatCurrency(confirmedOrder.total)}</b></div><div><span>Payment status</span><PaymentBadge status={confirmedOrder.paymentStatus} /></div></div><div className="payment-instructions"><span className="panel-icon"><Icon name="wallet" /></span><div><b>GCash via PayMongo TEST mode</b><p>No real money is charged. Only a verified PayMongo test webhook confirms payment and allows the shop to begin printing.</p></div></div><div className="confirmation-actions"><Button disabled={checkoutLoading} onClick={() => void beginCheckout(confirmedOrder)}><Icon name="wallet" size={17} />{checkoutLoading ? 'Connecting…' : 'Pay with GCash'}</Button><Button variant="secondary" onClick={() => { setTrackingReference(confirmedOrder.reference); setTrackingContact(confirmedOrder.contactNumber); navigate('track') }}>Track this order</Button></div><p className="confirmation-footnote"><Icon name="info" size={15} /> Returning from checkout does not prove payment. PrintHub checks the verified payment status with PayMongo.</p></main><footer className="simple-footer">Micah's Printing Shop · GCash test checkout</footer></div>
    )
  }

  function renderPaymentResult() {
    const queryStatus = new URLSearchParams(window.location.search).get('payment')
    const status = paymentResultOrder?.paymentStatus
    const paid = status === 'Paid'
    const expired = status === 'Expired'
    const failed = status === 'Failed'
    const cancelled = queryStatus === 'cancelled' && !paid
    const title = paid ? 'Payment confirmed.' : expired ? 'Checkout expired.' : failed ? 'Payment didn’t go through.' : cancelled ? 'Checkout cancelled.' : 'Payment confirmation is pending.'
    const message = paid
      ? 'PayMongo confirmed your GCash test payment. Your order is now paid and the shop can start printing.'
      : expired
        ? 'This checkout session expired before a successful payment. You can safely start a new test checkout.'
        : failed
          ? 'PayMongo did not confirm a successful payment. Your order remains unpaid; you can retry with the test checkout.'
          : cancelled
            ? 'You returned without completing checkout. Your order remains unpaid and has not entered the print queue.'
            : 'We’re checking with PayMongo. Your order will remain pending until the server verifies payment.'
    return <div className="customer-shell"><header className="simple-header"><button className="back-link" onClick={() => navigate('home')}><Icon name="arrow" size={17} /> Home</button><Logo small /><button className="simple-help" onClick={() => navigate('track')}>Track order</button></header><main className="confirmation-page payment-result-page page-width"><div className={`success-illustration${paid ? '' : ' payment-pending-icon'}`}><span><Icon name={paid ? 'check' : expired || failed ? 'close' : 'clock'} size={32} /></span></div><span className="eyebrow">PayMongo · TEST mode</span><h1>{title}</h1><p className="confirmation-intro">{message}</p>
      {!paymentResultReference && <p className="form-error-banner"><Icon name="info" size={16} />No order reference was included in the return URL.</p>}
      {paymentResultReference && <div className="reference-card"><span>YOUR ORDER REFERENCE</span><div><b>{paymentResultReference}</b><button className="copy-button" onClick={async () => { try { await navigator.clipboard.writeText(paymentResultReference); setToast('Order reference copied.') } catch { setToast('Copy is unavailable here. Select the reference to copy it.') } }}><Icon name="copy" size={16} /> Copy</button></div></div>}
      {!paymentContact && paymentResultReference && <form className="payment-verify-form" onSubmit={(event) => { event.preventDefault(); if (!paymentContactInput.trim()) { setPaymentResultError('Enter the contact number used for this order.'); return } window.sessionStorage.setItem(`printhub:${paymentReferenceInput}`, paymentContactInput); setPaymentContact(paymentContactInput); setPaymentRefreshCount((count) => count + 1) }}><Field label="Order contact number" required hint="Required to privately retrieve your order status."><input className="input" inputMode="tel" value={paymentContactInput} onChange={(event) => setPaymentContactInput(event.target.value)} placeholder="Enter the number used for this order" /></Field><Button type="submit">Check payment status <Icon name="arrow" size={16} /></Button></form>}
      {paymentResultOrder && <div className="confirmation-details"><div><span>Final amount</span><b className="confirmation-amount">{formatCurrency(paymentResultOrder.total)}</b></div><div><span>Verified payment status</span><PaymentBadge status={paymentResultOrder.paymentStatus} /></div></div>}
      {paymentStatusLoading && <p className="payment-checking" role="status"><Icon name="clock" size={16} /> Checking payment with PayMongo…</p>}
      {paymentResultError && <p className="form-error-banner" role="alert"><Icon name="info" size={16} />{paymentResultError}</p>}
      <div className="confirmation-actions">{paid ? <Button onClick={() => { if (paymentResultOrder) { setTrackingReference(paymentResultOrder.reference); setTrackingContact(paymentResultOrder.contactNumber) } navigate('track') }}>Track paid order <Icon name="arrow" size={16} /></Button> : paymentContact && paymentResultOrder?.status === 'Pending Payment' && ['Unpaid', 'Pending', 'Failed', 'Expired'].includes(paymentResultOrder.paymentStatus) ? <Button disabled={checkoutLoading || paymentStatusLoading} onClick={() => void beginCheckout(paymentResultOrder)}><Icon name="wallet" size={16} />{checkoutLoading ? 'Connecting…' : failed || expired ? 'Retry GCash checkout' : 'Continue with GCash'}</Button> : null}
      {paymentContact && !paid && <Button variant="secondary" disabled={paymentStatusLoading} onClick={() => setPaymentRefreshCount((count) => count + 1)}>Refresh payment status</Button>}
      <Button variant="quiet" onClick={() => navigate('track')}>Track order</Button></div>
      <p className="confirmation-footnote"><Icon name="shield" size={15} /> The return page never marks an order paid; only server-verified PayMongo status does.</p></main><footer className="simple-footer">GCash test payments only · No real funds are charged</footer></div>
  }

  function renderTracking() {
    const canPay = trackedOrder?.status === 'Pending Payment'
      && ['Unpaid', 'Pending', 'Failed', 'Expired'].includes(trackedOrder.paymentStatus)
    return (
      <div className="customer-shell">
        <header className="simple-header"><button className="back-link" onClick={() => navigate('home')}><Icon name="arrow" size={17} /> Back to home</button><Logo small /><button className="simple-help" onClick={startOrder}>New order</button></header>
        <main className="tracking-page page-width">
          <div className="tracking-heading"><div><span className="eyebrow">No account, no problem</span><h1>Track your <span>order.</span></h1><p>Enter your order reference and the contact number used at checkout.</p></div><div className="tracking-art"><PrinterIllustration /></div></div>
          <form className="tracking-form panel" onSubmit={async (event) => {
            event.preventDefault()
            setTrackingError('')
            setTrackingLoading(true)
            try {
              const result = await apiRequest<{ order: PrintOrder }>('/payments/status', {
                method: 'POST',
                body: JSON.stringify({ reference: trackingReference, contactNumber: trackingContact }),
              })
              setOrders((previous) => [result.order, ...previous.filter((order) => order.id !== result.order.id)])
            } catch (error) {
              setTrackingError(error instanceof Error ? error.message : 'Could not retrieve this order.')
            } finally {
              setTrackingLoading(false)
            }
          }}>
            <Field label="Order reference" required><input className="input" autoCapitalize="characters" value={trackingReference} onChange={(event) => { setTrackingReference(event.target.value); setTrackingError('') }} placeholder="e.g. PH-2026-ABC123" /></Field>
            <Field label="Contact number" required hint="Use the same number you entered when placing your order."><input className="input" inputMode="tel" value={trackingContact} onChange={(event) => { setTrackingContact(event.target.value); setTrackingError('') }} placeholder="e.g. 0917 123 4567" /></Field>
            <Button type="submit" disabled={trackingLoading}>{trackingLoading ? 'Looking up order…' : 'Find my order'} <Icon name="search" size={17} /></Button>
            {trackingError && <p className="form-error-banner" role="alert"><Icon name="info" size={16} />{trackingError}</p>}
          </form>
          {trackedOrder && trackingReference && trackingContact && (
            <section className="tracked-order panel">
              <div className="tracked-header"><div><span className="eyebrow">Order details</span><h2>{trackedOrder.reference}</h2><span className="table-subtext">Placed {new Date(trackedOrder.createdAt).toLocaleString()}</span></div><StatusBadge status={trackedOrder.status} /></div>
              <div className="tracked-summary"><div><span>Service</span><b>{trackedOrder.service}</b></div><div><span>Paper & color</span><b>{trackedOrder.paperSize} · {trackedOrder.color}</b></div><div><span>Quantity</span><b>{trackedOrder.quantity} {quantityUnit(trackedOrder.service, trackedOrder.quantity)}</b></div><div><span>Final agreed price</span><b>{formatCurrency(trackedOrder.total)}</b></div><div><span>Payment</span><PaymentBadge status={trackedOrder.paymentStatus} /></div></div>
              <h3 className="timeline-heading">Order progress</h3>
              <OrderTimeline order={trackedOrder} />
              {canPay && <div className="tracking-payment-action"><p className="tracking-tip"><Icon name="info" size={16} /> Your order stays out of the print queue until PayMongo confirms a successful payment.</p><Button disabled={checkoutLoading} onClick={() => void beginCheckout(trackedOrder)}><Icon name="wallet" size={17} />{checkoutLoading ? 'Connecting to GCash…' : trackedOrder.paymentStatus === 'Failed' || trackedOrder.paymentStatus === 'Expired' ? 'Retry GCash payment' : 'Continue to GCash payment'}</Button></div>}
            </section>
          )}
        </main>
        <footer className="simple-footer">Your order details are only shown when both your reference and contact number match.</footer>
      </div>
    )
  }

  function renderLogin() {
    return <main className="login-page"><div className="login-decoration decoration-one" /><div className="login-decoration decoration-two" /><div className="login-shell"><div className="login-brand"><button onClick={() => navigate('home')}><Logo /></button></div><section className="login-card"><span className="login-icon"><Icon name="lock" size={21} /></span><span className="eyebrow">Team access</span><h1>Welcome <span>back.</span></h1><p>Sign in to manage orders and keep things moving.</p><form onSubmit={login}><Field label="Work email" required><input className="input" type="email" autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="you@shop.com" /></Field><Field label="Password" required><span className="password-wrap"><input className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Enter your password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} /></button></span></Field>{loginError && <p className="form-error-banner" role="alert"><Icon name="info" size={16} />{loginError}</p>}<Button type="submit" className="login-submit">Sign in <Icon name="arrow" size={17} /></Button></form><div className="demo-credentials"><Icon name="info" size={15} /><span><b>Server authentication</b><br />Use the staff credentials configured in your local <code>.env</code> file.</span></div><button className="back-to-site" onClick={() => navigate('home')}><Icon name="arrow" size={15} /> Back to PrintHub</button></section><p className="login-footnote"><Icon name="shield" size={15} /> GCash checkout and payment verification are restricted to PayMongo test mode.</p></div></main>
  }

  function renderStaffLayout() {
    const isAdminOnly = adminPages.includes(page)
    const pageTitle = page === 'dashboard' ? 'Dashboard' : page === 'orders' ? 'Orders' : page === 'history' ? 'Order history' : page === 'pricing' ? 'Pricing settings' : page === 'staff' ? 'Staff access' : 'Order details'
    return <div className={`staff-app${mobileNavOpen ? ' nav-open' : ''}`}>
      <aside className="sidebar"><div className="sidebar-brand"><button onClick={() => navigate('dashboard')}><Logo /></button><button className="sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><Icon name="close" /></button></div><div className="sidebar-label">WORKSPACE</div><nav className="sidebar-nav" aria-label="Staff navigation">{navItems.map((item) => <button key={item.page} className={`sidebar-link${page === item.page || (page === 'order-detail' && item.page === 'orders') ? ' active' : ''}`} onClick={() => navigate(item.page)}><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.page === 'orders' && <span className="nav-count">{orders.filter((order) => order.status === 'Pending Payment').length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-help"><span className="help-avatar"><Icon name="heart" size={17} /></span><b>Need a hand?</b><span>Your shop team is here to help.</span></div><button className="sidebar-link logout-link" onClick={logout}><Icon name="logout" size={19} /><span>Sign out</span></button><span className="sidebar-version">PrintHub · TEST workspace</span></div></aside>
      {mobileNavOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <main className="staff-main"><header className="staff-header"><div className="staff-title-wrap"><button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button><div><span className="header-kicker">PRINT SHOP WORKSPACE</span><h1>{pageTitle}</h1></div></div><div className="staff-user"><span className="user-avatar">{currentUser?.name.slice(0, 1).toUpperCase() ?? 'M'}</span><span><b>{currentUser?.name}</b><small>{currentUser?.role}</small></span><button className="user-menu-button" onClick={logout} aria-label="Sign out"><Icon name="logout" size={17} /></button></div></header>
        <div className="staff-content"><div className="demo-notice"><Icon name="info" size={16} /><span><b>PayMongo TEST mode</b> — orders and pricing are stored by the local API; no real payments are processed.</span></div>
          {page === 'dashboard' && renderDashboard()}
          {page === 'orders' && <section className="content-card"><div className="content-card-heading"><div><h2>Incoming orders</h2><p>Review customer requests and manage their progress.</p></div><Badge tone="pink">{orders.filter((order) => order.status === 'Pending Payment').length} need payment</Badge></div><OrderTable orders={orders} onView={openOrder} /></section>}
          {page === 'history' && <section className="content-card"><div className="content-card-heading"><div><h2>All order records</h2><p>Search orders, review payment records, and filter by date.</p></div><Badge>{orders.length} total</Badge></div><OrderTable orders={orders} onView={openOrder} mode="history" /></section>}
          {page === 'order-detail' && renderOrderDetails()}
          {page === 'pricing' && isAdminOnly && renderPricing()}
          {page === 'staff' && isAdminOnly && renderStaffAccess()}
        </div>
      </main>
    </div>
  }

  function renderDashboard() {
    const metrics = [
      { label: 'New orders', value: orders.filter((order) => order.status === 'Pending Payment').length, icon: 'clipboard' as const, tone: 'pink' },
      { label: 'Pending payments', value: orders.filter((order) => order.paymentStatus !== 'Paid' && order.status === 'Pending Payment').length, icon: 'wallet' as const, tone: 'amber' },
      { label: 'In progress', value: orders.filter((order) => order.status === 'Processing').length, icon: 'printer' as const, tone: 'purple' },
      { label: 'Ready for pickup', value: orders.filter((order) => order.status === 'Ready for Pickup').length, icon: 'package' as const, tone: 'green' },
      { label: 'Total sales', value: formatCurrency(orders.filter((order) => order.paymentStatus === 'Paid').reduce((sum, order) => sum + order.total, 0)), icon: 'trend' as const, tone: 'blue' },
    ]
    return <><div className="welcome-row"><div><span className="eyebrow">Here's your shop at a glance</span><h2>Good to see you, {currentUser?.name.split(' ')[0]} <span>♡</span></h2><p>Here's what's happening with your print orders today.</p></div><Button onClick={() => navigate('orders')}>View all orders <Icon name="arrow" size={16} /></Button></div><div className="metric-grid">{metrics.map((metric) => <article className="metric-card" key={metric.label}><span className={`metric-icon metric-${metric.tone}`}><Icon name={metric.icon} size={19} /></span><span className="metric-label">{metric.label}</span><b className="metric-value">{metric.value}</b><span className="metric-caption">{metric.label === 'Total sales' ? 'Verified payments' : 'In your workspace'}</span></article>)}</div><section className="content-card dashboard-table-card"><div className="content-card-heading"><div><h2>Recent orders</h2><p>Your latest customer requests.</p></div><button className="text-link" onClick={() => navigate('orders')}>View all <Icon name="arrow" size={15} /></button></div><OrderTable orders={orders} onView={openOrder} mode="compact" /></section><section className="dashboard-tip"><span><Icon name="shield" size={19} /></span><div><b>Payment first, then print.</b><p>Orders stay pending until full payment is verified. Once confirmed, move them into processing.</p></div><button className="text-link" onClick={() => navigate('orders')}>Review pending <Icon name="arrow" size={15} /></button></section></>
  }

  function renderOrderDetails() {
    if (!currentOrder) return <section className="content-card"><EmptyState title="Order not found" description="This order is not available in the server records." action={<Button onClick={() => navigate('orders')}>Back to orders</Button>} /></section>
    const statusTransitions: Partial<Record<OrderStatus, OrderStatus>> = {
      'Pending Payment': 'Cancelled',
      Paid: 'Processing',
      Processing: 'Ready for Pickup',
      'Ready for Pickup': 'Completed',
    }
    const nextStatus = statusTransitions[currentOrder.status]
    return (
      <>
        <div className="detail-back-row"><button className="back-link" onClick={() => navigate('orders')}><Icon name="arrow" size={16} /> Back to orders</button><span className="table-subtext">Order placed {new Date(currentOrder.createdAt).toLocaleString()}</span></div>
        <section className="detail-hero content-card"><div className="detail-reference-icon"><Icon name="file" size={23} /></div><div className="detail-hero-copy"><span className="eyebrow">Print order</span><h2>{currentOrder.reference}</h2><span>For {currentOrder.customerName}</span></div><div className="detail-badges"><StatusBadge status={currentOrder.status} /><PaymentBadge status={currentOrder.paymentStatus} /></div></section>
        <div className="detail-grid">
          <section className="content-card detail-card">
            <div className="content-card-heading"><div><h2>Order information</h2><p>Specifications and customer instructions.</p></div></div>
            <div className="detail-list"><div><span>Customer</span><b>{currentOrder.customerName}</b></div><div><span>Contact number</span><b>{currentOrder.contactNumber}</b></div><div><span>Email</span><b>{currentOrder.email || 'Not provided'}</b></div><div><span>Service</span><b>{currentOrder.service}</b></div><div><span>Paper & color</span><b>{currentOrder.paperSize} · {currentOrder.color}</b></div><div><span>Quantity</span><b>{currentOrder.quantity} {quantityUnit(currentOrder.service, currentOrder.quantity)}</b></div><div className="detail-total"><span>Agreed final price</span><b>{formatCurrency(currentOrder.total)}</b></div></div>
            {currentOrder.instructions && <div className="detail-instructions"><b>Customer instructions</b><p>{currentOrder.instructions}</p></div>}
          </section>
          <section className="content-card detail-card">
            <div className="content-card-heading"><div><h2>Attached file</h2><p>Protected upload · staff access only.</p></div></div>
            <div className="file-card"><span className="file-icon"><Icon name="file" size={22} /></span><div><b>{currentOrder.fileName || 'No file attached'}</b><span>Stored privately on the PrintHub server</span></div><button className="icon-button" aria-label="Download order file" onClick={() => void downloadOrderFile(currentOrder)}><Icon name="download" /></button></div>
            <div className="content-card-heading payment-heading"><div><h2>PayMongo payment</h2><p>Only a verified test-mode payment can mark this order paid.</p></div>{currentOrder.paymentStatus === 'Paid' && <Badge tone="green"><Icon name="check" size={13} /> Verified</Badge>}</div>
            {currentOrder.paymentStatus === 'Paid'
              ? <div className="payment-record"><span className="record-icon"><Icon name="check" size={18} /></span><div><b>GCash · PayMongo TEST</b><span>{currentOrder.paymentReference ? `Payment ${currentOrder.paymentReference} · ` : ''}{currentOrder.paidAt ? new Date(currentOrder.paidAt).toLocaleString() : 'Confirmed by PayMongo webhook'}</span><strong>{formatCurrency(currentOrder.total)} · Verified by server</strong></div></div>
              : <div className="unpaid-record"><span><Icon name="info" size={17} /></span><div><b>Payment {currentOrder.paymentStatus}</b><p>The order cannot enter the print queue until PayMongo verifies a successful GCash payment.</p></div></div>}
          </section>
          <section className="content-card detail-card detail-timeline-card"><div className="content-card-heading"><div><h2>Order progress</h2><p>Paid orders only can move into printing.</p></div></div><OrderTimeline order={currentOrder} /><div className="order-action-row">{nextStatus && (nextStatus === 'Cancelled' || currentOrder.paymentStatus === 'Paid') ? <Button variant={nextStatus === 'Cancelled' ? 'secondary' : 'primary'} onClick={() => changeOrderStatus(currentOrder, nextStatus)}>{nextStatus === 'Processing' ? 'Start printing' : nextStatus === 'Ready for Pickup' ? 'Mark ready for pickup' : nextStatus === 'Completed' ? 'Mark completed' : 'Cancel unpaid order'} <Icon name="arrow" size={16} /></Button> : currentOrder.status === 'Completed' || currentOrder.status === 'Cancelled' ? <StatusBadge status={currentOrder.status} /> : <Button variant="secondary" disabled>Awaiting verified GCash payment</Button>}</div></section>
        </div>
      </>
    )
  }

  function renderPricing() {
    return <section className="content-card pricing-card"><div className="content-card-heading"><div><span className="eyebrow">Admin settings</span><h2>Printing price list</h2><p>Update unit rates by service and paper size. New orders use server-stored prices.</p></div><Badge tone="pink"><Icon name="settings" size={14} /> Owner access</Badge></div><div className="pricing-callout"><Icon name="info" size={17} /><span>Rate changes are saved to the backend and apply only to new orders. Existing agreed prices are unchanged.</span></div><div className="table-scroll"><table className="pricing-table"><thead><tr><th>Service</th><th>Paper size</th><th>Black & white / page</th><th>Color / page</th><th>Availability</th></tr></thead><tbody>{pricing.map((rule) => <tr key={rule.id}><td><b>{rule.service}</b></td><td>{rule.paperSize}</td><td><label className="rate-input"><span>₱</span><input aria-label={`${rule.service} ${rule.paperSize} black and white unit rate`} min="0" step="0.5" type="number" value={rule.blackAndWhite} onChange={(event) => updatePricing(rule.id, { blackAndWhite: Math.max(0, Number(event.target.value)) })} /></label></td><td><label className="rate-input"><span>₱</span><input aria-label={`${rule.service} ${rule.paperSize} color unit rate`} min="0" step="0.5" type="number" value={rule.color} onChange={(event) => updatePricing(rule.id, { color: Math.max(0, Number(event.target.value)) })} /></label></td><td><button className={`toggle-switch${rule.active ? ' enabled' : ''}`} role="switch" aria-checked={rule.active} aria-label={`${rule.service} ${rule.paperSize} ${rule.active ? 'active' : 'inactive'}`} onClick={() => void updatePricing(rule.id, { active: !rule.active })}><span /></button><span className="toggle-label">{rule.active ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div><div className="pricing-footer"><span><Icon name="shield" size={16} /> Staff cannot change a customer's agreed price.</span><span>All prices shown in PHP per page.</span></div></section>
  }

  function renderStaffAccess() {
    return <><section className="content-card staff-access-card"><div className="content-card-heading"><div><span className="eyebrow">Admin settings</span><h2>Staff access</h2><p>Manage who can sign in to the shop workspace.</p></div><Badge tone="pink"><Icon name="users" size={14} /> {staff.length} accounts</Badge></div><form className="invite-form" onSubmit={addStaff}><Field label="Add a staff email" required hint="This demo records the access entry only; invitations and passwords need backend support."><div className="invite-row"><input className="input" type="email" value={newStaffEmail} onChange={(event) => setNewStaffEmail(event.target.value)} placeholder="teammate@example.com" /><Button type="submit"><Icon name="plus" size={16} /> Add staff</Button></div></Field></form><div className="staff-list">{staff.map((member) => <div className="staff-row" key={member.id}><span className="staff-avatar">{member.name.slice(0, 1).toUpperCase()}</span><div className="staff-member-name"><b>{member.name}</b><span>{member.email}</span></div><Badge tone={member.role === 'Admin' ? 'purple' : 'neutral'}>{member.role}</Badge><button className={`toggle-switch${member.active ? ' enabled' : ''}`} role="switch" aria-checked={member.active} aria-label={`${member.active ? 'Deactivate' : 'Activate'} ${member.email}`} disabled={member.role === 'Admin'} onClick={() => setStaff((previous) => previous.map((item) => item.id === member.id ? { ...item, active: !item.active } : item))}><span /></button><span className="toggle-label">{member.active ? 'Active' : 'Inactive'}</span></div>)}</div><div className="pricing-footer"><span><Icon name="lock" size={16} /> Real role-based access enforcement requires backend authentication.</span><span>Passwords are never stored in this demo.</span></div></section><section className="access-note"><span className="feature-icon icon-lilac"><Icon name="shield" size={19} /></span><div><b>Protect your shop workspace</b><p>For deployment, connect staff invitations, role permissions, and account status to a trusted authentication service.</p></div></section></>
  }

  return <>
    {!isStaffPage && page === 'home' && renderLanding()}
    {!isStaffPage && page === 'order' && renderOrder()}
    {!isStaffPage && page === 'confirmation' && renderConfirmation()}
    {!isStaffPage && page === 'payment-result' && renderPaymentResult()}
    {!isStaffPage && page === 'track' && renderTracking()}
    {!isStaffPage && page === 'login' && renderLogin()}
    {isStaffPage && renderStaffLayout()}
    {statusChange && <Modal title={`Move order to ${statusChange.status}?`} onClose={() => setStatusChange(null)}><div className="status-confirmation"><p className="modal-description">{statusChange.status === 'Processing' ? 'Payment has been verified. Confirm that the shop is ready to begin printing this order.' : statusChange.status === 'Ready for Pickup' ? 'Confirm that printing is complete and the customer can collect their order.' : 'Confirm that this order has been picked up and is closed.'}</p><div className="modal-actions"><Button variant="secondary" onClick={() => setStatusChange(null)}>Cancel</Button><Button onClick={confirmOrderStatus}>Confirm status update <Icon name="arrow" size={16} /></Button></div></div></Modal>}
    {toast && <div className="toast-message" role="status"><Icon name="check" size={17} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><Icon name="close" size={15} /></button></div>}
  </>
}

export default App
