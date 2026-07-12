import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const LINE_ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    function buildTrackPixelUrl(params: Record<string, string | undefined>) {
        const qs = new URLSearchParams()
        Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
        return `${supabaseUrl}/functions/v1/track?${qs.toString()}`
    }

    function rewriteUrlsForTracking(content: string, params: Record<string, string | undefined>) {
        const host = new URL(supabaseUrl).host
        return content.replace(/https?:\/\/[^\s<>"')\]]+/g, (match: string) => {
            if (match.includes(host)) return match
            return buildTrackPixelUrl({ ...params, t: 'click', url: match })
        })
    }

    try {
        const now = new Date().toISOString()
        console.log(`[自動ステップエンジン起動] 現在時刻: ${now}`)

        // 0. 滞留検知シナリオの評価（例: 会員登録のまま3日間、面談予約に進まない候補者を自動フォロー）
        const { data: inactivityScenarios } = await supabase
            .from('step_scenario_defs')
            .select('*, step_scenario_items(*)')
            .eq('is_active', true)
            .not('trigger_stage', 'is', null)
            .not('trigger_days', 'is', null)

        for (const scenario of inactivityScenarios || []) {
            const thresholdDate = new Date(Date.now() - scenario.trigger_days * 24 * 60 * 60 * 1000).toISOString()

            const { data: staleCustomers } = await supabase
                .from('customers')
                .select('id, tenant_id, name')
                .eq('tenant_id', scenario.tenant_id)
                .eq('pipeline_stage', scenario.trigger_stage)
                .lte('created_at', thresholdDate)

            if (!staleCustomers || staleCustomers.length === 0) continue

            const items = (scenario.step_scenario_items || []).sort((a: any, b: any) => a.step_number - b.step_number)
            if (items.length === 0) continue

            for (const customer of staleCustomers) {
                // 既にこのシナリオでキュー登録済みなら再送しない
                const { data: existing } = await supabase
                    .from('step_broadcast_queues')
                    .select('id')
                    .eq('customer_id', customer.id)
                    .eq('scenario_def_id', scenario.id)
                    .limit(1)

                if (existing && existing.length > 0) continue

                console.log(`[滞留検知] ${customer.name} が「${scenario.trigger_stage}」に${scenario.trigger_days}日以上滞留 → シナリオ「${scenario.name}」を起動`)

                const nowMs = Date.now()
                const insertData = items.map((item: any) => ({
                    tenant_id: customer.tenant_id,
                    customer_id: customer.id,
                    step_number: item.step_number,
                    delivery_channel: item.delivery_channel,
                    template_id: item.template_id || null,
                    scheduled_at: new Date(nowMs + (item.delay_minutes || 0) * 60 * 1000).toISOString(),
                    status: '未送信',
                    scenario_def_id: scenario.id,
                }))

                await supabase.from('step_broadcast_queues').insert(insertData)
            }
        }

        // 1. 未送信の予約タスクを取得
        const { data: pendingQueues, error: fetchError } = await supabase
            .from('step_broadcast_queues')
            .select('*, customers(*)')
            .lte('scheduled_at', now)
            .eq('status', '未送信')

        if (fetchError) throw fetchError
        console.log(`[ログ] 配信対象のユーザー数: ${pendingQueues?.length || 0}名`)

        if (pendingQueues && pendingQueues.length > 0) {
            for (const q of pendingQueues) {
                const customer = q.customers
                const channel = q.delivery_channel

                console.log(`[配信処理開始] 顧客: ${customer.name}, チャネル: ${channel}, ステップ: ${q.step_number}`)

                let textContent = `【ステップ${q.step_number}】自動追客メッセージです。`
                let flexJson = null

                // 💡 2. 画面で選んだ template_id があれば、自作アセットをデータベースから引っ張る！
                let messagesJson = null
                if (q.template_id) {
                    const { data: template } = await supabase
                        .from('broadcast_templates')
                        .select('*')
                        .eq('id', q.template_id)
                        .single()

                    if (template) {
                        textContent = template.content
                        flexJson = template.flex_json
                        messagesJson = template.messages_json
                    }
                }

                const trackParams = {
                    tid: q.tenant_id,
                    cid: customer.id,
                    sid: q.id,
                    ch: channel,
                }

                if (channel === 'Email') {
                    textContent = rewriteUrlsForTracking(textContent, trackParams)
                    const pixelUrl = buildTrackPixelUrl({ ...trackParams, t: 'open' })
                    textContent += `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`
                } else {
                    textContent = rewriteUrlsForTracking(textContent, trackParams)
                }

                let sendStatus = '送信成功'

                if (channel === 'LINE' && customer.line_uid && customer.line_uid !== '未連携') {
                    console.log(`-> LINEに送信中: ${customer.line_uid}`)

                    const messagePayloads = Array.isArray(messagesJson) && messagesJson.length > 0
                        ? messagesJson.slice(0, 5)
                        : flexJson
                            ? [{ type: "flex", altText: "AI Omni CRMからのメッセージ", contents: flexJson }]
                            : [{ type: 'text', text: textContent }]

                    try {
                        const res = await fetch('https://api.line.me/v2/bot/message/push', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
                            },
                            body: JSON.stringify({
                                to: customer.line_uid,
                                messages: messagePayloads
                            })
                        })

                        if (!res.ok) {
                            const errBody = await res.text()
                            console.error(`[LINE送信失敗] status=${res.status} body=${errBody}`)
                            sendStatus = '送信失敗'
                        }
                    } catch (lineErr) {
                        console.error(`[LINE送信エラー] ${lineErr.message}`)
                        sendStatus = '送信失敗'
                    }
                } else if (channel !== 'LINE') {
                    console.log(`-> [${channel}] 送信スキップ（未実装チャネル）`)
                    sendStatus = '送信スキップ'
                } else {
                    console.log(`-> LINE UID未連携のためスキップ: ${customer.name}`)
                    sendStatus = '送信スキップ'
                }

                await supabase
                    .from('step_broadcast_queues')
                    .update({ status: sendStatus })
                    .eq('id', q.id)
            }
        }

        return new Response(JSON.stringify({ success: true, processed: pendingQueues?.length || 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error(`[エラー]: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})