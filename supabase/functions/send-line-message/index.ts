import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { line_uid, flex_json, text_content, messages } = await req.json()

    // 💡 [デバッグ用ログ] フロントから届いたUIDを表示
    console.log(`[送信要求を受け付けました] 対象UID: ${line_uid}`)

    // 複数メッセージ（リテンションシナリオ）が渡された場合はそのまま利用
    let messagePayloads;
    if (Array.isArray(messages) && messages.length > 0) {
      messagePayloads = messages.slice(0, 5)
      console.log(`[ログ] 複数メッセージ形式で送信します（${messagePayloads.length}件）`)
    } else if (flex_json && Object.keys(flex_json).length > 0) {
      // Flex Messageの最外殻（type: "flex"）を自動補完する安心設計
      messagePayloads = [{
        type: "flex",
        altText: "AI Omni CRMからのフィードバックです",
        contents: flex_json
      }]
      console.log("[ログ] Flex Message形式で送信します")
    } else {
      messagePayloads = [{ type: 'text', text: text_content || "メッセージが空です" }]
      console.log("[ログ] 通常テキスト形式で送信します")
    }

    const LINE_ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN')
    if (!LINE_ACCESS_TOKEN) {
      console.error("[🔥致命的エラー] LINE_ACCESS_TOKEN がSupabaseに設定されていません！")
    }

    console.log("[ログ] 本物のLINE Messaging APIにリクエストを送信中...")
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: line_uid,
        messages: messagePayloads
      })
    })

    const result = await response.json()
    
    // 💡 [超重要デバッグログ] LINEサーバーからの生の返答をまるごとキャッチ
    console.log(`[📢 LINEサーバーからの生返答]: ${JSON.stringify(result)}`)

    return new Response(JSON.stringify({ success: response.ok, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.ok ? 200 : 400,
    })

  } catch (error) {
    console.error(`[🔥内部クラッシュログ]: ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})