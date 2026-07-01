import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-line-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') ?? ''
  const LINE_ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN') ?? ''

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await req.text()

    // LINE署名検証
    const signature = req.headers.get('x-line-signature')
    if (LINE_CHANNEL_SECRET && signature) {
      const hmac = createHmac('sha256', LINE_CHANNEL_SECRET)
      hmac.update(body)
      const expected = btoa(String.fromCharCode(...new Uint8Array(hmac.digest())))
      if (expected !== signature) {
        console.error('[署名検証失敗]', signature)
        return new Response('Unauthorized', { status: 401 })
      }
    }

    const payload = JSON.parse(body)
    const events = payload.events || []

    for (const event of events) {
      const lineUid = event.source?.userId
      if (!lineUid) continue

      // テナントIDをLINE_ACCESS_TOKENから特定（tenant_channels から引く）
      const { data: channelRow } = await supabase
        .from('tenant_channels')
        .select('tenant_id, config')
        .eq('channel', 'LINE')
        .limit(1)
        .single()

      const tenantId = channelRow?.tenant_id
      if (!tenantId) {
        console.warn('[テナント特定失敗] LINE_ACCESS_TOKEN に対応するテナントが見つかりません')
        continue
      }

      // 既存顧客の検索
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, name, segment')
        .eq('tenant_id', tenantId)
        .eq('line_uid', lineUid)
        .maybeSingle()

      // 友だち追加イベント
      if (event.type === 'follow') {
        // LINEプロフィール取得
        let displayName = `LINE_${lineUid.substring(0, 8)}`
        try {
          const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${lineUid}`, {
            headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` },
          })
          if (profileRes.ok) {
            const profile = await profileRes.json()
            displayName = profile.displayName || displayName
          }
        } catch (_) { /* プロフィール取得失敗は無視 */ }

        if (!existingCustomer) {
          await supabase.from('customers').insert([{
            tenant_id: tenantId,
            name: displayName,
            line_uid: lineUid,
            segment: '未診断',
          }])
          console.log(`[友だち追加] ${displayName} (${lineUid}) を新規顧客として登録`)
        } else {
          // 既存顧客のラインUID確認（名前更新）
          await supabase.from('customers').update({ name: displayName }).eq('id', existingCustomer.id)
          console.log(`[友だち再追加] ${displayName} (${lineUid})`)
        }

        // ウェルカムメッセージ送信（テキストノードの最初のメッセージ）
        await sendWelcomeMessage(supabase, tenantId, lineUid, LINE_ACCESS_TOKEN)
        continue
      }

      if (!existingCustomer) continue

      // メッセージイベント（ユーザーの回答）
      if (event.type === 'message' && event.message?.type === 'text') {
        const text = event.message.text.trim()
        await processUserAnswer(supabase, tenantId, existingCustomer, text, lineUid, LINE_ACCESS_TOKEN)
      }

      // ポストバックイベント（ボタンタップ）
      if (event.type === 'postback') {
        const data = event.postback?.data || ''
        await processUserAnswer(supabase, tenantId, existingCustomer, data, lineUid, LINE_ACCESS_TOKEN)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[webhook エラー]', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

async function getActiveFlow(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await supabase
    .from('survey_campaigns')
    .select('id, flow_json')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle()
  return data
}

async function sendWelcomeMessage(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  lineUid: string,
  token: string,
) {
  const campaign = await getActiveFlow(supabase, tenantId)
  if (!campaign?.flow_json?.nodes) return

  const nodes = campaign.flow_json.nodes as Array<{ type: string; data: Record<string, string> }>
  const textNode = nodes.find(n => n.type === 'text')
  const message = textNode?.data?.message || 'ようこそ！診断を開始します。'

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: lineUid, messages: [{ type: 'text', text: message }] }),
  })
}

async function processUserAnswer(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  customer: { id: string; name: string; segment: string | null },
  text: string,
  lineUid: string,
  token: string,
) {
  const campaign = await getActiveFlow(supabase, tenantId)
  if (!campaign?.flow_json?.nodes) return

  const nodes = campaign.flow_json.nodes as Array<{
    id: string; type: string; data: Record<string, unknown>
  }>
  const connections = (campaign.flow_json.connections || []) as Array<{
    from: string; fromPort: number; to: string
  }>

  // タグノードを全検索してマッチング
  const tagNodes = nodes.filter(n => n.type === 'tag')
  for (const node of tagNodes) {
    const conditions = (node.data.conditions || []) as Array<{ match: string; tag: string }>
    for (const cond of conditions) {
      if (!cond.match) continue
      if (text.toLowerCase().includes(cond.match.toLowerCase())) {
        // セグメント更新
        const newSegment = cond.tag || customer.segment
        await supabase.from('customers').update({ segment: newSegment }).eq('id', customer.id)
        console.log(`[タグマッチ] "${text}" → セグメント: ${newSegment}`)

        // マッチしたポートから繋がるノードを実行
        const portIdx = conditions.indexOf(cond)
        const nextConn = connections.find(c => c.from === node.id && c.fromPort === portIdx)
        if (nextConn) {
          const nextNode = nodes.find(n => n.id === nextConn.to)
          if (nextNode) await executeNode(supabase, nextNode, lineUid, token, tenantId, customer.id)
        }
        return
      }
    }
  }
}

async function executeNode(
  supabase: ReturnType<typeof createClient>,
  node: { id: string; type: string; data: Record<string, unknown> },
  lineUid: string,
  token: string,
  tenantId: string,
  customerId: string,
) {
  if (node.type === 'text') {
    const text = String(node.data.message || '')
    if (text) {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: lineUid, messages: [{ type: 'text', text }] }),
      })
    }
  } else if (node.type === 'flex') {
    const templateId = String(node.data.templateId || '')
    if (templateId) {
      const { data: tmpl } = await supabase
        .from('broadcast_templates')
        .select('flex_json, content')
        .eq('id', templateId)
        .maybeSingle()
      if (tmpl) {
        const msg = tmpl.flex_json
          ? { type: 'flex', altText: tmpl.content || 'オファー', contents: tmpl.flex_json }
          : { type: 'text', text: tmpl.content || '' }
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ to: lineUid, messages: [msg] }),
        })
      }
    }
  } else if (node.type === 'cta') {
    const label = String(node.data.label || 'こちらをタップ')
    const url = String(node.data.url || '')
    if (url) {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: lineUid,
          messages: [{
            type: 'template',
            altText: label,
            template: { type: 'buttons', text: label, actions: [{ type: 'uri', label, uri: url }] },
          }],
        }),
      })
    }
  }

  console.log(`[ノード実行] type=${node.type} uid=${lineUid}`)
}
