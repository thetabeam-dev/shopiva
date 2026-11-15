"use client"

import Link from "next/link"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import "./inbox.css"

function InboxInner() {
  const searchParams = useSearchParams()
  const customerId = searchParams.get("customerId")
  const orderId = searchParams.get("orderId")
  const shopId = searchParams.get("shopId")

  return (
    <div className="entrepreneur-inbox-page">
      <p className="entrepreneur-inbox-back">
        <Link href="/entrepreneur/orders">← Back to orders</Link>
      </p>
      <h1 className="entrepreneur-inbox-title">Vendor messages — Making Commerce Safe For Everyone</h1>
      {customerId ? (
        <p className="entrepreneur-inbox-sub">
          Conversation with customer <strong>#{customerId}</strong>
          {orderId ? (
            <>
              {" "}
              · order <strong>#{orderId}</strong>
            </>
          ) : null}
          {shopId ? (
            <>
              {" "}
              · shop <strong>#{shopId}</strong>
            </>
          ) : null}
        </p>
      ) : (
        <p className="entrepreneur-inbox-sub">Open a chat from an order that has a registered customer.</p>
      )}
      <div className="entrepreneur-inbox-placeholder">
        <p>Your messages with this customer will show here once in-app chat is connected.</p>
      </div>
    </div>
  )
}

export default function EntrepreneurInboxPage() {
  return (
    <Suspense fallback={<p className="entrepreneur-inbox-loading">Loading…</p>}>
      <InboxInner />
    </Suspense>
  )
}
