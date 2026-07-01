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
                if (q.template_id) {
                    const { data: template } = await supabase
                        .from('broadcast_templates')
                        .select('*')
                        .eq('id', q.template_id)
                        .single()

                    if (template) {
                        textContent = template.content
                        flexJson = template.flex_json
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

                    const messagePayload = flexJson
                        ? { type: "flex", altText: "AI Omni CRMからのメッセージ", contents: flexJson }
                        : { type: 'text', text: textContent }

                    try {
                        const res = await fetch('https://api.line.me/v2/bot/message/push', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
                            },
                            body: JSON.stringify({
                                to: customer.line_uid,
                                messages: [messagePayload]
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