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

const NODE_W = 210

const nodeTypes = [
  { type: 'trigger', label: '友だち追加', icon: '🎯', color: '#06914a' },
  { type: 'text', label: 'テキスト', icon: '📝', color: '#4f46e5' },
  { type: 'flex', label: 'フレックス', icon: '🎴', color: '#8B5CF6' },
  { type: 'imagemap', label: 'イメージマップ', icon: '🗺', color: '#d97706' },
  { type: 'tag', label: 'タグ分岐', icon: '🏷', color: '#E0533D' },
  { type: 'cta', label: 'CTA', icon: '🔗', color: '#2954d4' },
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
const nodeColor = (id) => nodeTypeMeta(nodes.value.find(n => n.id === id)?.type).color

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
  <div class="flex-1 flex flex-col overflow-hidden bg-[#fbfbfc]">
    <!-- Page header -->
    <div class="border-b border-[#ebedf0] bg-[#fbfbfc] px-7 py-[18px] shrink-0">
      <h1 class="text-[18px] font-semibold text-[#14181f]">診断設計</h1>
      <p class="text-[12px] text-[#9097a1] mt-0.5">友だち追加時に起動。ノードをつないで診断フローを設計</p>
    </div>

    <!-- Campaign tabs / toolbar -->
    <div class="flex items-center justify-between px-[18px] py-[9px] border-b border-[#ebedf0] bg-white flex-wrap gap-2 shrink-0">
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          v-for="cp in surveyCampaigns"
          :key="cp.id"
          @click="$emit('selectCampaign', cp.id)"
          :class="[
            'flex items-center gap-1.5 border rounded-[8px] px-2.5 py-[5px] text-[12px] cursor-pointer transition-colors',
            selectedCampaignId === cp.id
              ? 'border-[#4f46e5] text-[#4f46e5] bg-[#ececfd]'
              : 'border-[#e6e8ec] text-[#3a3f47] bg-white hover:bg-[#f1f2f4]',
          ]"
        >
          <span class="w-[6px] h-[6px] rounded-full shrink-0" :style="{ backgroundColor: cp.is_active ? '#06914a' : '#b0b6bf' }"></span>
          <span class="font-medium truncate max-w-[140px]">{{ cp.title }}</span>
        </button>
        <input
          :value="newCampaignTitle"
          @input="$emit('update:newCampaignTitle', $event.target.value)"
          class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-[5px] text-[12px] w-36 placeholder-[#9097a1] focus:outline-none focus:border-[#4f46e5]"
          placeholder="新しい診断名..."
        />
        <button @click="$emit('createCampaign')" class="flex items-center gap-1 border border-dashed border-[#d6d9de] rounded-[8px] px-2.5 py-[5px] text-[12px] text-[#9097a1] hover:text-[#4f46e5] hover:border-[#4f46e5] transition-colors">＋新規</button>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          v-for="nt in nodeTypes.filter(t => t.type !== 'trigger')"
          :key="nt.type"
          @click="addNode(nt.type)"
          class="bg-white border border-[#e6e8ec] rounded-[8px] px-3 py-1.5 text-[12px] text-[#3a3f47] hover:bg-[#f1f2f4] transition-colors"
        >
          ＋{{ nt.label }}
        </button>
        <button
          v-if="selectedCampaign"
          @click="$emit('toggleActiveCampaign')"
          class="bg-[#4f46e5] rounded-[9px] px-3.5 py-[7px] text-[12.5px] text-white font-medium hover:brightness-110 transition"
        >
          {{ selectedCampaign.is_active ? '公開中' : '有効化' }}
        </button>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Center: Flow canvas -->
      <div ref="canvasRef" class="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing bg-[#f6f7f9]" style="background-image:radial-gradient(#dfe2e7 1px,transparent 1px);background-size:22px 22px">
        <!-- Legend -->
        <div class="absolute left-4 top-3.5 z-10 flex gap-3.5 bg-white/90 border border-[#ebedf0] rounded-[10px] px-3.5 py-2 shadow-sm text-[11px] text-[#3a3f47]">
          <span v-for="nt in nodeTypes" :key="nt.type" class="flex items-center gap-1.5">
            <span class="w-[11px] h-[11px] rounded-[3px] inline-block" :style="{ backgroundColor: nt.color }"></span>
            {{ nt.label }}
          </span>
        </div>

        <svg class="absolute top-0 left-0 pointer-events-none" style="width:3000px;height:2000px">
          <path v-for="(conn, ci) in connections" :key="ci" :d="getPath(conn)" fill="none" :stroke="nodeColor(conn.from)" stroke-width="2" opacity="0.55" />
          <path v-if="tempPath" :d="tempPath" fill="none" stroke="#4f46e5" stroke-width="2" stroke-dasharray="6 3" opacity="0.55" />
        </svg>

        <div v-for="node in nodes" :key="node.id" class="absolute select-none" :style="{ left: node.x + 'px', top: node.y + 'px', width: NODE_W + 'px' }" @mousedown="startDrag(node, $event)">
          <!-- Input port -->
          <div v-if="node.type !== 'trigger'" class="port absolute -top-[6px] left-1/2 -translate-x-1/2 w-[11px] h-[11px] rounded-full bg-white border-2 hover:scale-125 cursor-crosshair z-20 transition-all" :style="{ borderColor: nodeTypeMeta(node.type).color }" :data-input-port="node.id"></div>

          <!-- Node card -->
          <div :class="['bg-white rounded-[12px] border border-[#e3e5e9] shadow-[0_2px_10px_-4px_rgba(20,24,31,.12)] cursor-move transition-all', selectedNodeId === node.id ? 'ring-2 ring-[#4f46e5]/40' : 'hover:shadow-[0_4px_14px_-4px_rgba(20,24,31,.18)]']" @click.stop="selectedNodeId = node.id">
            <div class="flex items-center gap-1.5 px-3 py-[7px] rounded-t-[12px] text-white text-[11px] font-semibold" :style="{ backgroundColor: nodeTypeMeta(node.type).color }">
              <span>{{ nodeTypeMeta(node.type).icon }}</span>
              <span class="flex-1 truncate">{{ nodeTypeMeta(node.type).label }}</span>
              <span class="opacity-70 cursor-grab">⠿</span>
            </div>
            <div class="px-3 py-2.5">
              <p class="text-[12.5px] font-semibold text-[#14181f] truncate">
                {{ node.type === 'trigger' ? node.data.label : node.type === 'text' ? (node.data.message || '未設定') : node.type === 'flex' ? (node.data.templateName || 'テンプレート未選択') : node.type === 'imagemap' ? (node.data.baseUrl ? '画像設定済み' : '未設定') : node.type === 'tag' ? (node.data.conditions?.length || 0) + '条件' : node.type === 'cta' ? (node.data.label || '未設定') : '' }}
              </p>
              <!-- Tag condition rows -->
              <div v-if="node.type === 'tag' && node.data.conditions" class="mt-1.5 space-y-1">
                <div v-for="(cond, ci) in node.data.conditions" :key="ci" class="flex items-center gap-1.5 bg-[#f7f8fa] border border-[#eef0f2] rounded-[7px] px-2 py-[5px] text-[11.5px] text-[#3a3f47]">
                  <span class="w-[7px] h-[7px] rounded-full shrink-0" :style="{ backgroundColor: ['#E0533D','#d97706','#2954d4','#8B5CF6','#06914a'][ci % 5] }"></span>
                  <span class="truncate">{{ cond.tag || '条件' + (ci + 1) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Output ports -->
          <template v-if="node.type === 'tag' && node.data.conditions?.length > 1">
            <div v-for="(_, pi) in node.data.conditions" :key="'op'+pi" class="port absolute -bottom-[6px] w-[11px] h-[11px] rounded-full bg-white border-2 hover:scale-125 cursor-crosshair z-20 transition-all" :style="{ left: (NODE_W / (node.data.conditions.length + 1) * (pi + 1) - 6) + 'px', borderColor: ['#E0533D','#d97706','#2954d4','#8B5CF6','#06914a'][pi % 5] }" @mousedown="startConnect(node.id, pi, $event)"></div>
          </template>
          <div v-else class="port absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-[11px] h-[11px] rounded-full bg-white border-2 hover:scale-125 cursor-crosshair z-20 transition-all" :style="{ borderColor: nodeTypeMeta(node.type).color }" @mousedown="startConnect(node.id, 0, $event)"></div>
        </div>

        <!-- QR code button -->
        <button @click="showQrModal = true" class="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-white border border-[#e6e8ec] rounded-[8px] px-3 py-1.5 text-[12px] text-[#3a3f47] hover:bg-[#f1f2f4] shadow-sm transition-colors">
          <span class="text-sm">📱</span> LINEプレビュー
        </button>

        <!-- QR modal -->
        <div v-if="showQrModal" class="absolute inset-0 z-30 flex items-center justify-center bg-black/30" @click.self="showQrModal = false">
          <div class="bg-white border border-[#ebedf0] rounded-[13px] shadow-2xl p-[18px] w-80 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-[#14181f]">LINE実機プレビュー</h3>
              <button @click="showQrModal = false" class="text-[#9097a1] hover:text-[#3a3f47] text-lg">×</button>
            </div>
            <div>
              <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">LINE Bot URL / LIFF URL</label>
              <input v-model="qrUrl" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] focus:outline-none focus:border-[#4f46e5]" placeholder="https://line.me/R/ti/p/@xxxxx" />
            </div>
            <div v-if="qrImageUrl" class="flex flex-col items-center">
              <img :src="qrImageUrl" class="w-48 h-48 rounded-[9px] border border-[#ebedf0]" alt="QR Code" />
              <p class="text-[10px] text-[#9097a1] mt-2">LINEアプリでスキャンしてテスト</p>
            </div>
            <div v-else class="flex flex-col items-center py-6">
              <span class="text-3xl mb-2">📷</span>
              <p class="text-[10px] text-[#9097a1]">URLを入力するとQRコードが生成されます</p>
            </div>
          </div>
        </div>

        <!-- Empty hint -->
        <div v-if="nodes.length <= 1" class="absolute top-32 left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <p class="text-xs text-[#9097a1]">上部のボタンからノードを追加してフローを設計</p>
          <p class="text-[10px] text-[#b0b6bf] mt-1">出力ポート(下)から入力ポート(上)へドラッグで接続</p>
        </div>
      </div>

      <!-- Right: Node properties -->
      <aside class="w-72 bg-white border-l border-[#ebedf0] overflow-y-auto shrink-0 flex flex-col">
        <div class="px-4 py-3 border-b border-[#ebedf0] flex items-center justify-between">
          <h3 class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">ノード設定</h3>
          <button v-if="selectedNode && selectedNode.type !== 'trigger'" @click="removeNode(selectedNode.id)" class="text-[10px] text-red-400 hover:text-red-600 font-semibold">削除</button>
        </div>

        <template v-if="selectedNode">
          <div class="p-4 space-y-4 flex-1">
            <div class="rounded-[13px] p-3 text-center border border-[#ebedf0]" :style="{ backgroundColor: nodeTypeMeta(selectedNode.type).color + '14' }">
              <span class="text-xl">{{ nodeTypeMeta(selectedNode.type).icon }}</span>
              <div class="text-xs font-semibold mt-1" :style="{ color: nodeTypeMeta(selectedNode.type).color }">{{ nodeTypeMeta(selectedNode.type).label }}</div>
            </div>

            <!-- Trigger -->
            <template v-if="selectedNode.type === 'trigger'">
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">トリガーラベル</label>
                <input v-model="selectedNode.data.label" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] focus:outline-none focus:border-[#4f46e5]" />
              </div>
            </template>

            <!-- Text -->
            <template v-if="selectedNode.type === 'text'">
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">メッセージ</label>
                <textarea v-model="selectedNode.data.message" rows="4" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] resize-none focus:outline-none focus:border-[#4f46e5]" placeholder="テキストメッセージを入力..."></textarea>
              </div>
            </template>

            <!-- Flex -->
            <template v-if="selectedNode.type === 'flex'">
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">Flexテンプレート選択</label>
                <p class="text-[9px] text-[#9097a1] mb-2">コンテンツ作成 → LINE → フレックスで事前に作成・保存したテンプレートを選択</p>
                <select @change="selectFlexTemplate(selectedNode, $event.target.value)" :value="selectedNode.data.templateId || ''" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] focus:outline-none focus:border-[#4f46e5]">
                  <option value="" disabled>テンプレートを選択...</option>
                  <option v-for="t in flexTemplates" :key="t.id" :value="t.id">{{ t.title }}</option>
                </select>
              </div>
              <div v-if="selectedNode.data.templateId" class="bg-[#f0ebff] border border-[#ebedf0] rounded-[13px] p-3">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs">🎴</span>
                  <span class="text-[11px] font-semibold text-[#6d40d4]">{{ selectedNode.data.templateName }}</span>
                </div>
                <p class="text-[9px] text-[#8B5CF6]">テンプレートが適用されています</p>
                <button @click="selectedNode.data.templateId = null; selectedNode.data.templateName = ''" class="text-[9px] text-red-400 hover:text-red-600 mt-1">選択解除</button>
              </div>
              <div v-if="flexTemplates.length === 0" class="bg-amber-50 border border-[#ebedf0] rounded-[13px] p-3">
                <p class="text-[10px] text-amber-700 font-semibold">テンプレートがありません</p>
                <p class="text-[9px] text-amber-600 mt-0.5">コンテンツ作成 → LINE → フレックスタブで作成してください</p>
              </div>
            </template>

            <!-- ImageMap -->
            <template v-if="selectedNode.type === 'imagemap'">
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">ベース画像URL</label>
                <input v-model="selectedNode.data.baseUrl" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] focus:outline-none focus:border-[#4f46e5]" placeholder="画像URL（幅1040px推奨）" />
                <div v-if="selectedNode.data.baseUrl" class="mt-2 rounded-[9px] overflow-hidden border border-[#ebedf0]"><img :src="selectedNode.data.baseUrl" class="w-full" @error="$event.target.style.display='none'" /></div>
              </div>
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">LINE画像サイズ</label>
                <select @change="applyImageSize(selectedNode, lineImageSizes[$event.target.selectedIndex - 1])" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] mb-2 focus:outline-none focus:border-[#4f46e5]">
                  <option disabled selected>プリセットから選択...</option>
                  <option v-for="s in lineImageSizes" :key="s.label">{{ s.label }}</option>
                </select>
                <div class="flex gap-2">
                  <label class="text-[10px] text-[#9097a1] flex-1">幅 <input type="number" v-model.number="selectedNode.data.baseWidth" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] mt-0.5" /></label>
                  <label class="text-[10px] text-[#9097a1] flex-1">高さ <input type="number" v-model.number="selectedNode.data.baseHeight" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] mt-0.5" /></label>
                </div>
              </div>
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">タップエリア</label>
                <div v-for="(action, ai) in selectedNode.data.actions" :key="ai" class="border border-[#ebedf0] rounded-[9px] p-2.5 mb-2 space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-semibold text-[#6b7280]">エリア {{ ai + 1 }}</span>
                    <button v-if="selectedNode.data.actions.length > 1" @click="selectedNode.data.actions.splice(ai, 1)" class="text-red-400 text-[10px]">×</button>
                  </div>
                  <div class="grid grid-cols-4 gap-1">
                    <input type="number" v-model.number="action.x" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 text-[9px] text-center" placeholder="X" />
                    <input type="number" v-model.number="action.y" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 text-[9px] text-center" placeholder="Y" />
                    <input type="number" v-model.number="action.width" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 text-[9px] text-center" placeholder="W" />
                    <input type="number" v-model.number="action.height" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1 py-0.5 text-[9px] text-center" placeholder="H" />
                  </div>
                  <div class="flex gap-1.5">
                    <select v-model="action.type" class="text-[10px] bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-1.5 py-0.5"><option value="uri">URL</option><option value="message">メッセージ</option></select>
                    <input v-model="action.value" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-0.5 text-[10px]" :placeholder="action.type === 'uri' ? 'https://...' : 'テキスト'" />
                  </div>
                  <input v-model="action.label" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-0.5 text-[10px]" placeholder="ラベル" />
                </div>
                <button @click="selectedNode.data.actions.push({ x:0,y:0,width:520,height:520,type:'uri',value:'',label:'' })" class="text-[10px] font-semibold text-[#4f46e5] hover:brightness-110">+ エリア追加</button>
              </div>
            </template>

            <!-- Tag -->
            <template v-if="selectedNode.type === 'tag'">
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">分岐条件</label>
                <p class="text-[9px] text-[#9097a1] mb-2">ユーザーの回答やタグに応じて分岐</p>
                <div v-for="(cond, ci) in selectedNode.data.conditions" :key="ci" class="border rounded-[9px] p-2.5 mb-2 space-y-1.5" :style="{ borderColor: ['#E0533D','#d97706','#2954d4','#8B5CF6','#06914a'][ci % 5] + '60' }">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: ['#E0533D','#d97706','#2954d4','#8B5CF6','#06914a'][ci % 5] }"></span>
                      <span class="text-[10px] font-semibold text-[#6b7280]">条件 {{ ci + 1 }}</span>
                    </div>
                    <button v-if="selectedNode.data.conditions.length > 1" @click="removeTagCondition(selectedNode, ci)" class="text-red-400 text-[10px]">×</button>
                  </div>
                  <input v-model="cond.match" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] focus:outline-none focus:border-[#4f46e5]" placeholder="マッチ条件（例: 回答A）" />
                  <input v-model="cond.tag" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[7px] px-2 py-1 text-[10px] focus:outline-none focus:border-[#4f46e5]" placeholder="付与タグ（例: 集客最大化タイプ）" />
                </div>
                <button @click="addTagCondition(selectedNode)" class="text-[10px] font-semibold text-[#E0533D] hover:brightness-110">+ 条件追加</button>
              </div>
            </template>

            <!-- CTA -->
            <template v-if="selectedNode.type === 'cta'">
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">CTAラベル</label>
                <input v-model="selectedNode.data.label" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] focus:outline-none focus:border-[#4f46e5]" placeholder="例: 詳しく見る" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">アクション</label>
                <select v-model="selectedNode.data.actionType" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] mb-2 focus:outline-none focus:border-[#4f46e5]">
                  <option value="uri">URL遷移</option>
                  <option value="message">メッセージ送信</option>
                  <option value="postback">ポストバック</option>
                </select>
                <input v-model="selectedNode.data.url" class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] focus:outline-none focus:border-[#4f46e5]" :placeholder="selectedNode.data.actionType === 'uri' ? 'https://...' : 'アクション値'" />
              </div>
            </template>

            <!-- Connections from this node -->
            <div>
              <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1">接続先</label>
              <div v-for="(conn, ci) in connections.filter(c => c.from === selectedNode.id)" :key="ci" class="flex items-center justify-between bg-[#f7f8fa] border border-[#eef0f2] rounded-[7px] px-3 py-1.5 mb-1">
                <span class="text-[10px] text-[#3a3f47] flex items-center gap-1">
                  <span class="text-xs">{{ nodeTypeMeta(nodes.find(n => n.id === conn.to)?.type)?.icon }}</span>
                  {{ nodeTypeMeta(nodes.find(n => n.id === conn.to)?.type)?.label }}
                </span>
                <button @click="removeConnection(connections.indexOf(conn))" class="text-red-400 hover:text-red-600 text-[10px]">×</button>
              </div>
              <p v-if="connections.filter(c => c.from === selectedNode.id).length === 0" class="text-[10px] text-[#b0b6bf]">出力ポートからドラッグで接続</p>
            </div>
          </div>
        </template>

        <div v-else class="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div class="text-2xl mb-2">👆</div>
          <p class="text-[11px] text-[#9097a1]">ノードを選択して<br/>設定を編集</p>
        </div>
      </aside>
    </div>
  </div>
</template>
