import { useMemo, useState } from 'react'
import { formatCurrency } from '../../pricing'
import type { OrderStatus, PaymentStatus, PrintOrder } from '../../types'
import { Icon } from '../Icon'
import { EmptyState, PaymentBadge, StatusBadge } from '../common/Primitives'
import { quantityUnit } from '../../utils/format'

const allStatuses: OrderStatus[] = ['Pending Payment', 'Paid', 'Processing', 'Ready for Pickup', 'Completed', 'Cancelled']
const paymentStatuses: PaymentStatus[] = ['Unpaid', 'Pending', 'Paid', 'Failed', 'Expired', 'Refunded']

export function OrderTable({
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
          <label className="select-filter"><select aria-label="Filter by payment status" value={paymentFilter} onChange={(event) => { setPaymentFilter(event.target.value); setPage(1) }}><option>All payments</option>{paymentStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
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
