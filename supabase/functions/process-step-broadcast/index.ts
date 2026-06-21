import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    // Supabaseの内部特権キーを使って認証をバイパスし、データベースを操作する
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const LINE_ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const now = new Date().toISOString()
        console.log(`[自動ステップエンジン起動] 現在時刻: ${now}`)

        // 1. 配信予定時刻を過ぎている、かつ「未送信」のステップタスクをデータベースから一斉に拾い上げる
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

                // 2. 🤖 [超進化] 直書きの文字を廃止！顧客のセグメントとチャネルに一致する自作テンプレートを自動検索
                const { data: template, error: templateError } = await supabase
                    .from('broadcast_templates')
                    .select('*')
                    .eq('target_segment', customer.segment)
                    .eq('delivery_channel', channel)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                // もし自作テンプレートがあればそれを使い、なければフォールバック
                let textContent = template ? template.content : `【ステップ${q.step_number}】自動追客メッセージです。`
                let flexJson = template ? template.flex_json : null

                // 3. チャネルがLINEで、かつUIDが有効なら、本物のLINEにブチ込む！
                if (channel === 'LINE' && customer.line_uid && customer.line_uid !== '未連携') {
                    console.log(`-> 本物のLINEに送信中: ${customer.line_uid}`)

                    // Flex Message（カード型）があればFlex、なければただのテキストで送る切り替え
                    const messagePayload = flexJson
                        ? { type: "flex", altText: "自動ステップ配信", contents: flexJson }
                        : { type: 'text', text: textContent };

                    await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
                        },
                        body: JSON.stringify({
                            to: customer.line_uid,
                            messages: [messagePayload] // 以前修正した [ ] で囲む形です
                        })
                    })
                }
                // 3. チャネルがLINEで、かつUIDが有効なら、実際にLINEにブチ込む！
                if (channel === 'LINE' && customer.line_uid && customer.line_uid !== '未連携') {
                    console.log(`-> 本物のLINEに送信中: ${customer.line_uid}`)
                    await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
                        },
                        // 💡 messagesの中身を [ ] で囲むように修正します
                        body: JSON.stringify({
                            to: customer.line_uid,
                            messages: [{ type: 'text', text: textContent }] // <- ここを [ ] で囲む
                        })
                    })
                } else {
                    // EmailやSMS、またはシミュレーションの場合はログ出力のみ
                    console.log(`-> [マルチチャネル模擬送信] ${channel}宛てに送信しました: ${textContent}`)
                }

                // 4. 送信ステータスを「送信成功」に更新
                await supabase
                    .from('step_broadcast_queues')
                    .update({ status: '送信成功' })
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