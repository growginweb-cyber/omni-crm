<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  surveyCampaigns: Array,
  selectedCampaignId: String,
  surveyQuestions: Array,
  newCampaignTitle: String,
  newQuestionText: String,
  isCreatingQuestion: Boolean,
  savedTemplates: Array,
  flowJson: Object,
})
const emit = defineEmits(['update:newCampaignTitle', 'update:newQuestionText', 'selectCampaign', 'saveFlow', 'createCampaign', 'toggleActiveCampaign', 'createQuestion', 'addChoice'])

const NODE_W = 180

const nodeTypes = [
  { type: 'trigger', label: '友だち追加', icon: '🎯', bg: 'bg-emerald-50', border: 'border-emerald-400', accent: 'text-emerald-700' },
  { type: 'text', label: 'テキスト', icon: '📝', bg: 'bg-blue-50', border: 'border-blue-400', accent: 'text-blue-700' },
  { type: 'flex', label: 'フレックス', icon: '🎴', bg: 'bg-purple-50', border: 'border-purple-400', accent: 'text-purple-700' },
  { type: 'imagemap', label: 'イメージマップ', icon: '🗺', bg: 'bg-amber-50', border: 'border-amber-400', accent: 'text-amber-700' },
  { type: 'tag', label: 'タグ分岐', icon: '🏷', bg: 'bg-rose-50', border: 'border-rose-400', accent: 'text-rose-700' },
  { type: 'cta', label: 'CTA', icon: '🔗', bg: 'bg-indigo-50', border: 'border-indigo-400', accent: 'text-indigo-700' },
]

const DEFAULT_NODES = [{ id: 'trigger-1', type: 'trigger', x: 360, y: 40, data: { label: '友だち追加' } }]

const nodes = ref(JSON.parse(JSON.stringify(DEFAULT_NODES)))
const connections = ref([])
const selectedNodeId = ref(null)
const canvasRef = ref(null)
const connectingFrom = ref(null)
const tempLineEnd = ref(null)

// flowJsonプロップが変わったらキャンバスをリストア
watch(() => props.flowJson, (val) => {
  if (val && val.nodes) {
    nodes.value = JSON.parse(JSON.stringify(val.nodes))
    connections.value = JSON.parse(JSON.stringify(val.connections || []))
  } else {
    nodes.value = JSON.parse(JSON.stringify(DEFAULT_NODES))
    connections.value = []
  }
  selectedNodeId.value = null
}, { immediate: true })

// debounce保存タイマー
let saveTimer = null
const scheduleAutoSave = () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    emit('saveFlow', { nodes: nodes.value, connections: connections.value })
  }, 1000)
}

const selectedNode = computed(() => nodes.value.find(n => n.id === selectedNodeId.value))
const nodeTypeMeta = (type) => nodeTypes.find(t => t.type === type) || nodeTypes[0]

const lineImageSizes = [
  { label: '1:1 (1040×1040)', width: 1040, height: 1040 },
  { label: '16:9 (1040×585)', width: 1040, height: 585 },
  { label: '3:2 (1040×700)', width: 1040, height: 700 },
  { label: '2:1 (1040×520)', width: 1040, height: 520 },
  { label: '3:4 (1040×1390)', width: 1040, height: 1390 },
  { label: '2:3 (1040×1560)', width: 1040, height: 1560 },
]

const flexTemplates = computed(() => {
  if (!props.savedTemplates) return []
  return props.savedTemplates.filter(t => t.delivery_channel === 'LINE')
})

