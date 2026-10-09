"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReviewActions({ shopId, docKey }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState('');

  const submitAction = async (action) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/shop-kyc/${shopId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, docKey }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || 'Unable to update document status');
      }

      setCompleted(true);
      setFeedback(`Document ${action === 'approve' ? 'approved' : 'rejected'}.`);
      router.refresh();
    } catch (error) {
      setFeedback(error.message ?? String(error));
      setBusy(false);
    }
  };

  return (
    <div className="review-actions">
      <button type="button" disabled={busy || completed} onClick={() => submitAction('approve')} className="review-button approve">
        {busy ? 'Saving…' : 'Approve'}
      </button>
      <button type="button" disabled={busy || completed} onClick={() => submitAction('reject')} className="review-button reject">
        {busy ? 'Saving…' : 'Reject'}
      </button>
      {feedback && <p className="review-feedback" role="status">{feedback}</p>}
    </div>
  );
}
