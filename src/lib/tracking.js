const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function trackUrl(params) {
  const base = `${SUPABASE_URL}/functions/v1/track`
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) qs.set(k, String(v))
  })
  return `${base}?${qs.toString()}`
}

export function buildTrackingPixel({ tenantId, customerId, taskId, queueId, stepQueueId, channel }) {
  return trackUrl({
    t: 'open',
    tid: tenantId,
    cid: customerId,
    bid: taskId,
    qid: queueId,
    sid: stepQueueId,
    ch: channel,
  })
}

export function buildClickUrl({ tenantId, customerId, taskId, queueId, stepQueueId, channel, url }) {
  return trackUrl({
    t: 'click',
    tid: tenantId,
    cid: customerId,
    bid: taskId,
    qid: queueId,
    sid: stepQueueId,
    ch: channel,
    url,
  })
}

export function injectEmailTracking(htmlContent, trackingParams) {
  const pixelUrl = buildTrackingPixel(trackingParams)
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`

  let tracked = rewriteUrls(htmlContent, trackingParams)
  tracked += pixel

  return tracked
}

export function rewriteUrls(content, trackingParams) {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/g
  const supabaseHost = new URL(SUPABASE_URL).host

  return content.replace(urlRegex, (match) => {
    if (match.includes(supabaseHost)) return match
    return buildClickUrl({ ...trackingParams, url: match })
  })
}

export function buildSmsContent(text, trackingParams) {
  return rewriteUrls(text, trackingParams)
}
