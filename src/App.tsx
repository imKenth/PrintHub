import { useEffect, useRef, useState, type DragEvent, type FormEvent, type MouseEvent } from 'react'
import { Icon } from './components/Icon'
import { Badge, Button, EmptyState, Field, Logo, Modal, OrderTimeline, PaymentBadge, PrinterIllustration, StatusBadge } from './components/common/Primitives'
import { OrderTable } from './components/orders/OrderTable'
import { ACCEPTED_DOCUMENT_TYPES, ACCEPTED_FILE_TYPES, MAX_FILE_SIZE, MOCK_STAFF } from './data'
import { formatCurrency, getUnitPrice } from './pricing'
import type { OrderStatus, PrintOrder, PricingRule, StaffMember } from './types'
import { apiRequest, downloadOrderFile as downloadFile, fileToBase64 } from './services/api'
import { initialForm, MAX_ORDER_QUANTITY, protectedPages, adminPages, landingSections, publicPages, type OrderForm, type Page } from './types/app'
import { quantityUnit, smoothScrollTo } from './utils/format'
import { HomePage } from './pages/HomePage'
import { OrderPage } from './pages/OrderPage'
import { StaffLoginPage } from './pages/StaffLoginPage'
import './App.css'

function App() {
  const [page, setPage] = useState<Page>(() => {
    if (new URLSearchParams(window.location.search).has('payment')) return 'payment-result'
    const initial = window.location.hash.slice(1) as Page
    if (protectedPages.includes(initial) || adminPages.includes(initial)) return 'login'
    return publicPages.includes(initial) ? initial : 'home'
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
      if (landingSections.includes(target)) {
        setPage('home')
        window.requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' }))
        return
      }
      if (protectedPages.includes(target) && !currentUser) {
        setPage('login')
        return
      }
      if (adminPages.includes(target) && currentUser?.role !== 'Admin') {
        setPage(currentUser ? 'dashboard' : 'login')
        return
      }
      setPage(publicPages.includes(target) ? target : 'home')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [currentUser])

  useEffect(() => {
    document.title = `${page === 'home' ? 'PrintHub' : `${page.replace('-', ' ')} · PrintHub`}`
  }, [page])

  useEffect(() => {
    if (page !== 'home') return
    const elements = document.querySelectorAll<HTMLElement>('.scroll-reveal')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        entry.target.classList.remove('reveal-pending')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0, rootMargin: '0px 0px -48px 0px' })

    elements.forEach((element) => {
      element.classList.add('reveal-pending')
      observer.observe(element)
    })
    return () => {
      observer.disconnect()
      elements.forEach((element) => element.classList.remove('reveal-pending'))
    }
  }, [page])

  useEffect(() => {
    if (page !== 'home') return
    const sectionId = window.location.hash.slice(1)
    if (!landingSections.includes(sectionId)) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    })
    return () => window.cancelAnimationFrame(frame)
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

  function scrollToLandingSection(event: MouseEvent<HTMLAnchorElement>, sectionId: string) {
    event.preventDefault()
    window.history.replaceState({}, '', `#${sectionId}`)
    const section = document.getElementById(sectionId)
    if (!section) return

    const headerHeight = document.querySelector('.public-header')?.getBoundingClientRect().height ?? 0
    const destination = Math.max(0, window.scrollY + section.getBoundingClientRect().top - headerHeight - 16)
    smoothScrollTo(destination)
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
      await downloadFile(order.reference, order.fileName)
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
    return <HomePage onNavigate={navigate} onStartOrder={startOrder} onGoHome={() => {
      if (page !== 'home') {
        setPage('home')
        setMobileNavOpen(false)
        window.history.replaceState({}, '', '#home')
        window.requestAnimationFrame(() => smoothScrollTo(0))
        return
      }
      window.history.replaceState({}, '', '#home')
      smoothScrollTo(0)
    }} onScrollToSection={scrollToLandingSection} />
  }
  function renderOrder() {
    return <OrderPage navigate={navigate} form={form} setForm={setForm} orderStep={orderStep} setOrderStep={setOrderStep} total={total} unitPrice={unitPrice} pricing={pricing} uploadedFile={uploadedFile} setUploadedFile={setUploadedFile} automaticPageCount={automaticPageCount} setAutomaticPageCount={setAutomaticPageCount} formError={formError} setFormError={setFormError} acceptedPrice={acceptedPrice} setAcceptedPrice={setAcceptedPrice} isReadingFile={isReadingFile} fileInput={fileInput} handleFile={handleFile} handleFileDrop={handleFileDrop} continueOrder={continueOrder} orderSubmitting={orderSubmitting} checkoutLoading={checkoutLoading} submitOrder={submitOrder} />
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
    {!isStaffPage && page === 'login' && <StaffLoginPage email={loginEmail} password={loginPassword} showPassword={showPassword} error={loginError} onEmailChange={setLoginEmail} onPasswordChange={setLoginPassword} onTogglePassword={() => setShowPassword(!showPassword)} onSubmit={login} onNavigateHome={() => navigate('home')} />}
    {isStaffPage && renderStaffLayout()}
    {statusChange && <Modal title={`Move order to ${statusChange.status}?`} onClose={() => setStatusChange(null)}><div className="status-confirmation"><p className="modal-description">{statusChange.status === 'Processing' ? 'Payment has been verified. Confirm that the shop is ready to begin printing this order.' : statusChange.status === 'Ready for Pickup' ? 'Confirm that printing is complete and the customer can collect their order.' : 'Confirm that this order has been picked up and is closed.'}</p><div className="modal-actions"><Button variant="secondary" onClick={() => setStatusChange(null)}>Cancel</Button><Button onClick={confirmOrderStatus}>Confirm status update <Icon name="arrow" size={16} /></Button></div></div></Modal>}
    {toast && <div className="toast-message" role="status"><Icon name="check" size={17} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><Icon name="close" size={15} /></button></div>}
  </>
}

export default App
