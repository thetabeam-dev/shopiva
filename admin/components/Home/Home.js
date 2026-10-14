import React, { useEffect, useState } from 'react'
import './style.css'

export default function Home({ onNavigate }) {
  const [metrics, setMetrics] = useState(null)
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    let mounted = true
    const fetchOverview = async () => {
      try {
        const [metricsResponse, countsResponse] = await Promise.all([
          fetch('/api/home'),
          fetch('/api/menu-counts'),
        ])
        const [metricsJson, countsJson] = await Promise.all([
          metricsResponse.json(),
          countsResponse.json(),
        ])
        if (mounted && metricsResponse.ok && metricsJson.metrics) setMetrics(metricsJson.metrics)
        if (mounted && countsResponse.ok) setCounts(countsJson)
      } catch (err) {
        console.error(err)
      }
    }
    fetchOverview()
    return () => { mounted = false }
  }, [])

  const metricCards = [
    { label: 'Total users', value: metrics?.totalUsers },
    { label: 'Active users', value: metrics?.activeUsers },
    { label: 'Admin users', value: metrics?.adminUsers },
    { label: 'Products', value: counts?.products },
    { label: 'Orders', value: counts?.orders },
    { label: 'Shops', value: counts?.shops },
  ]

  return (
    <section className="dashboard-home">
      <div className="dashboard-header">
        <div>
          <span className="section-kicker">OVERVIEW</span>
          <h1>Store operations</h1>
          <p>A live view of the people, catalog, and orders moving through Shopiva.</p>
        </div>
        <div className="dashboard-actions">
          <button type="button" className="button-secondary" onClick={() => onNavigate('Products')}>Open products</button>
          <button type="button" onClick={() => onNavigate('Orders')}>Review orders</button>
        </div>
      </div>

      <div className="metric-grid">
        {metricCards.map((metric) => (
          <article key={metric.label} className="metric-card">
            <span>{metric.label}</span>
            <strong>{metric.value ?? '—'}</strong>
          </article>
        ))}
      </div>

      <div className="summary-panels">
        <section className="panel panel-summary">
          <span className="section-kicker">QUICK ACCESS</span>
          <h2>Operational areas</h2>
          <p>Jump directly to a queue or record set that needs a closer look.</p>
          <ul>
            {[
              ['Shop KYC', 'Pending verification', counts?.shopKyc],
              ['Disputes', 'Dispute records', counts?.disputes],
              ['Returns', 'Return requests', counts?.returns],
            ].map(([page, label, count]) => (
              <li key={page}>
                <button type="button" className="overview-link" onClick={() => onNavigate(page)}>
                  <span>{label}</span>
                  <strong>{count ?? '—'}</strong>
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel panel-focus">
          <span className="section-kicker">WORKSPACE</span>
          <h2>Keep the day moving</h2>
          <p>Use the left navigation to manage individual records. Counts refresh automatically as teams work.</p>
          <div className="focus-actions">
            <button type="button" className="text-action" onClick={() => onNavigate('Inventory')}>Check inventory <span aria-hidden="true">&rarr;</span></button>
            <button type="button" className="text-action" onClick={() => onNavigate('Transactions')}>Review transactions <span aria-hidden="true">&rarr;</span></button>
          </div>
        </section>
      </div>
    </section>
  )
}