const showQrModal = ref(false)
const qrUrl = ref('')
const qrImageUrl = computed(() => {
  if (!qrUrl.value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl.value)}`
})

const applyImageSize = (node, size) => {
  node.data.baseWidth = size.width
  node.data.baseHeight = size.height
}

const selectFlexTemplate = (node, templateId) => {
  const t = props.savedTemplates?.find(tp => tp.id === templateId)
  if (t) {
    node.data.templateId = templateId
    node.data.templateName = t.title
  }
}

const nodeHeight = (node) => {
  if (node.type === 'tag') return 56 + (node.data.conditions?.length || 1) * 22
  return 56
}

const addNode = (type) => {
  const id = type + '-' + Date.now()
  const maxY = nodes.value.reduce((m, n) => Math.max(m, n.y + nodeHeight(n)), 0)
  const defaults = {
    trigger: { label: '友だち追加' },
    text: { message: '' },
    flex: { templateId: null, templateName: '' },
    imagemap: { baseUrl: '', baseWidth: 1040, baseHeight: 1040, actions: [{ x: 0, y: 0, width: 520, height: 520, type: 'uri', value: '', label: '' }] },
    tag: { conditions: [{ match: '', tag: '' }] },
    cta: { label: '', url: '', actionType: 'uri' },
  }
  nodes.value.push({ id, type, x: 360, y: maxY + 80, data: { ...defaults[type] } })
  selectedNodeId.value = id
  scheduleAutoSave()
}

const removeNode = (id) => {
  nodes.value = nodes.value.filter(n => n.id !== id)
  connections.value = connections.value.filter(c => c.from !== id && c.to !== id)
  if (selectedNodeId.value === id) selectedNodeId.value = null
  scheduleAutoSave()
}

const removeConnection = (ci) => { connections.value.splice(ci, 1); scheduleAutoSave() }

const getPortPos = (node, isOutput, portIndex = 0) => {
  const h = nodeHeight(node)
  if (isOutput) {
    if (node.type === 'tag' && node.data.conditions?.length > 1) {
      const count = node.data.conditions.length
      const spacing = NODE_W / (count + 1)
      return { x: node.x + spacing * (portIndex + 1), y: node.y + h }
    }
    return { x: node.x + NODE_W / 2, y: node.y + h }
  }
  return { x: node.x + NODE_W / 2, y: node.y }
}

const getPath = (conn) => {
  const from = nodes.value.find(n => n.id === conn.from)
  const to = nodes.value.find(n => n.id === conn.to)
  if (!from || !to) return ''
  const p1 = getPortPos(from, true, conn.fromPort || 0)
  const p2 = getPortPos(to, false)
  const dy = Math.abs(p2.y - p1.y)
  const cy = Math.max(dy * 0.4, 30)
  return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + cy}, ${p2.x} ${p2.y - cy}, ${p2.x} ${p2.y}`
}

