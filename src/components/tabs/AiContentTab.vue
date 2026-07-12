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

// ==================== LINE: 複数メッセージ種別を1つのシナリオにまとめる ====================
const lineScenarioBlocks = ref([])
const activeBlockId = ref(null)

const blockKindMeta = {
  text: { label: 'テキスト/画像/ボタン', icon: '📝' },
  flex: { label: 'フレックス', icon: '🎴' },
  carousel: { label: 'カルーセル', icon: '🎠' },
  imagemap: { label: 'イメージマップ', icon: '🗺' },
}

const defaultBlockData = (kind) => {
  if (kind === 'text') return { subBlocks: [] }
  if (kind === 'flex') return { heroImage: '', title: '', subtitle: '', bodyTexts: [''], footerButtons: [{ label: '', url: '' }] }
  if (kind === 'carousel') return { cards: [{ imageUrl: '', title: '', text: '', buttons: [{ label: '', url: '' }] }] }
  if (kind === 'imagemap') return { baseUrl: '', baseWidth: 1040, baseHeight: 1040, actions: [{ x: 0, y: 0, width: 520, height: 520, type: 'uri', value: '', label: '' }] }
  return {}
}

const addScenarioBlock = (kind) => {
  const block = { id: Date.now() + Math.random(), kind, ...defaultBlockData(kind) }
  lineScenarioBlocks.value.push(block)
  activeBlockId.value = block.id
  syncContent()
}

const removeScenarioBlock = (index) => {
  lineScenarioBlocks.value.splice(index, 1)
  syncContent()
}

const moveScenarioBlock = (from, to) => {
  if (to < 0 || to >= lineScenarioBlocks.value.length) return
  const item = lineScenarioBlocks.value.splice(from, 1)[0]
  lineScenarioBlocks.value.splice(to, 0, item)
  syncContent()
}

const toggleActiveBlock = (id) => {
  activeBlockId.value = activeBlockId.value === id ? null : id
}

// テキスト種別ブロック内のサブブロック（テキスト/画像/ボタン）操作
const addSubBlock = (block, type) => {
  const sub = { id: Date.now() + Math.random(), type }
  if (type === 'text') sub.text = ''
  if (type === 'image') sub.url = ''
  if (type === 'button') { sub.label = ''; sub.url = '' }
  block.subBlocks.push(sub)
  syncContent()
}
const removeSubBlock = (block, index) => { block.subBlocks.splice(index, 1); syncContent() }

const addCarouselCard = (block) => { if (block.cards.length < 10) block.cards.push({ imageUrl: '', title: '', text: '', buttons: [{ label: '', url: '' }] }) }
const removeCarouselCard = (block, i) => { block.cards.splice(i, 1) }
const addImageMapAction = (block) => { block.actions.push({ x: 0, y: 0, width: 520, height: 520, type: 'uri', value: '', label: '' }) }
const removeImageMapAction = (block, i) => { block.actions.splice(i, 1) }

