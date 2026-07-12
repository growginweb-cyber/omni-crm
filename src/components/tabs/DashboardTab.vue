<script setup>
import { computed } from 'vue'

const props = defineProps({
  totalStats: Object,
  channelStats: Object,
  broadcastTasks: Array,
  customers: Array,
})

const deliveryRate = () => {
  if (!props.totalStats?.sent) return 0
  return Math.round((props.totalStats.delivered / props.totalStats.sent) * 100)
}

const openRate = () => {
  if (!props.totalStats?.delivered) return 0
  return Math.round((props.totalStats.opened / props.totalStats.delivered) * 100)
}

const ctr = () => {
  if (!props.totalStats?.opened) return 0
  return Math.round((props.totalStats.clicked / props.totalStats.opened) * 100)
}

const recentBroadcasts = () => {
  if (!props.broadcastTasks) return []
  return props.broadcastTasks.slice(0, 5)
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin}分前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}時間前`
  return `${Math.floor(diffH / 24)}日前`
}

const channelChip = (ch) => {
  if (ch === 'LINE') return { label: 'L', bg: '#06C755' }
  if (ch === 'Email') return { label: 'M', bg: '#3B6EF5' }
  if (ch === 'SMS') return { label: 'S', bg: '#8B5CF6' }
  return { label: '?', bg: '#9097a1' }
}

const taskChannel = (task) => {
  return task?.delivery_channel || task?.broadcast_templates?.delivery_channel || 'LINE'
}

// KPI cards: friend count first (Lステップ/エルグラ style)
const kpiCards = computed(() => [
  {
    label: '友だち数',
    value: props.customers?.length ?? 0,
    unit: '人',
    icon: '👥',
    iconBg: '#eef2ff',
    valueColor: 'text-slate-900',
  },
  {
    label: '総送信数',
    value: props.totalStats?.sent ?? 0,
    unit: '通',
    icon: '📤',
    iconBg: '#f0f4ff',
    valueColor: 'text-slate-900',
  },
  {
    label: '到達率',
    value: deliveryRate(),
    unit: '%',
    icon: '✅',
    iconBg: '#e6f8ee',
    valueColor: 'text-emerald-600',
  },
  {
    label: '開封率',
    value: openRate(),
    unit: '%',
    icon: '👁️',
    iconBg: '#ececfd',
    valueColor: 'text-indigo-600',
  },
  {
    label: 'CTR',
    value: ctr(),
    unit: '%',
    icon: '🖱️',
    iconBg: '#e8efff',
    valueColor: 'text-blue-600',
  },
])

// 友だち成長グラフ（顧客の登録日を日次累積）
const friendGrowth = computed(() => {
  const list = props.customers || []
  if (list.length === 0) return { points: '', area: '', dots: [], labels: [] }
  const sorted = [...list]
    .filter(c => c.created_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  if (sorted.length === 0) return { points: '', area: '', dots: [], labels: [] }

  const days = 14
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    buckets.push(d)
  }
  const cumulative = buckets.map(bucketDate => {
    const cutoff = new Date(bucketDate)
    cutoff.setHours(23, 59, 59, 999)
    return sorted.filter(c => new Date(c.created_at) <= cutoff).length
  })

  const w = 600
  const h = 120
  const max = Math.max(...cumulative, 1)
  const min = Math.min(...cumulative)
  const range = Math.max(max - min, 1)
  const stepX = w / (days - 1)

  const dots = cumulative.map((v, i) => ({
    cx: Math.round(i * stepX),
    cy: Math.round(h - ((v - min) / range) * (h - 16) - 8),
    v,
    day: buckets[i].getMonth() + 1 + '/' + buckets[i].getDate(),
  }))
  const points = dots.map(p => `${p.cx},${p.cy}`).join(' ')
  const area = `0,${h} ${points} ${w},${h}`

  return { points, area, dots, w, h }
})

const channelDeliveries = computed(() => {
  const total = Object.values(props.channelStats || {}).reduce((a, b) => a + b, 0) || 1
  return [
    { key: 'LINE', label: 'LINE', color: '#06C755', count: props.channelStats?.LINE || 0 },
    { key: 'Email', label: 'メール', color: '#3B6EF5', count: props.channelStats?.Email || 0 },
    { key: 'SMS', label: 'SMS', color: '#8B5CF6', count: props.channelStats?.SMS || 0 },
  ].map(c => ({ ...c, pct: Math.round((c.count / total) * 100) }))
})

const segmentBreakdown = computed(() => {
  const map = {}
  ;(props.customers || []).forEach(c => {
    const seg = c.segment || '未診断'
    map[seg] = (map[seg] || 0) + 1
  })
  const colors = { '集客最大化タイプ': '#06914a', 'コスト削減タイプ': '#d97706', '未診断': '#9097a1' }
  return Object.entries(map).map(([name, count]) => ({ name, count, color: colors[name] || '#4f46e5' }))
})

// 選考パイプライン: 停滞している候補者（要フォロー）
const staleCandidates = computed(() => {
  return (props.customers || []).filter(c => {
    if (!c.pipeline_stage || c.pipeline_stage === '就業') return false
    const base = c.last_contacted_at || c.created_at
    if (!base) return false
    const days = (Date.now() - new Date(base).getTime()) / 86400000
    return days >= 3
  })
})

const avatarColor = (str) => {
  const colors = ['#4f46e5', '#06914a', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777']
  const code = (str || '').charCodeAt(0) || 0
  return colors[code % colors.length]
}

// Funnel
const funnelMax = () => props.totalStats?.sent || 1

const channelRow = (ch) => {
  if (ch === 'LINE') {
    return {
      label: 'LINE',
      count: props.channelStats?.LINE || 0,
      openRate: props.totalStats?.delivered ? Math.round((props.totalStats.opened / props.totalStats.delivered) * 100) + '%' : '—',
      ctr: props.totalStats?.opened ? Math.round((props.totalStats.clicked / props.totalStats.opened) * 100) + '%' : '—',
      cvr: '—',
    }
  }
  return {
    label: ch === 'Email' ? 'メール' : 'SMS',
    count: ch === 'Email' ? (props.channelStats?.Email || 0) : (props.channelStats?.SMS || 0),
    openRate: '—',
    ctr: '—',
    cvr: '—',
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-[#f7f8fb]">
    <!-- Sticky header -->
    <div class="sticky top-0 z-20 bg-[#f7f8fb]/90 backdrop-blur-sm border-b border-[#ebedf0] px-6 lg:px-7 py-3.5 flex items-center justify-between">
      <div>
        <h2 class="text-base font-bold text-slate-900 tracking-tight">ダッシュボード</h2>
        <p class="text-[11px] text-[#9097a1] mt-0.5">過去30日間のパフォーマンス概要</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="border border-[#e6e8ec] bg-white rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-[#f7f8fa] transition-colors shadow-[0_1px_2px_rgba(20,24,31,.04)]">期間: 30日</button>
        <button class="bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold hover:bg-indigo-700 transition-colors shadow-[0_1px_2px_rgba(79,70,229,.3)]">レポート出力</button>
      </div>
    </div>

    <div class="max-w-[1320px] mx-auto p-6 lg:p-7 space-y-4">
      <!-- KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div
          v-for="k in kpiCards"
          :key="k.label"
          class="bg-white rounded-[16px] p-[18px] shadow-[0_1px_3px_rgba(20,24,31,.06)] border border-[#f0f1f3] hover:shadow-[0_4px_16px_rgba(20,24,31,.08)] transition-shadow"
        >
          <div class="flex items-center justify-between mb-2.5">
            <span class="text-[11.5px] font-semibold text-[#7d8590]">{{ k.label }}</span>
            <div class="w-8 h-8 rounded-[10px] flex items-center justify-center text-[15px]" :style="{ background: k.iconBg }">{{ k.icon }}</div>
          </div>
          <div :class="['text-[27px] font-bold tracking-tight tabular-nums font-mono', k.valueColor]">
            {{ k.value }}<span class="text-xs text-slate-400 font-normal ml-1">{{ k.unit }}</span>
          </div>
        </div>
      </div>

      <!-- 要フォロー候補者アラート -->
      <div v-if="staleCandidates.length > 0" class="bg-white rounded-[16px] p-[16px] shadow-[0_1px_3px_rgba(20,24,31,.06)] border border-amber-200 flex items-center gap-3">
        <div class="w-9 h-9 rounded-[10px] bg-amber-50 flex items-center justify-center text-[16px] shrink-0">⚠️</div>
        <div class="flex-1 min-w-0">
          <div class="text-[12.5px] font-bold text-slate-800">{{ staleCandidates.length }}名の候補者が3日以上ステージ停滞中</div>
          <div class="text-[11px] text-[#9097a1] mt-0.5 truncate">{{ staleCandidates.slice(0, 3).map(c => c.name).join('、') }}{{ staleCandidates.length > 3 ? ' 他' : '' }} ・ 顧客管理のパイプラインビューで確認できます</div>
        </div>
      </div>

      <!-- 友だち成長グラフ -->
      <div class="bg-white rounded-[16px] p-[20px] shadow-[0_1px_3px_rgba(20,24,31,.06)] border border-[#f0f1f3]">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-[13px] font-bold text-slate-800">友だち数の推移</h3>
          <span class="text-[11px] text-[#9097a1]">直近14日間（累計）</span>
        </div>
        <div v-if="friendGrowth.dots && friendGrowth.dots.length > 0" class="mt-3">
          <svg :viewBox="`0 0 ${friendGrowth.w} ${friendGrowth.h}`" class="w-full h-[130px]" preserveAspectRatio="none">
            <defs>
              <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.18" />
                <stop offset="100%" stop-color="#4f46e5" stop-opacity="0" />
              </linearGradient>
            </defs>
            <polygon :points="friendGrowth.area" fill="url(#growthGradient)" />
            <polyline :points="friendGrowth.points" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
            <circle
              v-for="(p, i) in friendGrowth.dots"
              :key="i"
              :cx="p.cx"
              :cy="p.cy"
              r="3"
              fill="#fff"
              stroke="#4f46e5"
              stroke-width="2"
            />
          </svg>
          <div class="flex justify-between mt-1 px-0.5">
            <span
              v-for="(p, i) in friendGrowth.dots"
              :key="'label-' + i"
              v-show="i % 2 === 0"
              class="text-[9.5px] text-[#b0b6bf] font-mono"
            >{{ p.day }}</span>
          </div>
        </div>
        <div v-else class="h-[130px] flex items-center justify-center text-xs text-[#9097a1]">友だちデータがまだありません</div>
      </div>

      <!-- Middle row: channel breakdown + activity -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-3.5">
        <!-- Channel delivery breakdown (2 cols) -->
        <div class="lg:col-span-2 bg-white rounded-[16px] p-[20px] shadow-[0_1px_3px_rgba(20,24,31,.06)] border border-[#f0f1f3]">
          <h3 class="text-[13px] font-bold text-slate-800 mb-4">チャネル別配信比率</h3>
          <div class="space-y-4">
            <div v-for="c in channelDeliveries" :key="c.key">
              <div class="flex items-center justify-between text-xs mb-1.5">
                <span class="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span class="w-2 h-2 rounded-full" :style="{ background: c.color }"></span>
                  {{ c.label }}
                </span>
                <span class="font-mono text-slate-500 tabular-nums">{{ c.count }}通 ・ {{ c.pct }}%</span>
              </div>
              <div class="w-full bg-[#f1f2f4] h-2 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700" :style="{ width: c.pct + '%', background: c.color }"></div>
              </div>
            </div>
          </div>

          <div class="h-px bg-[#f0f1f3] my-5"></div>

          <h3 class="text-[13px] font-bold text-slate-800 mb-3">セグメント別友だち数</h3>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="s in segmentBreakdown"
              :key="s.name"
              class="flex items-center gap-1.5 bg-[#f7f8fa] rounded-full pl-2 pr-3 py-1.5 border border-[#f0f1f3]"
            >
              <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: s.color }"></span>
              <span class="text-[11px] font-medium text-slate-700">{{ s.name }}</span>
              <span class="text-[11px] font-mono font-bold text-slate-900">{{ s.count }}</span>
            </div>
            <div v-if="segmentBreakdown.length === 0" class="text-xs text-[#9097a1]">データがありません</div>
          </div>
        </div>

        <!-- Recent activity (3 cols) -->
        <div class="lg:col-span-3 bg-white rounded-[16px] p-[20px] shadow-[0_1px_3px_rgba(20,24,31,.06)] border border-[#f0f1f3] flex flex-col">
          <h3 class="text-[13px] font-bold text-slate-800 mb-3">最近のアクティビティ</h3>
          <div v-if="recentBroadcasts().length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <div class="text-2xl mb-2">📭</div>
            <p class="text-xs text-slate-400">配信履歴はまだありません</p>
          </div>
          <div v-else class="divide-y divide-[#f4f5f6]">
            <div v-for="task in recentBroadcasts()" :key="task.id" class="py-3 flex items-start gap-3 hover:bg-[#f7f8fa] transition-colors -mx-2 px-2 rounded-[10px]">
              <div
                class="w-8 h-8 rounded-[9px] flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-[0_1px_2px_rgba(0,0,0,.15)]"
                :style="{ background: channelChip(taskChannel(task)).bg }"
              >{{ channelChip(taskChannel(task)).label }}</div>
              <div class="min-w-0 flex-1">
                <div class="text-[12px] font-semibold text-slate-800 truncate">{{ task.title }} <span class="font-normal text-slate-500">を配信しました</span></div>
                <div class="text-[10.5px] mt-0.5 text-[#b0b6bf]">{{ formatTime(task.scheduled_at || task.created_at) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom row: funnel + CV table -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-3.5">
        <!-- Funnel (2 cols) -->
        <div class="lg:col-span-2 bg-white rounded-[16px] p-[20px] shadow-[0_1px_3px_rgba(20,24,31,.06)] border border-[#f0f1f3]">
          <h3 class="text-[13px] font-bold text-slate-800 mb-4">配信→CV ファネル</h3>
          <div class="space-y-3.5">
            <div v-for="(row, i) in [
              { label: '送信', value: totalStats?.sent ?? 0, color: '#4f46e5' },
              { label: '到達', value: totalStats?.delivered ?? 0, color: '#06C755' },
              { label: '開封', value: totalStats?.opened ?? 0, color: '#3B6EF5' },
              { label: 'クリック', value: totalStats?.clicked ?? 0, color: '#8B5CF6' },
              { label: 'CV', value: 0, color: '#f59e0b' },
            ]" :key="i">
              <div class="flex items-center gap-3">
                <div class="text-[11px] font-medium text-slate-500 w-12 shrink-0">{{ row.label }}</div>
                <div class="flex-1 bg-[#f1f2f4] rounded-full h-2.5 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-700"
                    :style="{
                      width: funnelMax() > 0 ? Math.max(2, Math.round((row.value / funnelMax()) * 100)) + '%' : '2%',
                      background: row.color,
                    }"
                  ></div>
                </div>
                <div class="text-[11px] font-mono font-semibold text-slate-700 tabular-nums w-10 text-right">{{ row.value }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- CV table (3 cols) -->
        <div class="lg:col-span-3 bg-white rounded-[16px] p-[20px] shadow-[0_1px_3px_rgba(20,24,31,.06)] border border-[#f0f1f3]">
          <h3 class="text-[13px] font-bold text-slate-800 mb-4">チャネル別 CV指標</h3>
          <!-- Header -->
          <div class="grid grid-cols-5 gap-2 text-[9.5px] font-bold text-[#9097a1] uppercase tracking-wider pb-2 border-b border-[#f0f1f3]">
            <div>CH</div>
            <div class="text-right">配信数</div>
            <div class="text-right">開封率</div>
            <div class="text-right">CTR</div>
            <div class="text-right">CVR</div>
          </div>
          <!-- Rows -->
          <div v-for="ch in ['LINE', 'Email', 'SMS']" :key="ch" class="grid grid-cols-5 gap-2 py-2.5 border-b border-[#f4f5f6] last:border-0 hover:bg-[#f7f8fa] -mx-2 px-2 rounded-[10px] transition-colors items-center">
            <div class="flex items-center gap-1.5">
              <!-- Shape: LINE=square, Email=diamond, SMS=circle -->
              <div v-if="ch === 'LINE'" class="w-2 h-2 rounded-[2px]" style="background:#06C755"></div>
              <div v-else-if="ch === 'Email'" class="w-2 h-2 rotate-45" style="background:#3B6EF5;width:8px;height:8px;"></div>
              <div v-else class="w-2 h-2 rounded-full" style="background:#8B5CF6"></div>
              <span class="text-[11px] font-medium text-slate-700">{{ ch === 'Email' ? 'メール' : ch }}</span>
            </div>
            <div class="text-right font-mono text-[11px] text-slate-700 tabular-nums">{{ channelRow(ch).count }}</div>
            <div class="text-right font-mono text-[11px] text-slate-700 tabular-nums">{{ channelRow(ch).openRate }}</div>
            <div class="text-right font-mono text-[11px] text-slate-700 tabular-nums">{{ channelRow(ch).ctr }}</div>
            <div class="text-right font-mono text-[11px] font-semibold text-emerald-600 tabular-nums">{{ channelRow(ch).cvr }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
