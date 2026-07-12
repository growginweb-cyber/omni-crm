// リテンションシナリオ（複数種類のLINEメッセージブロックの並び）を
// LINE Messaging API の messages 配列に変換する共通ロジック。

function buildFlexBubble(data) {
  const bodyContents = []
  if (data.title) bodyContents.push({ type: 'text', text: data.title, weight: 'bold', size: 'lg', wrap: true })
  if (data.subtitle) bodyContents.push({ type: 'text', text: data.subtitle, size: 'sm', color: '#9097a1', wrap: true })
  ;(data.bodyTexts || []).forEach((t) => {
    if (t) bodyContents.push({ type: 'text', text: t, size: 'sm', wrap: true, margin: 'md' })
  })

  const bubble = {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', contents: bodyContents.length ? bodyContents : [{ type: 'text', text: ' ' }] },
  }
  if (data.heroImage) {
    bubble.hero = { type: 'image', url: data.heroImage, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
  }
  const buttons = (data.footerButtons || []).filter((b) => b.label && b.url)
  if (buttons.length) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: buttons.map((b) => ({
        type: 'button',
        style: 'primary',
        action: { type: 'uri', label: b.label, uri: b.url },
      })),
    }
  }
  return bubble
}

export function buildLineMessages(blocks) {
  const messages = []

  for (const block of blocks || []) {
    if (block.kind === 'text') {
      for (const sub of block.subBlocks || []) {
        if (sub.type === 'text' && sub.text) {
          messages.push({ type: 'text', text: sub.text })
        } else if (sub.type === 'image' && sub.url) {
          messages.push({ type: 'image', originalContentUrl: sub.url, previewImageUrl: sub.url })
        } else if (sub.type === 'button' && sub.label && sub.url) {
          messages.push({
            type: 'template',
            altText: sub.label,
            template: { type: 'buttons', text: sub.label, actions: [{ type: 'uri', label: sub.label, uri: sub.url }] },
          })
        }
      }
    } else if (block.kind === 'flex') {
      messages.push({ type: 'flex', altText: block.title || 'メッセージ', contents: buildFlexBubble(block) })
    } else if (block.kind === 'carousel') {
      const bubbles = (block.cards || []).map((c) => buildFlexBubble({
        heroImage: c.imageUrl,
        title: c.title,
        bodyTexts: [c.text],
        footerButtons: c.buttons,
      }))
      if (bubbles.length) {
        messages.push({ type: 'flex', altText: 'カルーセル', contents: { type: 'carousel', contents: bubbles } })
      }
    } else if (block.kind === 'imagemap') {
      if (block.baseUrl) {
        messages.push({
          type: 'imagemap',
          baseUrl: block.baseUrl,
          altText: 'メッセージ',
          baseSize: { width: block.baseWidth || 1040, height: block.baseHeight || 1040 },
          actions: (block.actions || []).filter((a) => a.value).map((a) => ({
            type: a.type,
            area: { x: a.x, y: a.y, width: a.width, height: a.height },
            ...(a.type === 'uri' ? { linkUri: a.value } : { text: a.value }),
          })),
        })
      }
    }
  }

  // LINE Messaging API は1回のpushで最大5件まで
  return messages.slice(0, 5)
}

export function summarizeLineBlocks(blocks) {
  const kindLabel = { text: 'テキスト', flex: 'フレックス', carousel: 'カルーセル', imagemap: 'イメージマップ' }
  if (!blocks || blocks.length === 0) return ''
  return blocks.map((b) => kindLabel[b.kind] || b.kind).join(' + ')
}