const syncContent = () => {
  emit('update:generatedContent', summarizeLineBlocks(lineScenarioBlocks.value))
  emit('update:generatedMessagesJson', buildLineMessages(lineScenarioBlocks.value))
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
    const messages = buildLineMessages(lineScenarioBlocks.value)
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
  lineScenarioBlocks.value = []
  activeBlockId.value = null
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
      <!-- ==================== LINE Editor ==================== -->
      <template v-if="selectedChannel === 'LINE'">
        <div class="flex-1 min-w-0 flex flex-col border-r border-[#ebedf0] bg-white overflow-hidden">
          <!-- Header -->
          <div class="px-5 py-3 border-b border-[#ebedf0] shrink-0">
            <h3 class="text-[12px] font-semibold text-[#6b7280] mb-2">リテンションシナリオ（LINE）</h3>
            <input :value="templateTitle" @input="$emit('update:templateTitle', $event.target.value)" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition" placeholder="シナリオ名（例: 初回クーポン配信）" />
            <p class="text-[10px] text-slate-400 mt-1.5">テキスト・フレックス・カルーセル・イメージマップを自由に組み合わせて、1つのシナリオとして送信できます</p>
          </div>

          <!-- Add block toolbar -->
          <div class="px-5 py-2 bg-[#f7f8fa] border-b border-[#ebedf0] flex gap-1.5 shrink-0">
            <button v-for="(meta, kind) in blockKindMeta" :key="kind" @click="addScenarioBlock(kind)" class="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-[#3a3f47] bg-white border border-[#e6e8ec] rounded-[8px] hover:bg-[#f1f2f4] transition-colors">
              <span>{{ meta.icon }}</span> ＋{{ meta.label }}
            </button>
          </div>

          <!-- Block list -->
          <div class="flex-1 overflow-y-auto p-5">
            <div v-if="lineScenarioBlocks.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
              <div class="text-3xl mb-2">🗂️</div>
              <p class="text-xs text-slate-400">上のボタンからメッセージを追加してシナリオを組み立てましょう</p>
              <p class="text-[10px] text-slate-300 mt-1">複数追加すると、その順番でまとめて配信されます</p>
            </div>

            <div class="space-y-3">
              <div
                v-for="(block, i) in lineScenarioBlocks"
                :key="block.id"
                class="bg-white border border-[#ebedf0] rounded-[13px] overflow-hidden group"
                :class="activeBlockId === block.id ? 'ring-2 ring-emerald-400' : ''"
              >
                <!-- Block header -->
                <button @click="toggleActiveBlock(block.id)" class="w-full flex items-center justify-between px-4 py-3 bg-[#fafbfc] hover:bg-[#f4f5f6] transition-colors">
                  <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center">{{ i + 1 }}</span>
                    <span class="text-[11px] font-bold text-slate-700">{{ blockKindMeta[block.kind].icon }} {{ blockKindMeta[block.kind].label }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <span @click.stop="moveScenarioBlock(i, i - 1)" :class="['w-5 h-5 rounded text-[10px] flex items-center justify-center', i === 0 ? 'text-slate-200' : 'bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer']">↑</span>
                    <span @click.stop="moveScenarioBlock(i, i + 1)" :class="['w-5 h-5 rounded text-[10px] flex items-center justify-center', i === lineScenarioBlocks.length - 1 ? 'text-slate-200' : 'bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer']">↓</span>
                    <span @click.stop="removeScenarioBlock(i)" class="w-5 h-5 rounded text-[10px] bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center cursor-pointer">×</span>
                    <span class="text-[9px] text-slate-300 ml-1">{{ activeBlockId === block.id ? '▲' : '▼' }}</span>
                  </div>
                </button>

                <div v-if="activeBlockId === block.id" class="p-4 border-t border-[#ebedf0]">
                  <!-- ===== text kind ===== -->
                  <template v-if="block.kind === 'text'">
                    <div class="flex gap-2 mb-3">
                      <button v-for="bt in [{type:'text',label:'テキスト',icon:'📝'},{type:'image',label:'画像',icon:'🖼'},{type:'button',label:'ボタン',icon:'🔘'}]" :key="bt.type" @click="addSubBlock(block, bt.type)" class="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-[#3a3f47] bg-white border border-[#e6e8ec] rounded-[7px] hover:bg-[#f1f2f4] transition-colors">
                        <span>{{ bt.icon }}</span> {{ bt.label }}
                      </button>
                    </div>
                    <div v-if="block.subBlocks.length === 0" class="text-center py-6 text-[11px] text-slate-300">テキスト・画像・ボタンを追加してください</div>
                    <div class="space-y-2.5">
                      <div v-for="(sub, si) in block.subBlocks" :key="sub.id" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[10px] p-3 relative group/sub">
                        <button @click="removeSubBlock(block, si)" class="absolute top-2 right-2 w-5 h-5 rounded text-[10px] bg-white text-red-400 hover:text-red-600 flex items-center justify-center opacity-0 group-hover/sub:opacity-100 transition-opacity">×</button>
                        <textarea v-if="sub.type === 'text'" v-model="sub.text" @input="syncContent" rows="2" class="w-full bg-white border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition resize-none" placeholder="メッセージテキスト"></textarea>
                        <input v-if="sub.type === 'image'" v-model="sub.url" @input="syncContent" class="w-full bg-white border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="画像URL（https://...）" />
                        <div v-if="sub.type === 'button'" class="flex gap-2">
                          <input v-model="sub.label" @input="syncContent" class="flex-1 bg-white border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="ボタンラベル" />
                          <input v-model="sub.url" @input="syncContent" class="flex-1 bg-white border border-[#ebedf0] rounded-[8px] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="リンクURL" />
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- ===== flex kind ===== -->
                  <template v-else-if="block.kind === 'flex'">
                    <div class="space-y-3">
                      <input v-model="block.heroImage" @input="syncContent" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="ヒーロー画像URL（任意）" />
                      <input v-model="block.title" @input="syncContent" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="タイトル" />
                      <input v-model="block.subtitle" @input="syncContent" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="サブタイトル（任意）" />
                      <div v-for="(_, ti) in block.bodyTexts" :key="ti" class="flex gap-2">
                        <textarea v-model="block.bodyTexts[ti]" @input="syncContent" rows="2" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="本文テキスト"></textarea>
                        <button v-if="block.bodyTexts.length > 1" @click="block.bodyTexts.splice(ti, 1); syncContent()" class="text-red-400 hover:text-red-600 text-xs self-start mt-1">×</button>
                      </div>
                      <button @click="block.bodyTexts.push(''); syncContent()" class="text-[10px] font-bold text-emerald-600 hover:text-emerald-800">+ 本文を追加</button>
                      <div>
                        <label class="text-[10px] font-bold text-slate-400 block mb-1">フッターボタン</label>
                        <div v-for="(btn, bi) in block.footerButtons" :key="bi" class="flex gap-2 mb-1.5">
                          <input v-model="btn.label" @input="syncContent" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="ラベル" />
                          <input v-model="btn.url" @input="syncContent" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="URL" />
                          <button v-if="block.footerButtons.length > 1" @click="block.footerButtons.splice(bi, 1); syncContent()" class="text-red-400 hover:text-red-600 text-xs">×</button>
                        </div>
                        <button @click="block.footerButtons.push({ label: '', url: '' }); syncContent()" class="text-[10px] font-bold text-emerald-600 hover:text-emerald-800">+ ボタン追加</button>
                      </div>
                    </div>
                  </template>

                  <!-- ===== carousel kind ===== -->
                  <template v-else-if="block.kind === 'carousel'">
                    <div class="space-y-3">
                      <div v-for="(card, ci) in block.cards" :key="ci" class="border border-[#ebedf0] rounded-[10px] p-3 group/card relative">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-[10px] font-semibold text-[#9097a1]">カード {{ ci + 1 }} / {{ block.cards.length }}</span>
                          <button v-if="block.cards.length > 1" @click="removeCarouselCard(block, ci)" class="w-5 h-5 rounded text-[10px] bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">×</button>
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
                      <button @click="addCarouselCard(block)" :disabled="block.cards.length >= 10" class="w-full py-2 border-2 border-dashed border-[#ebedf0] rounded-[10px] text-[10px] font-bold text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors disabled:opacity-40">+ カード追加（最大10枚）</button>
                    </div>
                  </template>

                  <!-- ===== imagemap kind ===== -->
                  <template v-else-if="block.kind === 'imagemap'">
                    <div class="space-y-3">
                      <input v-model="block.baseUrl" @input="syncContent" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition" placeholder="ベース画像URL（幅1040px推奨）" />
                      <div class="flex gap-3">
                        <label class="flex items-center gap-1.5 text-[10px] text-slate-500">幅 <input type="number" v-model.number="block.baseWidth" class="w-16 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] text-center" /></label>
                        <label class="flex items-center gap-1.5 text-[10px] text-slate-500">高さ <input type="number" v-model.number="block.baseHeight" class="w-16 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] text-center" /></label>
                      </div>
                      <div v-for="(action, ai) in block.actions" :key="ai" class="border border-[#ebedf0] rounded-[10px] p-3 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-bold text-slate-500">エリア {{ ai + 1 }}</span>
                          <button v-if="block.actions.length > 1" @click="removeImageMapAction(block, ai)" class="w-5 h-5 rounded text-[10px] bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center">×</button>
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
                      <button @click="addImageMapAction(block)" class="w-full py-2 border-2 border-dashed border-[#ebedf0] rounded-[10px] text-[10px] font-bold text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors">+ タップエリア追加</button>
                    </div>
                  </template>
                </div>
              </div>
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
              <button @click="saveScenario" :disabled="lineScenarioBlocks.length === 0" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-[7px] text-[12.5px] text-white font-medium hover:brightness-110 transition disabled:opacity-40">リテンションシナリオとして保存</button>
            </div>
          </div>
        </div>

        <!-- LINE Preview -->
        <div class="w-80 shrink-0 bg-[#f7f8fa] flex flex-col items-center p-6 overflow-y-auto">
          <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-4">LINE プレビュー</span>
          <div class="w-[280px] bg-[#7494C0] rounded-[2rem] p-3 shadow-xl">
            <div class="bg-white rounded-2xl overflow-hidden min-h-[400px]">
              <div class="bg-emerald-500 px-4 py-3 flex items-center gap-2">
                <div class="w-6 h-6 bg-white/30 rounded-full"></div>
                <span class="text-white text-xs font-bold">公式アカウント</span>
              </div>
              <div class="p-3 space-y-2 bg-[#8CABD9] min-h-[340px]">
                <div v-if="lineScenarioBlocks.length === 0" class="text-center py-8"><p class="text-[10px] text-white/70">メッセージを追加するとプレビュー表示</p></div>

                <template v-for="block in lineScenarioBlocks" :key="block.id">
                  <!-- text sub-blocks preview -->
                  <template v-if="block.kind === 'text'">
                    <template v-for="sub in block.subBlocks" :key="sub.id">
                      <div v-if="sub.type === 'text' && sub.text" class="flex justify-start"><div class="bg-white rounded-2xl rounded-tl-sm px-3 py-2 max-w-[220px] shadow-sm"><p class="text-[11px] text-slate-800 whitespace-pre-wrap break-words">{{ sub.text }}</p></div></div>
                      <div v-if="sub.type === 'image' && sub.url" class="flex justify-start"><div class="bg-white rounded-2xl rounded-tl-sm overflow-hidden max-w-[220px] shadow-sm"><img :src="sub.url" class="w-full object-cover" /></div></div>
                      <div v-if="sub.type === 'button' && sub.label" class="flex justify-start"><div class="bg-white rounded-2xl rounded-tl-sm overflow-hidden max-w-[220px] shadow-sm w-full"><div class="px-3 py-2.5 text-center"><span class="text-[11px] font-bold text-emerald-600">{{ sub.label }}</span></div></div></div>
                    </template>
                  </template>

                  <!-- flex preview -->
                  <div v-else-if="block.kind === 'flex'" class="flex justify-start">
                    <div class="bg-white rounded-[13px] overflow-hidden shadow-sm w-[240px]">
                      <img v-if="block.heroImage" :src="block.heroImage" class="w-full h-28 object-cover" @error="$event.target.style.display='none'" />
                      <div v-else class="h-20 bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center text-slate-300 text-xs">Hero Image</div>
                      <div class="p-3">
                        <p class="text-xs font-bold text-slate-900">{{ block.title || 'タイトル' }}</p>
                        <p v-if="block.subtitle" class="text-[10px] text-slate-400 mt-0.5">{{ block.subtitle }}</p>
                        <p v-for="(t, i) in block.bodyTexts" :key="i" class="text-[10px] text-slate-600 mt-1.5 leading-relaxed">{{ t || '本文テキスト' }}</p>
                      </div>
                      <div v-if="block.footerButtons.some(b => b.label)" class="border-t border-slate-100">
                        <template v-for="(btn, i) in block.footerButtons" :key="i">
                          <div v-if="btn.label" class="text-center py-2 border-b border-slate-50 last:border-b-0"><span class="text-[11px] font-bold text-emerald-600">{{ btn.label }}</span></div>
                        </template>
                      </div>
                    </div>
                  </div>

                  <!-- carousel preview -->
                  <div v-else-if="block.kind === 'carousel'" class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x" style="scrollbar-width:thin">
                    <div v-for="(card, ci) in block.cards" :key="ci" class="bg-white rounded-[13px] overflow-hidden shadow-sm min-w-[180px] max-w-[180px] shrink-0 snap-start">
                      <div v-if="card.imageUrl" class="h-24 bg-slate-100"><img :src="card.imageUrl" class="w-full h-full object-cover" @error="$event.target.style.display='none'" /></div>
                      <div v-else class="h-24 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-[10px] text-slate-300">画像</div>
                      <div class="p-2.5">
                        <p class="text-[11px] font-bold text-slate-900 truncate">{{ card.title || 'タイトル' }}</p>
                        <p class="text-[9px] text-slate-500 mt-0.5 line-clamp-2">{{ card.text || 'テキスト' }}</p>
                      </div>
                      <template v-for="(btn, bi) in card.buttons" :key="bi">
                        <div v-if="btn.label" class="text-center py-1.5 border-t border-slate-100"><span class="text-[10px] font-bold text-emerald-600">{{ btn.label }}</span></div>
                      </template>
                    </div>
                  </div>

                  <!-- imagemap preview -->
                  <div v-else-if="block.kind === 'imagemap'" class="flex justify-start">
                    <div class="relative w-[240px] rounded-[13px] overflow-hidden shadow-sm">
                      <img v-if="block.baseUrl" :src="block.baseUrl" class="w-full" @error="$event.target.style.display='none'" />
                      <div v-else class="h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-[10px] text-slate-400">画像を設定してください</div>
                      <template v-if="block.baseUrl">
                        <div v-for="(action, ai) in block.actions" :key="ai" class="absolute border-2 border-white/60 bg-white/10 flex items-center justify-center backdrop-blur-[1px]" :style="{ left: (action.x / block.baseWidth * 100) + '%', top: (action.y / block.baseHeight * 100) + '%', width: (action.width / block.baseWidth * 100) + '%', height: (action.height / block.baseHeight * 100) + '%' }">
                          <span class="text-[8px] bg-black/50 text-white px-1.5 py-0.5 rounded font-bold">{{ action.label || ai + 1 }}</span>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>

              </div>
            </div>
          </div>
        </div>
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
