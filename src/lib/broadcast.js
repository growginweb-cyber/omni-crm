export async function sendLineMessage(supabase, { lineUid, flexJson, textContent, messages }) {
  const { data, error } = await supabase.functions.invoke('send-line-message', {
    body: {
      line_uid: lineUid,
      flex_json: flexJson,
      text_content: textContent,
      messages,
    },
  })

  if (error) {
    throw new Error(error.message || 'LINE Edge Function の呼び出しに失敗しました')
  }

  if (data?.success === false) {
    const lineMessage = data?.result?.message || JSON.stringify(data?.result)
    throw new Error(lineMessage || 'LINE送信に失敗しました')
  }

  return data
}

export async function simulateChannelDelivery(channel) {
  if (channel === 'LINE') return
  await new Promise((resolve) => setTimeout(resolve, 100))
}
