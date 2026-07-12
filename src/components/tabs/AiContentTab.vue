<script setup>
import { ref, computed, watch } from 'vue'
import { supabase } from '../../lib/supabase'
import { buildLineMessages, summarizeLineBlocks } from '../../lib/lineMessage'

const props = defineProps({
  selectedChannel: String,
  aiTargetSegment: String,
  generatedContent: String,
  generatedImageUrl: String,
  templateTitle: String,
  savedTemplates: Array,
})
const emit = defineEmits(['update:selectedChannel', 'update:aiTargetSegment', 'update:generatedContent', 'update:generatedEmailHtml', 'update:generatedMessagesJson', 'update:templateTitle', 'generate', 'save', 'deleteTemplate'])

const channels = [
  { id: 'LINE', label: 'LINE', icon: '🟢', color: 'emerald' },
  { id: 'Email', label: 'メール', icon: '📧', color: 'blue' },
  { id: 'SMS', label: 'SMS', icon: '💬', color: 'violet' },
]

// ==================== LINE: ノード接続式のリテンションシナリオビルダー ====================
const NODE_W = 200

const nodeKindMeta = {
  start: { label: '配信開始', icon: '🚀', color: '#06914a' },
  text: { label: 'テキスト/画像/ボタン', icon: '📝', color: '#4f46e5' },
  flex: { label: 'フレックス', icon: '🎴', color: '#8B5CF6' },
  carousel: { label: 'カルーセル', icon: '🎠', color: '#d97706' },
  imagemap: { label: 'イメージマップ', icon: '🗺', color: '#2954d4' },
}
const nodeKindList = ['text', 'flex', 'carousel', 'imagemap']

const DEFAULT_LINE_NODES = [{ id: 'start-1', kind: 'start', x: 320, y: 30, data: { label: '配信開始' } }]

const lineNodes = ref(JSON.parse(JSON.stringify(DEFAULT_LINE_NODES)))
const lineConnections = ref([])
const selectedLineNodeId = ref(null)
const lineCanvasRef = ref(null)
const lineConnectingFrom = ref(null)
const lineTempLineEnd = ref(null)

const selectedLineNode = computed(() => lineNodes.value.find(n => n.id === selectedLineNodeId.value))
const lineNodeMeta = (kind) => nodeKindMeta[kind] || nodeKindMeta.text
const lineNodeColor = (id) => lineNodeMeta(lineNodes.value.find(n => n.id === id)?.kind).color

const defaultNodeData = (kind) => {
  if (kind === 'text') return { subBlocks: [] }
  if (kind === 'flex') return { heroImage: '', title: '', subtitle: '', bodyTexts: [''], footerButtons: [{ label: '', url: '' }] }
  if (kind === 'carousel') return { cards: [{ imageUrl: '', title: '', text: '', buttons: [{ label: '', url: '' }] }] }
  if (kind === 'imagemap') return { baseUrl: '', baseWidth: 1040, baseHeight: 1040, actions: [{ x: 0, y: 0, width: 520, height: 520, type: 'uri', value: '', label: '' }] }
  return {}
}

const addLineNode = (kind) => {
  const id = kind + '-' + Date.now()
  const maxY = lineNodes.value.reduce((m, n) => Math.max(m, n.y), 0)
  lineNodes.value.push({ id, kind, x: 320, y: maxY + 130, data: defaultNodeData(kind) })
  selectedLineNodeId.value = id
  syncContent()
}

const removeLineNode = (id) => {
  lineNodes.value = lineNodes.value.filter(n => n.id !== id)
  lineConnections.value = lineConnections.value.filter(c => c.from !== id && c.to !== id)
  if (selectedLineNodeId.value === id) selectedLineNodeId.value = null
  syncContent()
}

const getLinePortPos = (node, isOutput) => {
  if (isOutput) return { x: node.x + NODE_W / 2, y: node.y + 56 }
  return { x: node.x + NODE_W / 2, y: node.y }
}

const getLinePath = (conn) => {
  const from = lineNodes.value.find(n => n.id === conn.from)
  const to = lineNodes.value.find(n => n.id === conn.to)
  if (!from || !to) return ''
  const p1 = getLinePortPos(from, true)
  const p2 = getLinePortPos(to, false)
  const dy = Math.abs(p2.y - p1.y)
  const cy = Math.max(dy * 0.4, 30)
  return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + cy}, ${p2.x} ${p2.y - cy}, ${p2.x} ${p2.y}`
}

const lineTempPath = computed(() => {
  if (!lineConnectingFrom.value || !lineTempLineEnd.value) return ''
  const from = lineNodes.value.find(n => n.id === lineConnectingFrom.value.nodeId)
  if (!from) return ''
  const p1 = getLinePortPos(from, true)
  const p2 = lineTempLineEnd.value
  const dy = Math.abs(p2.y - p1.y)
  const cy = Math.max(dy * 0.4, 30)
  return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + cy}, ${p2.x} ${p2.y - cy}, ${p2.x} ${p2.y}`
})

const lineCanvasCoords = (e) => {
  if (!lineCanvasRef.value) return { x: 0, y: 0 }
  const rect = lineCanvasRef.value.getBoundingClientRect()
  return { x: e.clientX - rect.left + lineCanvasRef.value.scrollLeft, y: e.clientY - rect.top + lineCanvasRef.value.scrollTop }
}