const tempPath = computed(() => {
  if (!connectingFrom.value || !tempLineEnd.value) return ''
  const from = nodes.value.find(n => n.id === connectingFrom.value.nodeId)
  if (!from) return ''
  const p1 = getPortPos(from, true, connectingFrom.value.portIndex || 0)
  const p2 = tempLineEnd.value
  const dy = Math.abs(p2.y - p1.y)
  const cy = Math.max(dy * 0.4, 30)
  return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + cy}, ${p2.x} ${p2.y - cy}, ${p2.x} ${p2.y}`
})

const canvasCoords = (e) => {
  if (!canvasRef.value) return { x: 0, y: 0 }
  const rect = canvasRef.value.getBoundingClientRect()
  return { x: e.clientX - rect.left + canvasRef.value.scrollLeft, y: e.clientY - rect.top + canvasRef.value.scrollTop }
}

const startDrag = (node, e) => {
  if (e.target.closest('.port')) return
  e.preventDefault()
  selectedNodeId.value = node.id
  const start = canvasCoords(e)
  const ox = start.x - node.x, oy = start.y - node.y
  const onMove = (me) => { const p = canvasCoords(me); node.x = p.x - ox; node.y = p.y - oy }
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); scheduleAutoSave() }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const startConnect = (nodeId, portIndex, e) => {
  e.stopPropagation(); e.preventDefault()
  connectingFrom.value = { nodeId, portIndex: portIndex || 0 }
  const onMove = (me) => { tempLineEnd.value = canvasCoords(me) }
  const onUp = (me) => {
    const el = document.elementFromPoint(me.clientX, me.clientY)
    const port = el?.closest('[data-input-port]')
    if (port) {
      const toId = port.dataset.inputPort
      if (toId !== nodeId) {
        connections.value = connections.value.filter(c => !(c.from === nodeId && c.fromPort === (portIndex || 0)))
        connections.value.push({ from: nodeId, fromPort: portIndex || 0, to: toId })
        scheduleAutoSave()
      }
    }
    connectingFrom.value = null; tempLineEnd.value = null
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const addTagCondition = (node) => { node.data.conditions.push({ match: '', tag: '' }); scheduleAutoSave() }
const removeTagCondition = (node, i) => {
  node.data.conditions.splice(i, 1)
  connections.value = connections.value.filter(c => !(c.from === node.id && c.fromPort === i))
  scheduleAutoSave()
}

const outputPortCount = (node) => {
  if (node.type === 'tag') return Math.max(node.data.conditions?.length || 1, 1)
  return 1
}

const selectedCampaign = computed(() => {
  if (!props.selectedCampaignId || !props.surveyCampaigns) return null
  return props.surveyCampaigns.find(c => c.id === props.selectedCampaignId)
})
</script>

<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- Left: Node palette + campaigns -->
    <aside class="w-52 bg-slate-950 border-r border-slate-800 overflow-y-auto shrink-0 flex flex-col">
      <div class="px-4 py-3 border-b border-slate-800">
        <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ノード追加</h3>
      </div>
      <div class="p-2.5 grid grid-cols-2 gap-1.5">
        <button v-for="nt in nodeTypes" :key="nt.type" @click="addNode(nt.type)" :class="['flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-center transition-all hover:shadow-sm', nt.bg, 'border-transparent hover:' + nt.border]">
          <span class="text-base">{{ nt.icon }}</span>
          <span :class="['text-[9px] font-bold', nt.accent]">{{ nt.label }}</span>
        </button>
      </div>

      <div class="px-4 py-2 border-t border-slate-800">
        <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">診断キャンペーン</h3>
        <div class="space-y-1.5 mb-3">
          <div v-for="cp in surveyCampaigns" :key="cp.id" @click="$emit('selectCampaign', cp.id)" :class="['p-2 rounded-lg cursor-pointer transition-all text-xs', selectedCampaignId === cp.id ? 'bg-indigo-600/20 text-white' : 'text-slate-400 hover:bg-slate-800']">
            <div class="flex items-center gap-1.5">
              <span :class="['w-1.5 h-1.5 rounded-full', cp.is_active ? 'bg-emerald-400' : 'bg-slate-600']"></span>
              <span class="font-semibold truncate text-[11px]">{{ cp.title }}</span>
            </div>
          </div>
        </div>
        <input :value="newCampaignTitle" @input="$emit('update:newCampaignTitle', $event.target.value)" class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-1.5" placeholder="新しい診断名..." />
        <button @click="$emit('createCampaign')" class="w-full bg-indigo-600 text-white py-1 rounded text-[10px] font-bold hover:bg-indigo-700 transition-colors">+ 作成</button>
      </div>
    </aside>

    <!-- Center: Flow canvas -->
    <div ref="canvasRef" class="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing" style="background-color:#f8fafc;background-image:radial-gradient(circle,#e2e8f0 1px,transparent 1px);background-size:20px 20px">
      <svg class="absolute top-0 left-0 pointer-events-none" style="width:3000px;height:2000px">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#94a3b8" /></marker>
        </defs>
        <path v-for="(conn, ci) in connections" :key="ci" :d="getPath(conn)" fill="none" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrowhead)" />
        <path v-if="tempPath" :d="tempPath" fill="none" stroke="#6366f1" stroke-width="2" stroke-dasharray="6 3" />
      </svg>

      <div v-for="node in nodes" :key="node.id" class="absolute select-none" :style="{ left: node.x + 'px', top: node.y + 'px', width: NODE_W + 'px' }" @mousedown="startDrag(node, $event)">
        <!-- Input port -->
        <div v-if="node.type !== 'trigger'" class="port absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-300 hover:border-indigo-500 hover:scale-125 cursor-crosshair z-20 transition-all" :data-input-port="node.id"></div>

        <!-- Node card -->
        <div :class="['rounded-xl shadow-sm border-2 cursor-move transition-all', selectedNodeId === node.id ? 'ring-2 ring-indigo-400/50 shadow-md ' + nodeTypeMeta(node.type).border : 'border-slate-200/80 hover:shadow-md', nodeTypeMeta(node.type).bg]" @click.stop="selectedNodeId = node.id">
          <div class="px-3 py-2.5 flex items-center gap-2">
            <span class="text-sm">{{ nodeTypeMeta(node.type).icon }}</span>
            <div class="flex-1 min-w-0">
              <span :class="['text-[11px] font-bold', nodeTypeMeta(node.type).accent]">{{ nodeTypeMeta(node.type).label }}</span>
              <p class="text-[9px] text-slate-500 truncate mt-0.5">
                {{ node.type === 'trigger' ? node.data.label : node.type === 'text' ? (node.data.message || '未設定') : node.type === 'flex' ? (node.data.templateName || 'テンプレート未選択') : node.type === 'imagemap' ? (node.data.baseUrl ? '画像設定済み' : '未設定') : node.type === 'tag' ? (node.data.conditions?.length || 0) + '条件' : node.type === 'cta' ? (node.data.label || '未設定') : '' }}
              </p>
            </div>
          </div>
          <!-- Tag condition labels -->
          <div v-if="node.type === 'tag' && node.data.conditions" class="px-2 pb-2 space-y-0.5">
            <div v-for="(cond, ci) in node.data.conditions" :key="ci" class="flex items-center gap-1 text-[8px]">
              <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: ['#f43f5e','#f59e0b','#3b82f6','#8b5cf6','#10b981'][ci % 5] }"></span>
              <span class="text-slate-600 truncate">{{ cond.tag || '条件' + (ci + 1) }}</span>
            </div>
          </div>
        </div>

        <!-- Output ports -->
        <template v-if="node.type === 'tag' && node.data.conditions?.length > 1">
          <div v-for="(_, pi) in node.data.conditions" :key="'op'+pi" class="port absolute -bottom-[6px] w-3 h-3 rounded-full border-2 hover:scale-125 cursor-crosshair z-20 transition-all" :style="{ left: (NODE_W / (node.data.conditions.length + 1) * (pi + 1) - 6) + 'px', backgroundColor: ['#f43f5e','#f59e0b','#3b82f6','#8b5cf6','#10b981'][pi % 5], borderColor: ['#f43f5e','#f59e0b','#3b82f6','#8b5cf6','#10b981'][pi % 5] }" @mousedown="startConnect(node.id, pi, $event)"></div>
        </template>
        <div v-else class="port absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-300 hover:border-indigo-500 hover:scale-125 cursor-crosshair z-20 transition-all" @mousedown="startConnect(node.id, 0, $event)"></div>
      </div>

      <!-- QR code button -->
      <button @click="showQrModal = true" class="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-[11px] font-bold text-slate-600 hover:text-emerald-700">
        <span class="text-sm">📱</span> LINEプレビュー
      </button>

      <!-- QR modal -->
      <div v-if="showQrModal" class="absolute inset-0 z-30 flex items-center justify-center bg-black/30" @click.self="showQrModal = false">
        <div class="bg-white rounded-2xl shadow-2xl p-6 w-80 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900">LINE実機プレビュー</h3>
            <button @click="showQrModal = false" class="text-slate-400 hover:text-slate-600 text-lg">×</button>
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-1">LINE Bot URL / LIFF URL</label>
            <input v-model="qrUrl" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="https://line.me/R/ti/p/@xxxxx" />
          </div>
          <div v-if="qrImageUrl" class="flex flex-col items-center">
            <img :src="qrImageUrl" class="w-48 h-48 rounded-lg border border-slate-200" alt="QR Code" />
            <p class="text-[10px] text-slate-400 mt-2">LINEアプリでスキャンしてテスト</p>
          </div>
          <div v-else class="flex flex-col items-center py-6">
            <span class="text-3xl mb-2">📷</span>
            <p class="text-[10px] text-slate-400">URLを入力するとQRコードが生成されます</p>
          </div>
        </div>
      </div>

      <!-- Empty hint -->
      <div v-if="nodes.length <= 1" class="absolute top-32 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <p class="text-xs text-slate-400">左のパレットからノードを追加してフローを設計</p>
        <p class="text-[10px] text-slate-300 mt-1">出力ポート(下)から入力ポート(上)へドラッグで接続</p>
      </div>
    </div>

    <!-- Right: Node properties -->
    <aside class="w-72 bg-white border-l border-slate-200/60 overflow-y-auto shrink-0 flex flex-col">
      <div class="px-4 py-3 border-b border-slate-200/60 flex items-center justify-between">
        <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ノード設定</h3>
        <button v-if="selectedNode && selectedNode.type !== 'trigger'" @click="removeNode(selectedNode.id)" class="text-[10px] text-red-400 hover:text-red-600 font-bold">削除</button>
      </div>

      <template v-if="selectedNode">
        <div class="p-4 space-y-4 flex-1">
          <div :class="['rounded-[14px] p-3 text-center', nodeTypeMeta(selectedNode.type).bg]">
            <span class="text-xl">{{ nodeTypeMeta(selectedNode.type).icon }}</span>
            <div :class="['text-xs font-bold mt-1', nodeTypeMeta(selectedNode.type).accent]">{{ nodeTypeMeta(selectedNode.type).label }}</div>
          </div>

          <!-- Trigger -->
          <template v-if="selectedNode.type === 'trigger'">
            <div>
              <label class="text-[10px] font-bold text-slate-400 block mb-1">トリガーラベル</label>
              <input v-model="selectedNode.data.label" class="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
          </template>

          <!-- Text -->
          <template v-if="selectedNode.type === 'text'">
            <div>
              <label class="text-[10px] font-bold text-slate-400 block mb-1">メッセージ</label>
              <textarea v-model="selectedNode.data.message" rows="4" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="テキストメッセージを入力..."></textarea>
            </div>
          </template>

          <!-- Flex -->
          <template v-if="selectedNode.type === 'flex'">
            <div>
              <label class="text-[10px] font-bold text-slate-400 block mb-1">Flexテンプレート選択</label>
              <p class="text-[9px] text-slate-400 mb-2">コンテンツ作成 → LINE → フレックスで事前に作成・保存したテンプレートを選択</p>
              <select @change="selectFlexTemplate(selectedNode, $event.target.value)" :value="selectedNode.data.templateId || ''" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20">
                <option value="" disabled>テンプレートを選択...</option>
                <option v-for="t in flexTemplates" :key="t.id" :value="t.id">{{ t.title }}</option>
              </select>
            </div>
            <div v-if="selectedNode.data.templateId" class="bg-purple-50 rounded-[14px] p-3">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs">🎴</span>
                <span class="text-[11px] font-bold text-purple-700">{{ selectedNode.data.templateName }}</span>
              </div>
              <p class="text-[9px] text-purple-500">テンプレートが適用されています</p>
              <button @click="selectedNode.data.templateId = null; selectedNode.data.templateName = ''" class="text-[9px] text-red-400 hover:text-red-600 mt-1">選択解除</button>
            </div>
            <div v-if="flexTemplates.length === 0" class="bg-amber-50 rounded-[14px] p-3">
              <p class="text-[10px] text-amber-700 font-bold">テンプレートがありません</p>
              <p class="text-[9px] text-amber-600 mt-0.5">コンテンツ作成 → LINE → フレックスタブで作成してください</p>
            </div>
          </template>

          <!-- ImageMap -->
          <template v-if="selectedNode.type === 'imagemap'">
            <div>
              <label class="text-[10px] font-bold text-slate-400 block mb-1">ベース画像URL</label>
              <input v-model="selectedNode.data.baseUrl" class="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20" placeholder="画像URL（幅1040px推奨）" />
              <div v-if="selectedNode.data.baseUrl" class="mt-2 rounded-lg overflow-hidden border border-slate-200"><img :src="selectedNode.data.baseUrl" class="w-full" @error="$event.target.style.display='none'" /></div>
            </div>
            <div>
              <label class="text-[10px] font-bold text-slate-400 block mb-1">LINE画像サイズ</label>
              <select @change="applyImageSize(selectedNode, lineImageSizes[$event.target.selectedIndex - 1])" class="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                <option disabled selected>プリセットから選択...</option>
                <option v-for="s in lineImageSizes" :key="s.label">{{ s.label }}</option>
              </select>
              <div class="flex gap-2">
                <label class="text-[10px] text-slate-500 flex-1">幅 <input type="number" v-model.number="selectedNode.data.baseWidth" class="w-full border border-slate-200 rounded px-2 py-1 text-[10px] mt-0.5" /></label>
                <label class="text-[10px] text-slate-500 flex-1">高さ <input type="number" v-model.number="selectedNode.data.baseHeight" class="w-full border border-slate-200 rounded px-2 py-1 text-[10px] mt-0.5" /></label>
              </div>
            </div>
            <div>
              <label class="text-[10px] font-bold text-slate-400 block mb-1">タップエリア</label>
              <div v-for="(action, ai) in selectedNode.data.actions" :key="ai" class="border border-slate-200 rounded-lg p-2.5 mb-2 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-slate-500">エリア {{ ai + 1 }}</span>
                  <button v-if="selectedNode.data.actions.length > 1" @click="selectedNode.data.actions.splice(ai, 1)" class="text-red-400 text-[10px]">×</button>
                </div>
                <div class="grid grid-cols-4 gap-1">
                  <input type="number" v-model.number="action.x" class="border border-slate-200 rounded px-1 py-0.5 text-[9px] text-center" placeholder="X" />
                  <input type="number" v-model.number="action.y" class="border border-slate-200 rounded px-1 py-0.5 text-[9px] text-center" placeholder="Y" />
                  <input type="number" v-model.number="action.width" class="border border-slate-200 rounded px-1 py-0.5 text-[9px] text-center" placeholder="W" />
                  <input type="number" v-model.number="action.height" class="border border-slate-200 rounded px-1 py-0.5 text-[9px] text-center" placeholder="H" />
                </div>
                <div class="flex gap-1.5">
                  <select v-model="action.type" class="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white"><option value="uri">URL</option><option value="message">メッセージ</option></select>
                  <input v-model="action.value" class="flex-1 border border-slate-200 rounded px-2 py-0.5 text-[10px]" :placeholder="action.type === 'uri' ? 'https://...' : 'テキスト'" />
                </div>
                <input v-model="action.label" class="w-full border border-slate-200 rounded px-2 py-0.5 text-[10px]" placeholder="ラベル" />
              </div>
              <button @click="selectedNode.data.actions.push({ x:0,y:0,width:520,height:520,type:'uri',value:'',label:'' })" class="text-[10px] font-bold text-amber-600 hover:text-amber-800">+ エリア追加</button>
            </div>
          </template>

          <!-- Tag -->
          <template v-if="selectedNode.type === 'tag'">
            <div>
              <label class="text-[10px] font-bold text-slate-400 block mb-1">分岐条件</label>
              <p class="text-[9px] text-slate-400 mb-2">ユーザーの回答やタグに応じて分岐</p>
              <div v-for="(cond, ci) in selectedNode.data.conditions" :key="ci" class="border rounded-lg p-2.5 mb-2 space-y-1.5" :style="{ borderColor: ['#f43f5e','#f59e0b','#3b82f6','#8b5cf6','#10b981'][ci % 5] + '60' }">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: ['#f43f5e','#f59e0b','#3b82f6','#8b5cf6','#10b981'][ci % 5] }"></span>
                    <span class="text-[10px] font-bold text-slate-500">条件 {{ ci + 1 }}</span>
                  </div>
                  <button v-if="selectedNode.data.conditions.length > 1" @click="removeTagCondition(selectedNode, ci)" class="text-red-400 text-[10px]">×</button>
                </div>
                <input v-model="cond.match" class="w-full border border-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-rose-400" placeholder="マッチ条件（例: 回答A）" />
                <input v-model="cond.tag" class="w-full border border-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-rose-400" placeholder="付与タグ（例: 集客最大化タイプ）" />
              </div>
              <button @click="addTagCondition(selectedNode)" class="text-[10px] font-bold text-rose-600 hover:text-rose-800">+ 条件追加</button>
            </div>
          </template>

          <!-- CTA -->
          <template v-if="selectedNode.type === 'cta'">
            <div>
              <label class="text-[10px] font-bold text-slate-400 block mb-1">CTAラベル</label>
              <input v-model="selectedNode.data.label" class="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="例: 詳しく見る" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-slate-400 block mb-1">アクション</label>
              <select v-model="selectedNode.data.actionType" class="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white mb-2">
                <option value="uri">URL遷移</option>
                <option value="message">メッセージ送信</option>
                <option value="postback">ポストバック</option>
              </select>
              <input v-model="selectedNode.data.url" class="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20" :placeholder="selectedNode.data.actionType === 'uri' ? 'https://...' : 'アクション値'" />
            </div>
          </template>

          <!-- Connections from this node -->
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-1">接続先</label>
            <div v-for="(conn, ci) in connections.filter(c => c.from === selectedNode.id)" :key="ci" class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5 mb-1">
              <span class="text-[10px] text-slate-600 flex items-center gap-1">
                <span class="text-xs">{{ nodeTypeMeta(nodes.find(n => n.id === conn.to)?.type)?.icon }}</span>
                {{ nodeTypeMeta(nodes.find(n => n.id === conn.to)?.type)?.label }}
              </span>
              <button @click="removeConnection(connections.indexOf(conn))" class="text-red-400 hover:text-red-600 text-[10px]">×</button>
            </div>
            <p v-if="connections.filter(c => c.from === selectedNode.id).length === 0" class="text-[10px] text-slate-300">出力ポートからドラッグで接続</p>
          </div>
        </div>
      </template>

      <div v-else class="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div class="text-2xl mb-2">👆</div>
        <p class="text-[11px] text-slate-400">ノードを選択して<br/>設定を編集</p>
      </div>
    </aside>
  </div>
</template>
