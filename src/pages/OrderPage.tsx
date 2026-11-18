import type { ChangeEvent, Dispatch, DragEvent, FormEventHandler, RefObject, SetStateAction } from 'react'
import { Icon } from '../components/Icon'
import { Button, Field, Logo } from '../components/common/Primitives'
import { ACCEPTED_DOCUMENT_TYPES, ACCEPTED_FILE_TYPES, PAPER_SIZES, SERVICES } from '../data'
import { formatCurrency } from '../pricing'
import type { PricingRule, PrintColor, PrintService } from '../types'
import { MAX_ORDER_QUANTITY, type OrderForm, type Page } from '../types/app'
import { quantityUnit } from '../utils/format'

type OrderPageProps = {
  navigate: (page: Page) => void
  form: OrderForm
  setForm: Dispatch<SetStateAction<OrderForm>>
  orderStep: number
  setOrderStep: Dispatch<SetStateAction<number>>
  total: number | null
  unitPrice: number | null
  pricing: PricingRule[]
  uploadedFile: File | null
  setUploadedFile: Dispatch<SetStateAction<File | null>>
  automaticPageCount: boolean
  setAutomaticPageCount: Dispatch<SetStateAction<boolean>>
  formError: string
  setFormError: Dispatch<SetStateAction<string>>
  acceptedPrice: boolean
  setAcceptedPrice: Dispatch<SetStateAction<boolean>>
  isReadingFile: boolean
  fileInput: RefObject<HTMLInputElement | null>
  handleFile: (file: File | undefined) => Promise<void>
  handleFileDrop: (event: DragEvent<HTMLDivElement>) => void
  continueOrder: () => void
  orderSubmitting: boolean
  checkoutLoading: boolean
  submitOrder: FormEventHandler<HTMLFormElement>
}

export function OrderPage({ navigate, form, setForm, orderStep, setOrderStep, total, unitPrice, pricing, uploadedFile, setUploadedFile, automaticPageCount, setAutomaticPageCount, formError, setFormError, acceptedPrice, setAcceptedPrice, isReadingFile, fileInput, handleFile, handleFileDrop, continueOrder, orderSubmitting, checkoutLoading, submitOrder }: OrderPageProps) {    const steps = ['Print details', 'Add your file', 'Price summary', 'Review & confirm']
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