const startLineDrag = (node, e) => {
  if (e.target.closest('.port')) return
  e.preventDefault()
  selectedLineNodeId.value = node.id
  const start = lineCanvasCoords(e)
  const ox = start.x - node.x, oy = start.y - node.y
  const onMove = (me) => { const p = lineCanvasCoords(me); node.x = p.x - ox; node.y = p.y - oy }
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const startLineConnect = (nodeId, e) => {
  e.stopPropagation(); e.preventDefault()
  lineConnectingFrom.value = { nodeId }
  const onMove = (me) => { lineTempLineEnd.value = lineCanvasCoords(me) }
  const onUp = (me) => {
    const el = document.elementFromPoint(me.clientX, me.clientY)
    const port = el?.closest('[data-input-port]')
    if (port) {
      const toId = port.dataset.inputPort
      if (toId !== nodeId) {
        lineConnections.value = lineConnections.value.filter(c => c.from !== nodeId)
        lineConnections.value.push({ from: nodeId, to: toId })
        syncContent()
      }
    }
    lineConnectingFrom.value = null; lineTempLineEnd.value = null
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const removeLineConnection = (ci) => { lineConnections.value.splice(ci, 1); syncContent() }

// テキスト種別ノード内のサブブロック（テキスト/画像/ボタン）操作
const addSubBlock = (node, type) => {
  const sub = { id: Date.now() + Math.random(), type }
  if (type === 'text') sub.text = ''
  if (type === 'image') sub.url = ''
  if (type === 'button') { sub.label = ''; sub.url = '' }
  node.data.subBlocks.push(sub)
  syncContent()
}
const removeSubBlock = (node, index) => { node.data.subBlocks.splice(index, 1); syncContent() }

const addCarouselCard = (node) => { if (node.data.cards.length < 10) node.data.cards.push({ imageUrl: '', title: '', text: '', buttons: [{ label: '', url: '' }] }) }
const removeCarouselCard = (node, i) => { node.data.cards.splice(i, 1) }
const addImageMapAction = (node) => { node.data.actions.push({ x: 0, y: 0, width: 520, height: 520, type: 'uri', value: '', label: '' }) }
const removeImageMapAction = (node, i) => { node.data.actions.splice(i, 1) }

// 開始ノードから接続をたどってメッセージの送信順を決定する
const orderedLineNodes = () => {
  const startNode = lineNodes.value.find(n => n.kind === 'start')
  const visited = new Set()
  const ordered = []
  let current = startNode
  while (current) {
    const next = lineConnections.value.find(c => c.from === current.id)
    if (!next || visited.has(next.to)) break
    const nextNode = lineNodes.value.find(n => n.id === next.to)
    if (!nextNode) break
    ordered.push(nextNode)
    visited.add(nextNode.id)
    current = nextNode
  }
  // 未接続のノードは末尾に追加（作成順）
  lineNodes.value.forEach(n => {
    if (n.kind !== 'start' && !visited.has(n.id)) ordered.push(n)
  })
  return ordered
}

const syncContent = () => {
  const blocks = orderedLineNodes().map(n => ({ kind: n.kind, ...n.data }))
  emit('update:generatedContent', summarizeLineBlocks(blocks))
  emit('update:generatedMessagesJson', buildLineMessages(blocks))
}

const smsText = ref('')
const smsCharCount = computed(() => smsText.value.length)
const smsCost = computed(() => {
  const len = smsText.value.length
  if (len === 0) return 0
  if (len <= 70) return 3
  if (len <= 134) return 6
  if (len <= 201) return 9
  if (len <= 268) return 12.5
  return 15
})

const emailSubject = ref('')
const emailSenderName = ref('')
const emailBlocks = ref([])
const emailSettings = ref({ bgColor: '#f8fafc', contentWidth: 600, headerLogoUrl: '' })
const showEmailSettings = ref(false)
const linkInputUrl = ref('')
const linkInputBlockId = ref(null)
const savedSel = ref({ blockId: null, start: 0, end: 0 })

const emailBlockTypes = [
  { type: 'heading', label: '見出し', icon: 'H' },
  { type: 'paragraph', label: '本文', icon: '¶' },
  { type: 'image', label: '画像', icon: '🖼' },
  { type: 'button', label: 'ボタン', icon: '▣' },
  { type: 'columns', label: 'カラム', icon: '▥' },
  { type: 'divider', label: '区切り', icon: '—' },
  { type: 'spacer', label: '余白', icon: '↕' },
  { type: 'social', label: 'SNS', icon: '🔗' },
  { type: 'footer', label: 'フッター', icon: '▤' },
]

const socialPlatforms = ['X', 'Instagram', 'Facebook', 'YouTube', 'LINE']
const socialIconMap = { X: '𝕏', Instagram: '📷', Facebook: 'f', YouTube: '▶', LINE: '🟢' }

const addEmailBlock = (type) => {
  const block = { id: Date.now(), type }
  const defaults = {
    heading: { text: '', level: 'h2', align: 'left', color: '#1e293b' },
    paragraph: { html: '', align: 'left', fontSize: '14' },
    image: { url: '', alt: '', width: '100', align: 'center', link: '' },
    button: { label: '', url: '', bgColor: '#2563eb', textColor: '#ffffff', borderRadius: '8', size: 'md', align: 'center' },
    columns: { count: 2, cols: [{ html: '' }, { html: '' }] },
    divider: { color: '#e2e8f0', thickness: '1' },
    spacer: { height: '24' },
    social: { links: [{ platform: 'X', url: '' }, { platform: 'Instagram', url: '' }], align: 'center' },
    footer: { text: '配信元: OMNI CRM', showUnsubscribe: true, align: 'center', color: '#94a3b8', fontSize: '11' },
  }
  Object.assign(block, defaults[type] || {})
  emailBlocks.value.push(block)
}

const removeEmailBlock = (index) => {
  emailBlocks.value.splice(index, 1)
}

const moveEmailBlock = (from, to) => {
  if (to < 0 || to >= emailBlocks.value.length) return
  const item = emailBlocks.value.splice(from, 1)[0]
  emailBlocks.value.splice(to, 0, item)
}

const trackSelection = (blockId, e) => {
  savedSel.value = { blockId, start: e.target.selectionStart, end: e.target.selectionEnd }
}

const wrapSelection = (blockId, openTag, closeTag) => {
  const block = emailBlocks.value.find(b => b.id === blockId)
  if (!block) return
  const sel = savedSel.value.blockId === blockId ? savedSel.value : { start: block.html.length, end: block.html.length }
  const text = block.html
  const selected = text.substring(sel.start, sel.end)
  block.html = text.substring(0, sel.start) + openTag + (selected || 'テキスト') + closeTag + text.substring(sel.end)
}

const insertLinkTag = (blockId) => {
  if (!linkInputUrl.value) return
  const block = emailBlocks.value.find(b => b.id === blockId)
  if (!block) return
  const sel = savedSel.value.blockId === blockId ? savedSel.value : { start: block.html.length, end: block.html.length }
  const text = block.html
  const selected = text.substring(sel.start, sel.end) || 'リンク'
  block.html = text.substring(0, sel.start) + `<a href="${linkInputUrl.value}" style="color:#2563eb">${selected}</a>` + text.substring(sel.end)
  linkInputUrl.value = ''
  linkInputBlockId.value = null
}

const updateColumnsCount = (block, count) => {
  block.count = count
  while (block.cols.length < count) block.cols.push({ html: '' })
  while (block.cols.length > count) block.cols.pop()
}

const addSocialLink = (block) => {
  const used = block.links.map(l => l.platform)
  const next = socialPlatforms.find(p => !used.includes(p))
  if (next) block.links.push({ platform: next, url: '' })
}

const emailPreviewHtml = computed(() => {
  const s = emailSettings.value
  let html = ''
  if (s.headerLogoUrl) html += `<div style="text-align:center;padding:16px 0"><img src="${s.headerLogoUrl}" style="max-height:48px" /></div>`
  html += emailBlocks.value.map(b => {
    switch (b.type) {
      case 'heading': {
        const sz = { h1: '24px', h2: '20px', h3: '16px' }
        return `<${b.level} style="margin:0;padding:8px 0;color:${b.color};text-align:${b.align};font-size:${sz[b.level]};font-weight:bold">${b.text || '見出し'}</${b.level}>`
      }
      case 'paragraph':
        return `<div style="padding:4px 0;text-align:${b.align};font-size:${b.fontSize}px;line-height:1.8;color:#475569">${b.html || '<span style="color:#cbd5e1">本文テキスト</span>'}</div>`
      case 'image': {
        const img = b.url ? `<img src="${b.url}" alt="${b.alt}" style="max-width:${b.width}%;height:auto;display:block;${b.align === 'center' ? 'margin:0 auto' : ''}" />` : '<div style="background:#f1f5f9;height:100px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;border-radius:6px">画像未設定</div>'
        return `<div style="text-align:${b.align};padding:8px 0">${b.link ? `<a href="${b.link}">${img}</a>` : img}</div>`
      }
      case 'button': {
        const pd = { sm: '8px 18px', md: '12px 28px', lg: '14px 36px' }
        return `<div style="text-align:${b.align};padding:12px 0"><a href="${b.url || '#'}" style="display:inline-block;background:${b.bgColor};color:${b.textColor};padding:${pd[b.size]};border-radius:${b.borderRadius}px;text-decoration:none;font-weight:bold;font-size:13px">${b.label || 'ボタン'}</a></div>`
      }
      case 'columns':
        return `<table style="width:100%;border-spacing:8px"><tr>${b.cols.map(c => `<td style="vertical-align:top;padding:8px;background:#f8fafc;border-radius:6px;font-size:13px;line-height:1.6">${c.html || '<span style="color:#cbd5e1">内容</span>'}</td>`).join('')}</tr></table>`
      case 'divider':
        return `<hr style="border:none;border-top:${b.thickness}px solid ${b.color};margin:12px 0" />`
      case 'spacer':
        return `<div style="height:${b.height}px"></div>`
      case 'social':
        return `<div style="text-align:${b.align};padding:12px 0">${b.links.filter(l => l.url).map(l => `<a href="${l.url}" style="display:inline-block;margin:0 6px;width:32px;height:32px;background:#f1f5f9;border-radius:50%;text-align:center;line-height:32px;text-decoration:none;font-size:14px">${socialIconMap[l.platform] || '?'}</a>`).join('')}</div>`
      case 'footer':
        return `<div style="text-align:${b.align};padding:16px 0;color:${b.color};font-size:${b.fontSize}px;border-top:1px solid #e2e8f0;margin-top:8px">${b.text}${b.showUnsubscribe ? '<br/><a href="#" style="color:#94a3b8;font-size:10px">配信停止</a>' : ''}</div>`
      default: return ''
    }
  }).join('')
  return html
})

const channelTemplates = computed(() => {
  if (!props.savedTemplates) return []
  return props.savedTemplates.filter(t => t.delivery_channel === props.selectedChannel)
})

watch(() => props.selectedChannel, () => {
  if (props.selectedChannel === 'SMS') {
    smsText.value = props.generatedContent || ''
  }
})

watch(smsText, (v) => {
  if (props.selectedChannel === 'SMS') {
    emit('update:generatedContent', v)
  }
})

watch(emailPreviewHtml, (v) => {
  emit('update:generatedEmailHtml', v)
})

// LINEテスト送信
const testLineUid = ref('')
const isSendingTest = ref(false)
const testSendResult = ref('')

const sendLineTest = async () => {
  const uid = testLineUid.value.trim()
  if (!uid) return
  isSendingTest.value = true
  testSendResult.value = ''
  try {
    const blocks = orderedLineNodes().map(n => ({ kind: n.kind, ...n.data }))
    const messages = buildLineMessages(blocks)
    const { error } = await supabase.functions.invoke('send-line-message', {
      body: { line_uid: uid, messages: messages.length ? messages : undefined, text_content: messages.length ? undefined : 'テスト送信' }
    })
    testSendResult.value = error ? `❌ ${error.message}` : '✅ 送信しました'
  } catch (e) {
    testSendResult.value = `❌ ${e.message}`
  } finally {
    isSendingTest.value = false
    setTimeout(() => { testSendResult.value = '' }, 4000)
  }
}

const saveScenario = () => {
  emit('save')
  lineNodes.value = JSON.parse(JSON.stringify(DEFAULT_LINE_NODES))
  lineConnections.value = []
  selectedLineNodeId.value = null
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Channel tabs -->
    <div class="px-5 py-3 bg-white border-b border-[#ebedf0] flex items-center gap-4 shrink-0">
      <h2 class="text-lg font-bold text-slate-900 mr-2">リテンションシナリオ</h2>
      <div class="flex bg-slate-100 p-0.5 rounded-lg">
        <button
          v-for="ch in channels"
          :key="ch.id"
          @click="$emit('update:selectedChannel', ch.id)"
          :class="[
            'px-4 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-1.5',
            selectedChannel === ch.id
              ? 'bg-white shadow-sm text-slate-900'
              : 'text-slate-400 hover:text-slate-600',
          ]"
        >
          <span>{{ ch.icon }}</span> {{ ch.label }}
        </button>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- ==================== LINE Editor (Node Canvas) ==================== -->
      <template v-if="selectedChannel === 'LINE'">
        <div class="flex-1 min-w-0 flex flex-col border-r border-[#ebedf0] bg-white overflow-hidden">
          <!-- Header -->
          <div class="px-5 py-3 border-b border-[#ebedf0] shrink-0">
            <h3 class="text-[12px] font-semibold text-[#6b7280] mb-2">リテンションシナリオ（LINE）</h3>
            <input :value="templateTitle" @input="$emit('update:templateTitle', $event.target.value)" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition" placeholder="シナリオ名（例: 初回クーポン配信）" />
            <p class="text-[10px] text-slate-400 mt-1.5">ノードをつないで、テキスト・フレックス・カルーセル・イメージマップを組み合わせた配信シナリオを設計できます</p>
          </div>

          <!-- Add node toolbar -->
          <div class="px-5 py-2 bg-[#f7f8fa] border-b border-[#ebedf0] flex gap-1.5 shrink-0 flex-wrap">
            <button v-for="kind in nodeKindList" :key="kind" @click="addLineNode(kind)" class="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-[#3a3f47] bg-white border border-[#e6e8ec] rounded-[8px] hover:bg-[#f1f2f4] transition-colors">
              <span>{{ nodeKindMeta[kind].icon }}</span> ＋{{ nodeKindMeta[kind].label }}
            </button>
          </div>

          <!-- Canvas -->
          <div ref="lineCanvasRef" class="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing bg-[#f6f7f9]" style="background-image:radial-gradient(#dfe2e7 1px,transparent 1px);background-size:22px 22px">
            <!-- Legend -->
            <div class="absolute left-4 top-3.5 z-10 flex gap-3.5 bg-white/90 border border-[#ebedf0] rounded-[10px] px-3.5 py-2 shadow-sm text-[11px] text-[#3a3f47] flex-wrap max-w-[90%]">
              <span v-for="(meta, kind) in nodeKindMeta" :key="kind" class="flex items-center gap-1.5">
                <span class="w-[11px] h-[11px] rounded-[3px] inline-block" :style="{ backgroundColor: meta.color }"></span>
                {{ meta.label }}
              </span>
            </div>

            <svg class="absolute top-0 left-0 pointer-events-none" style="width:3000px;height:2000px">
              <path v-for="(conn, ci) in lineConnections" :key="ci" :d="getLinePath(conn)" fill="none" :stroke="lineNodeColor(conn.from)" stroke-width="2" opacity="0.55" />
              <path v-if="lineTempPath" :d="lineTempPath" fill="none" stroke="#4f46e5" stroke-width="2" stroke-dasharray="6 3" opacity="0.55" />
            </svg>

            <div v-for="node in lineNodes" :key="node.id" class="absolute select-none" :style="{ left: node.x + 'px', top: node.y + 'px', width: NODE_W + 'px' }" @mousedown="startLineDrag(node, $event)">
              <!-- Input port -->
              <div v-if="node.kind !== 'start'" class="port absolute -top-[6px] left-1/2 -translate-x-1/2 w-[11px] h-[11px] rounded-full bg-white border-2 hover:scale-125 cursor-crosshair z-20 transition-all" :style="{ borderColor: lineNodeMeta(node.kind).color }" :data-input-port="node.id"></div>

              <!-- Node card -->
              <div :class="['bg-white rounded-[12px] border border-[#e3e5e9] shadow-[0_2px_10px_-4px_rgba(20,24,31,.12)] cursor-move transition-all', selectedLineNodeId === node.id ? 'ring-2 ring-[#4f46e5]/40' : 'hover:shadow-[0_4px_14px_-4px_rgba(20,24,31,.18)]']" @click.stop="selectedLineNodeId = node.id">
                <div class="flex items-center gap-1.5 px-3 py-[7px] rounded-t-[12px] text-white text-[11px] font-semibold" :style="{ backgroundColor: lineNodeMeta(node.kind).color }">
                  <span>{{ lineNodeMeta(node.kind).icon }}</span>
                  <span class="flex-1 truncate">{{ lineNodeMeta(node.kind).label }}</span>
                  <span class="opacity-70 cursor-grab">⠿</span>
                </div>
                <div class="px-3 py-2.5">
                  <p class="text-[12px] font-semibold text-[#14181f] truncate">
                    {{ node.kind === 'start' ? node.data.label
                      : node.kind === 'text' ? (node.data.subBlocks.length ? node.data.subBlocks.length + '件のブロック' : '未設定')
                      : node.kind === 'flex' ? (node.data.title || 'タイトル未設定')
                      : node.kind === 'carousel' ? node.data.cards.length + '枚のカード'
                      : node.kind === 'imagemap' ? (node.data.baseUrl ? '画像設定済み' : '未設定')
                      : '' }}
                  </p>
                </div>
              </div>

              <!-- Output port -->
              <div class="port absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-[11px] h-[11px] rounded-full bg-white border-2 hover:scale-125 cursor-crosshair z-20 transition-all" :style="{ borderColor: lineNodeMeta(node.kind).color }" @mousedown="startLineConnect(node.id, $event)"></div>
            </div>

            <!-- Empty hint -->
            <div v-if="lineNodes.length <= 1" class="absolute top-32 left-1/2 -translate-x-1/2 text-center pointer-events-none">
              <p class="text-xs text-[#9097a1]">上部のボタンからメッセージノードを追加</p>
              <p class="text-[10px] text-[#b0b6bf] mt-1">出力ポート(下)から入力ポート(上)へドラッグして接続すると、その順番で配信されます</p>
            </div>
          </div>

          <!-- Save bar -->
          <div class="px-5 py-3 border-t border-[#ebedf0] bg-white shrink-0 space-y-2">
            <div class="flex items-center gap-2">
              <input v-model="testLineUid" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition font-mono" placeholder="LINE UID でテスト送信..." />
              <button @click="sendLineTest" :disabled="!testLineUid || isSendingTest" class="rounded-lg bg-emerald-100 text-emerald-700 px-3 py-1.5 text-[10px] font-bold hover:bg-emerald-200 transition-colors disabled:opacity-40 whitespace-nowrap">{{ isSendingTest ? '送信中...' : 'テスト送信' }}</button>
            </div>
            <div v-if="testSendResult" class="text-[10px] font-bold" :class="testSendResult.startsWith('✅') ? 'text-emerald-600' : 'text-red-500'">{{ testSendResult }}</div>
            <div class="flex items-center justify-between">
              <select :value="aiTargetSegment" @change="$emit('update:aiTargetSegment', $event.target.value)" class="border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs bg-white">
                <option value="集客最大化タイプ">集客最大化タイプ</option>
                <option value="コスト削減タイプ">コスト削減タイプ</option>
              </select>
              <button @click="saveScenario" :disabled="lineNodes.length <= 1" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-[7px] text-[12.5px] text-white font-medium hover:brightness-110 transition disabled:opacity-40">リテンションシナリオとして保存</button>
            </div>
          </div>
        </div>

        <!-- Right: Node properties panel -->
        <aside class="w-72 bg-white border-l border-[#ebedf0] overflow-y-auto shrink-0 flex flex-col">
          <div class="px-4 py-3 border-b border-[#ebedf0] flex items-center justify-between">
            <h3 class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">ノード設定</h3>
            <button v-if="selectedLineNode && selectedLineNode.kind !== 'start'" @click="removeLineNode(selectedLineNode.id)" class="text-[10px] text-red-400 hover:text-red-600 font-semibold">削除</button>
          </div>

          <template v-if="selectedLineNode">
            <div class="p-4 space-y-4 flex-1">
              <div class="rounded-[13px] p-3 text-center border border-[#ebedf0]" :style="{ backgroundColor: lineNodeMeta(selectedLineNode.kind).color + '14' }">
                <span class="text-xl">{{ lineNodeMeta(selectedLineNode.kind).icon }}</span>
                <div class="text-xs font-semibold mt-1" :style="{ color: lineNodeMeta(selectedLineNode.kind).color }">{{ lineNodeMeta(selectedLineNode.kind).label }}</div>
              </div>

              <!-- Start -->
              <template v-if="selectedLineNode.kind === 'start'">
                <p class="text-[11px] text-[#9097a1] leading-relaxed">ここから配信が始まります。次のノードをつないでシナリオを組み立てましょう。</p>
              </template>

              <!-- Text -->
              <template v-if="selectedLineNode.kind === 'text'">
                <div class="flex gap-2">
                  <button v-for="bt in [{type:'text',label:'テキスト',icon:'📝'},{type:'image',label:'画像',icon:'🖼'},{type:'button',label:'ボタン',icon:'🔘'}]" :key="bt.type" @click="addSubBlock(selectedLineNode, bt.type)" class="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-[#3a3f47] bg-white border border-[#e6e8ec] rounded-[7px] hover:bg-[#f1f2f4] transition-colors">
                    <span>{{ bt.icon }}</span> {{ bt.label }}
                  </button>
                </div>
                <div v-if="selectedLineNode.data.subBlocks.length === 0" class="text-center py-6 text-[11px] text-slate-300">テキスト・画像・ボタンを追加してください</div>
                <div class="space-y-2.5">
                  <div v-for="(sub, si) in selectedLineNode.data.subBlocks" :key="sub.id" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[10px] p-3 relative group/sub">
                    <button @click="removeSubBlock(selectedLineNode, si)" class="absolute top-2 right-2 w-5 h-5 rounded text-[10px] bg-white text-red-400 hover:text-red-600 flex items-center justify-center opacity-0 group-hover/sub:opacity-100 transition-opacity">×</button>
                    <textarea v-if="sub.type === 'text'" v-model="sub.text" @input="syncContent" rows="2" class="w-full bg-white border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition resize-none" placeholder="メッセージテキスト"></textarea>
                    <input v-if="sub.type === 'image'" v-model="sub.url" @input="syncContent" class="w-full bg-white border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="画像URL（https://...）" />
                    <div v-if="sub.type === 'button'" class="flex gap-2">
                      <input v-model="sub.label" @input="syncContent" class="flex-1 bg-white border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="ボタンラベル" />
                      <input v-model="sub.url" @input="syncContent" class="flex-1 bg-white border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="リンクURL" />
                    </div>
                  </div>
                </div>
              </template>

              <!-- Flex -->
              <template v-if="selectedLineNode.kind === 'flex'">
                <div class="space-y-3">
                  <input v-model="selectedLineNode.data.heroImage" @input="syncContent" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="ヒーロー画像URL（任意）" />
                  <input v-model="selectedLineNode.data.title" @input="syncContent" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="タイトル" />
                  <input v-model="selectedLineNode.data.subtitle" @input="syncContent" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="サブタイトル（任意）" />
                  <div v-for="(_, ti) in selectedLineNode.data.bodyTexts" :key="ti" class="flex gap-2">
                    <textarea v-model="selectedLineNode.data.bodyTexts[ti]" @input="syncContent" rows="2" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="本文テキスト"></textarea>
                    <button v-if="selectedLineNode.data.bodyTexts.length > 1" @click="selectedLineNode.data.bodyTexts.splice(ti, 1); syncContent()" class="text-red-400 hover:text-red-600 text-xs self-start mt-1">×</button>
                  </div>
                  <button @click="selectedLineNode.data.bodyTexts.push(''); syncContent()" class="text-[10px] font-bold text-emerald-600 hover:text-emerald-800">+ 本文を追加</button>
                  <div>
                    <label class="text-[10px] font-bold text-slate-400 block mb-1">フッターボタン</label>
                    <div v-for="(btn, bi) in selectedLineNode.data.footerButtons" :key="bi" class="flex gap-2 mb-1.5">
                      <input v-model="btn.label" @input="syncContent" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="ラベル" />
                      <input v-model="btn.url" @input="syncContent" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="URL" />
                      <button v-if="selectedLineNode.data.footerButtons.length > 1" @click="selectedLineNode.data.footerButtons.splice(bi, 1); syncContent()" class="text-red-400 hover:text-red-600 text-xs">×</button>
                    </div>
                    <button @click="selectedLineNode.data.footerButtons.push({ label: '', url: '' }); syncContent()" class="text-[10px] font-bold text-emerald-600 hover:text-emerald-800">+ ボタン追加</button>
                  </div>
                </div>
              </template>

              <!-- Carousel -->
              <template v-if="selectedLineNode.kind === 'carousel'">
                <div class="space-y-3">
                  <div v-for="(card, ci) in selectedLineNode.data.cards" :key="ci" class="border border-[#ebedf0] rounded-[10px] p-3 group/card relative">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-[10px] font-semibold text-[#9097a1]">カード {{ ci + 1 }} / {{ selectedLineNode.data.cards.length }}</span>
                      <button v-if="selectedLineNode.data.cards.length > 1" @click="removeCarouselCard(selectedLineNode, ci)" class="w-5 h-5 rounded text-[10px] bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">×</button>
                    </div>
                    <div class="space-y-1.5">
                      <input v-model="card.imageUrl" @input="syncContent" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="画像URL" />
                      <input v-model="card.title" @input="syncContent" maxlength="40" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="タイトル（最大40文字）" />
                      <textarea v-model="card.text" @input="syncContent" rows="2" maxlength="60" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="説明テキスト（最大60文字）"></textarea>
                      <div v-for="(btn, bi) in card.buttons" :key="bi" class="flex gap-1.5">
                        <input v-model="btn.label" @input="syncContent" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="ラベル" />
                        <input v-model="btn.url" @input="syncContent" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="URL" />
                      </div>
                    </div>
                  </div>
                  <button @click="addCarouselCard(selectedLineNode)" :disabled="selectedLineNode.data.cards.length >= 10" class="w-full py-2 border-2 border-dashed border-[#ebedf0] rounded-[10px] text-[10px] font-bold text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors disabled:opacity-40">+ カード追加（最大10枚）</button>
                </div>
              </template>

              <!-- ImageMap -->
              <template v-if="selectedLineNode.kind === 'imagemap'">
                <div class="space-y-3">
                  <input v-model="selectedLineNode.data.baseUrl" @input="syncContent" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="ベース画像URL（幅1040px推奨）" />
                  <div class="flex gap-3">
                    <label class="flex items-center gap-1.5 text-[10px] text-slate-500">幅 <input type="number" v-model.number="selectedLineNode.data.baseWidth" class="w-16 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] text-center" /></label>
                    <label class="flex items-center gap-1.5 text-[10px] text-slate-500">高さ <input type="number" v-model.number="selectedLineNode.data.baseHeight" class="w-16 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] text-center" /></label>
                  </div>
                  <div v-for="(action, ai) in selectedLineNode.data.actions" :key="ai" class="border border-[#ebedf0] rounded-[10px] p-3 space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] font-bold text-slate-500">エリア {{ ai + 1 }}</span>
                      <button v-if="selectedLineNode.data.actions.length > 1" @click="removeImageMapAction(selectedLineNode, ai)" class="w-5 h-5 rounded text-[10px] bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center">×</button>
                    </div>
                    <div class="grid grid-cols-4 gap-1.5">
                      <label class="text-[9px] text-slate-500">X <input type="number" v-model.number="action.x" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 text-[10px] mt-0.5" /></label>
                      <label class="text-[9px] text-slate-500">Y <input type="number" v-model.number="action.y" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 text-[10px] mt-0.5" /></label>
                      <label class="text-[9px] text-slate-500">幅 <input type="number" v-model.number="action.width" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 text-[10px] mt-0.5" /></label>
                      <label class="text-[9px] text-slate-500">高さ <input type="number" v-model.number="action.height" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 text-[10px] mt-0.5" /></label>
                    </div>
                    <div class="flex gap-2">
                      <select v-model="action.type" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 bg-white"><option value="uri">URL遷移</option><option value="message">メッセージ送信</option></select>
                      <input v-model="action.value" @input="syncContent" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20" :placeholder="action.type === 'uri' ? 'https://...' : '送信テキスト'" />
                    </div>
                  </div>
                  <button @click="addImageMapAction(selectedLineNode)" class="w-full py-2 border-2 border-dashed border-[#ebedf0] rounded-[10px] text-[10px] font-bold text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors">+ タップエリア追加</button>
                </div>
              </template>

              <!-- Connection info -->
              <div v-if="selectedLineNode.kind !== 'start' || true">
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">接続先</label>
                <div v-for="(conn, ci) in lineConnections.filter(c => c.from === selectedLineNode.id)" :key="ci" class="flex items-center justify-between bg-[#f7f8fa] border border-[#eef0f2] rounded-[7px] px-3 py-1.5 mb-1">
                  <span class="text-[10px] text-[#3a3f47] flex items-center gap-1">
                    <span class="text-xs">{{ lineNodeMeta(lineNodes.find(n => n.id === conn.to)?.kind)?.icon }}</span>
                    {{ lineNodeMeta(lineNodes.find(n => n.id === conn.to)?.kind)?.label }}
                  </span>
                  <button @click="removeLineConnection(lineConnections.indexOf(conn))" class="text-red-400 hover:text-red-600 text-[10px]">×</button>
                </div>
                <p v-if="lineConnections.filter(c => c.from === selectedLineNode.id).length === 0" class="text-[10px] text-[#b0b6bf]">出力ポートからドラッグで接続</p>
              </div>
            </div>
          </template>

          <div v-else class="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div class="text-2xl mb-2">👆</div>
            <p class="text-[11px] text-[#9097a1]">ノードを選択して<br/>設定を編集</p>
          </div>
        </aside>
      </template>

      <!-- ==================== Email Editor ==================== -->
      <template v-else-if="selectedChannel === 'Email'">
        <div class="flex-1 min-w-0 flex flex-col border-r border-[#ebedf0] bg-white overflow-hidden">
          <!-- Header -->
          <div class="px-5 py-3 border-b border-[#ebedf0] shrink-0 space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-[12px] font-semibold text-[#6b7280]">メールエディタ</h3>
              <button @click="showEmailSettings = !showEmailSettings" class="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1">⚙️ 設定 <span class="text-[8px]">{{ showEmailSettings ? '▲' : '▼' }}</span></button>
            </div>
            <input :value="templateTitle" @input="$emit('update:templateTitle', $event.target.value)" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" placeholder="テンプレート名" />
            <input v-model="emailSubject" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" placeholder="件名（例: 期間限定キャンペーンのお知らせ）" />
            <input v-model="emailSenderName" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" placeholder="差出人名（例: OMNI CRM サポート）" />
            <!-- Email settings -->
            <div v-if="showEmailSettings" class="space-y-2 pt-2 border-t border-slate-100">
              <div class="flex items-center gap-3 flex-wrap">
                <label class="flex items-center gap-1.5 text-[10px] text-slate-500">背景色 <input type="color" v-model="emailSettings.bgColor" class="w-6 h-6 rounded border border-[#ebedf0] cursor-pointer" /></label>
                <label class="flex items-center gap-1.5 text-[10px] text-slate-500">幅
                  <select v-model="emailSettings.contentWidth" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 bg-white"><option :value="480">480px</option><option :value="600">600px</option><option :value="720">720px</option></select>
                </label>
              </div>
              <input v-model="emailSettings.headerLogoUrl" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] placeholder-slate-400" placeholder="ヘッダーロゴURL（任意）" />
            </div>
          </div>

          <!-- Block buttons -->
          <div class="px-5 py-2 bg-[#f7f8fa] border-b border-[#ebedf0] flex gap-1.5 shrink-0 flex-wrap">
            <button v-for="bt in emailBlockTypes" :key="bt.type" @click="addEmailBlock(bt.type)" class="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-[#3a3f47] bg-white border border-[#e6e8ec] rounded-[8px] hover:bg-[#f1f2f4] transition-colors">
              <span class="font-mono">{{ bt.icon }}</span> {{ bt.label }}
            </button>
          </div>

          <!-- Block list -->
          <div class="flex-1 overflow-y-auto p-5 space-y-3">
            <div v-if="emailBlocks.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
              <div class="text-3xl mb-2">📧</div>
              <p class="text-xs text-slate-400">ブロックを追加してメールを作成しましょう</p>
              <p class="text-[10px] text-slate-300 mt-1">見出し・本文・画像・ボタン・カラムなどを自由に組み合わせ</p>
            </div>

            <div v-for="(block, i) in emailBlocks" :key="block.id" class="bg-white border border-[#ebedf0] rounded-[13px] p-4 group relative">
              <!-- Block header -->
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">
                  {{ { heading:'H 見出し', paragraph:'¶ 本文', image:'🖼 画像', button:'▣ ボタン', columns:'▥ カラム', divider:'— 区切り', spacer:'↕ 余白', social:'🔗 SNS', footer:'▤ フッター' }[block.type] }}
                </span>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="moveEmailBlock(i, i - 1)" :disabled="i === 0" class="w-5 h-5 rounded text-[10px] bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center">↑</button>
                  <button @click="moveEmailBlock(i, i + 1)" :disabled="i === emailBlocks.length - 1" class="w-5 h-5 rounded text-[10px] bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center">↓</button>
                  <button @click="removeEmailBlock(i)" class="w-5 h-5 rounded text-[10px] bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center">×</button>
                </div>
              </div>

              <!-- Heading -->
              <div v-if="block.type === 'heading'" class="space-y-2">
                <div class="flex gap-2">
                  <select v-model="block.level" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 bg-white"><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option></select>
                  <select v-model="block.align" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 bg-white"><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select>
                  <input type="color" v-model="block.color" class="w-7 h-7 rounded border border-[#ebedf0] cursor-pointer" />
                </div>
                <input v-model="block.text" :class="[block.level === 'h1' ? 'text-lg' : block.level === 'h2' ? 'text-sm' : 'text-xs', 'w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition']" placeholder="見出しテキスト" />
              </div>

              <!-- Paragraph (rich text) -->
              <div v-if="block.type === 'paragraph'" class="space-y-2">
                <div class="flex items-center gap-0.5 flex-wrap">
                  <button @click="wrapSelection(block.id, '<b>', '</b>')" class="w-7 h-7 rounded text-xs font-bold bg-[#f7f8fa] hover:bg-slate-200 transition">B</button>
                  <button @click="wrapSelection(block.id, '<i>', '</i>')" class="w-7 h-7 rounded text-xs italic bg-[#f7f8fa] hover:bg-slate-200 transition">I</button>
                  <button @click="wrapSelection(block.id, '<u>', '</u>')" class="w-7 h-7 rounded text-xs underline bg-[#f7f8fa] hover:bg-slate-200 transition">U</button>
                  <span class="w-px h-4 bg-slate-200 mx-1"></span>
                  <button @click="wrapSelection(block.id, '<span style=&quot;color:#2563eb&quot;>', '</span>')" class="w-7 h-7 rounded text-xs bg-[#f7f8fa] hover:bg-slate-200 transition text-blue-600">A</button>
                  <button @click="wrapSelection(block.id, '<span style=&quot;color:#dc2626&quot;>', '</span>')" class="w-7 h-7 rounded text-xs bg-[#f7f8fa] hover:bg-slate-200 transition text-red-600">A</button>
                  <span class="w-px h-4 bg-slate-200 mx-1"></span>
                  <button @click="linkInputBlockId = linkInputBlockId === block.id ? null : block.id" :class="['w-7 h-7 rounded text-xs bg-[#f7f8fa] hover:bg-slate-200 transition', linkInputBlockId === block.id ? 'ring-2 ring-blue-400' : '']">🔗</button>
                  <span class="w-px h-4 bg-slate-200 mx-1"></span>
                  <select v-model="block.fontSize" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 bg-white"><option value="12">12px</option><option value="14">14px</option><option value="16">16px</option><option value="18">18px</option></select>
                  <select v-model="block.align" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 bg-white"><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select>
                </div>
                <div v-if="linkInputBlockId === block.id" class="flex gap-2">
                  <input v-model="linkInputUrl" placeholder="https://..." class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" @keydown.enter="insertLinkTag(block.id)" />
                  <button @click="insertLinkTag(block.id)" class="px-2 py-1 text-[10px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700">挿入</button>
                </div>
                <textarea v-model="block.html" :data-block-id="block.id" @mouseup="trackSelection(block.id, $event)" @keyup="trackSelection(block.id, $event)" rows="4" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-none font-mono" :style="{ textAlign: block.align }" placeholder="本文テキスト（HTMLタグ使用可）"></textarea>
              </div>

              <!-- Image -->
              <div v-if="block.type === 'image'" class="space-y-2">
                <input v-model="block.url" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" placeholder="画像URL（https://...）" />
                <div class="flex gap-2 items-center flex-wrap">
                  <input v-model="block.alt" class="flex-1 min-w-0 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px]" placeholder="代替テキスト" />
                  <select v-model="block.align" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 bg-white"><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select>
                  <div class="flex items-center gap-1">
                    <input type="range" v-model="block.width" min="20" max="100" class="w-16 h-1 accent-blue-600" />
                    <span class="text-[10px] text-slate-400 w-8">{{ block.width }}%</span>
                  </div>
                </div>
                <input v-model="block.link" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px]" placeholder="クリック時のリンクURL（任意）" />
                <div v-if="block.url" class="rounded-lg overflow-hidden border border-[#ebedf0] bg-[#f7f8fa]">
                  <img :src="block.url" class="max-h-32 object-contain mx-auto" @error="$event.target.style.display='none'" />
                </div>
              </div>

              <!-- Button -->
              <div v-if="block.type === 'button'" class="space-y-2">
                <input v-model="block.label" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" placeholder="ボタンテキスト" />
                <input v-model="block.url" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" placeholder="リンクURL" />
                <div class="flex gap-2 items-center flex-wrap">
                  <label class="flex items-center gap-1 text-[10px] text-slate-500">背景 <input type="color" v-model="block.bgColor" class="w-6 h-6 rounded border cursor-pointer" /></label>
                  <label class="flex items-center gap-1 text-[10px] text-slate-500">文字 <input type="color" v-model="block.textColor" class="w-6 h-6 rounded border cursor-pointer" /></label>
                  <select v-model="block.borderRadius" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 bg-white"><option value="0">角なし</option><option value="4">小</option><option value="8">中</option><option value="24">大</option><option value="9999">丸</option></select>
                  <select v-model="block.size" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 bg-white"><option value="sm">小</option><option value="md">中</option><option value="lg">大</option></select>
                  <select v-model="block.align" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 bg-white"><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select>
                </div>
              </div>

              <!-- Columns -->
              <div v-if="block.type === 'columns'" class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-slate-500">カラム数:</span>
                  <button v-for="n in [2, 3]" :key="n" @click="updateColumnsCount(block, n)" :class="['px-2.5 py-0.5 text-[10px] rounded border transition', block.count === n ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' : 'border-[#ebedf0] text-slate-500 hover:border-blue-200']">{{ n }}</button>
                </div>
                <div class="grid gap-2" :class="block.count === 2 ? 'grid-cols-2' : 'grid-cols-3'">
                  <textarea v-for="(col, ci) in block.cols" :key="ci" v-model="col.html" rows="3" class="border border-[#ebedf0] rounded-[9px] px-2 py-1.5 text-[10px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20" :placeholder="'カラム ' + (ci + 1) + '（HTML可）'"></textarea>
                </div>
              </div>

              <!-- Divider -->
              <div v-if="block.type === 'divider'" class="flex items-center gap-3">
                <label class="flex items-center gap-1 text-[10px] text-slate-500">色 <input type="color" v-model="block.color" class="w-6 h-6 rounded border cursor-pointer" /></label>
                <label class="flex items-center gap-1 text-[10px] text-slate-500">太さ <select v-model="block.thickness" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 bg-white"><option value="1">1px</option><option value="2">2px</option><option value="3">3px</option></select></label>
                <div class="flex-1 border-t" :style="{ borderColor: block.color, borderWidth: block.thickness + 'px' }"></div>
              </div>

              <!-- Spacer -->
              <div v-if="block.type === 'spacer'" class="flex items-center gap-3">
                <span class="text-[10px] text-slate-500">高さ:</span>
                <input type="range" v-model="block.height" min="8" max="64" class="flex-1 h-1 accent-blue-600" />
                <span class="text-[10px] text-slate-400 w-8 text-right tabular-nums">{{ block.height }}px</span>
              </div>

              <!-- Social -->
              <div v-if="block.type === 'social'" class="space-y-2">
                <div v-for="(link, li) in block.links" :key="li" class="flex items-center gap-2">
                  <select v-model="link.platform" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-1 bg-white w-24"><option v-for="p in socialPlatforms" :key="p">{{ p }}</option></select>
                  <input v-model="link.url" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px]" placeholder="https://..." />
                  <button @click="block.links.splice(li, 1)" class="text-red-400 hover:text-red-600 text-xs">×</button>
                </div>
                <div class="flex items-center gap-2">
                  <button @click="addSocialLink(block)" class="text-[10px] text-blue-600 hover:text-blue-800 font-bold">+ 追加</button>
                  <select v-model="block.align" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 bg-white ml-auto"><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select>
                </div>
              </div>

              <!-- Footer -->
              <div v-if="block.type === 'footer'" class="space-y-2">
                <input v-model="block.text" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" placeholder="フッターテキスト" />
                <div class="flex items-center gap-3 flex-wrap">
                  <label class="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer"><input type="checkbox" v-model="block.showUnsubscribe" class="rounded border-slate-300 text-blue-600 w-3 h-3" /> 配信停止リンク</label>
                  <select v-model="block.align" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 bg-white"><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select>
                  <input type="color" v-model="block.color" class="w-6 h-6 rounded border border-[#ebedf0] cursor-pointer" />
                </div>
              </div>
            </div>
          </div>

          <!-- Save bar -->
          <div class="px-5 py-3 border-t border-[#ebedf0] bg-white flex items-center justify-end shrink-0">
            <button @click="$emit('save')" :disabled="emailBlocks.length === 0" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-[7px] text-[12.5px] text-white font-medium hover:brightness-110 transition disabled:opacity-40">テンプレートとして保存</button>
          </div>
        </div>

        <!-- Email Preview -->
        <div class="w-96 shrink-0 bg-[#f7f8fa] flex flex-col items-center p-6 overflow-y-auto">
          <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-4">メール プレビュー</span>
          <div class="w-[340px] bg-white rounded-[13px] shadow-lg border border-[#ebedf0] overflow-hidden">
            <div class="bg-slate-100 px-4 py-3 border-b border-[#ebedf0]">
              <div class="text-[10px] text-slate-400">From: {{ emailSenderName || '差出人未設定' }}</div>
              <div class="text-xs font-bold text-slate-800 mt-0.5">{{ emailSubject || '件名未設定' }}</div>
            </div>
            <div :style="{ backgroundColor: emailSettings.bgColor }" class="p-2">
              <div class="mx-auto bg-white p-5 min-h-[300px]" :style="{ maxWidth: emailSettings.contentWidth + 'px' }">
                <p v-if="emailBlocks.length === 0" class="text-[10px] text-slate-300 text-center py-8">ブロックを追加するとプレビューが表示されます</p>
                <div v-else v-html="emailPreviewHtml"></div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ==================== SMS Editor ==================== -->
      <template v-else-if="selectedChannel === 'SMS'">
        <div class="flex-1 min-w-0 flex flex-col border-r border-[#ebedf0] bg-white overflow-hidden">
          <div class="px-5 py-3 border-b border-[#ebedf0] shrink-0 space-y-2">
            <h3 class="text-[12px] font-semibold text-[#6b7280]">SMS エディタ</h3>
            <input
              :value="templateTitle"
              @input="$emit('update:templateTitle', $event.target.value)"
              class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition"
              placeholder="テンプレート名"
            />
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-2">メッセージ本文</label>
              <textarea
                v-model="smsText"
                rows="6"
                class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition resize-none"
                placeholder="SMSメッセージを入力...（70文字で1通分）"
                maxlength="670"
              ></textarea>
            </div>

            <!-- Char counter & cost -->
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-[#f7f8fa] rounded-[13px] p-3 text-center">
                <div class="text-lg font-black text-slate-900 tabular-nums">{{ smsCharCount }}</div>
                <div class="text-[9px] font-bold text-slate-400">文字数</div>
              </div>
              <div class="bg-[#f7f8fa] rounded-[13px] p-3 text-center">
                <div class="text-lg font-black text-violet-600 tabular-nums">{{ Math.ceil(smsCharCount / 70) || 0 }}</div>
                <div class="text-[9px] font-bold text-slate-400">通数</div>
              </div>
              <div class="bg-[#f7f8fa] rounded-[13px] p-3 text-center">
                <div class="text-lg font-black text-slate-900 tabular-nums">¥{{ smsCost }}</div>
                <div class="text-[9px] font-bold text-slate-400">1通あたり</div>
              </div>
            </div>

            <!-- Character limit bar -->
            <div>
              <div class="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>文字数</span>
                <span>{{ smsCharCount }} / 670</span>
              </div>
              <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="smsCharCount > 600 ? 'bg-red-500' : smsCharCount > 400 ? 'bg-amber-500' : 'bg-violet-500'"
                  :style="{ width: Math.min(100, (smsCharCount / 670) * 100) + '%' }"
                ></div>
              </div>
            </div>

            <!-- URL shortener -->
            <div class="bg-[#f7f8fa] rounded-[13px] p-4 border border-[#ebedf0]">
              <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-2">URL短縮</label>
              <div class="flex gap-2">
                <input class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition" placeholder="短縮したいURLを入力..." />
                <button class="px-3 py-1.5 text-[10px] font-bold bg-violet-100 text-violet-600 rounded-lg hover:bg-violet-200 transition-colors whitespace-nowrap">短縮</button>
              </div>
            </div>
          </div>

          <div class="px-5 py-3 border-t border-[#ebedf0] bg-white flex items-center justify-end shrink-0">
            <button @click="$emit('save')" :disabled="!smsText" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-[7px] text-[12.5px] text-white font-medium hover:brightness-110 transition disabled:opacity-40">テンプレートとして保存</button>
          </div>
        </div>

        <!-- SMS Preview -->
        <div class="w-80 shrink-0 bg-[#f7f8fa] flex flex-col items-center p-6 overflow-y-auto">
          <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-4">SMS プレビュー</span>
          <div class="w-[280px] bg-[#1C1C1E] rounded-[2rem] p-3 shadow-xl">
            <div class="bg-[#F2F2F7] rounded-2xl overflow-hidden min-h-[400px]">
              <div class="bg-[#F2F2F7] px-4 py-3 text-center border-b border-[#ebedf0]">
                <span class="text-[12px] font-semibold text-[#6b7280]">SMS</span>
              </div>
              <div class="p-3 min-h-[340px]">
                <div v-if="smsText" class="flex justify-start mb-2">
                  <div class="bg-[#E5E5EA] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[220px]">
                    <p class="text-[11px] text-slate-800 whitespace-pre-wrap break-words">{{ smsText }}</p>
                  </div>
                </div>
                <div v-else class="text-center py-8">
                  <p class="text-[10px] text-slate-400">テキストを入力するとプレビューが表示されます</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ==================== Stock list (shared) ==================== -->
      <aside class="w-56 bg-[#f7f8fa] border-l border-[#ebedf0] overflow-y-auto shrink-0 hidden xl:block">
        <div class="px-4 py-3 border-b border-[#ebedf0]">
          <h3 class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">保存済みテンプレート</h3>
        </div>
        <div class="p-3 space-y-2">
          <div v-if="channelTemplates.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
            <div class="text-2xl mb-2">📭</div>
            <p class="text-[10px] text-slate-400">{{ selectedChannel }}のテンプレートはありません</p>
          </div>
          <div v-for="t in channelTemplates" :key="t.id" class="bg-white p-3 rounded-[13px] border border-[#ebedf0] group">
            <div class="flex items-start justify-between gap-1 mb-1">
              <span class="text-[11px] font-bold text-slate-800 leading-snug flex-1 min-w-0">{{ t.title }}</span>
              <button @click="$emit('deleteTemplate', t.id)" class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 text-[10px]">✕</button>
            </div>
            <p class="text-[9px] text-slate-400 truncate bg-[#f7f8fa] p-1.5 rounded font-mono">{{ t.content }}</p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
