import { useState } from 'react'
import { feed } from '../api'
import { REPORT_REASONS } from '../config'
import { errText } from '../lib/errors'
import { Sheet, Field } from './ui'
import { useApp } from '../app/context'

// target_type: post | comment | message | user | anonymous_session  (matches reports.target_type)
export default function ReportSheet({ type, id, onClose }) {
  const { toast } = useApp()
  const [reason, setReason] = useState(REPORT_REASONS[0]); const [details, setDetails] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const send = async () => {
    setBusy(true); setErr('')
    try { await feed.report(type, id, reason, details.trim().slice(0, 2000)); toast('Report sent. Thank you.'); onClose() }
    catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  return <Sheet title="Report" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={send}>{busy ? 'Sending' : 'Send report'}</button></>}>
    <div style={{ display: 'grid', gap: 12 }}>
      <Field label="Reason"><select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
      <Field label="Details (optional)"><textarea className="input" maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell moderators what happened" /></Field>
      {err && <div className="err">{err}</div>}</div></Sheet>
}
