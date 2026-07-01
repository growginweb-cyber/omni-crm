<script setup>
const props = defineProps({
  totalStats: Object,
  channelStats: Object,
  broadcastTasks: Array,
  customers: Array,
})

const channels = [
  { key: 'LINE', label: 'LINE', icon: '🟢', color: 'bg-emerald-500' },
  { key: 'Email', label: 'メール', icon: '🟦', color: 'bg-blue-500' },
  { key: 'SMS', label: 'SMS', icon: '💬', color: 'bg-violet-500' },
]

const totalChannelCount = () => {
  return Object.values(props.channelStats).reduce((a, b) => a + b, 0) || 1
}

const channelPercent = (key) => {
  const total = totalChannelCount()
  return Math.max(5, Math.round((props.channelStats[key] / total) * 100))
}

const segmentBreakdown = () => {
  const map = {}
  if (!props.customers) return []
  props.customers.forEach((c) => {
    const seg = c.segment || '未診断'
    map[seg] = (map[seg] || 0) + 1
  })
  return Object.entries(map).map(([name, count]) => ({ name, count }))
}

const recentBroadcasts = () => {
  if (!props.broadcastTasks) return []
  return props.broadcastTasks.slice(0, 5)
}

const statusClass = (status) => {
  if (status === '完了') return 'bg-emerald-50 text-emerald-700'
  if (status === '失敗' || status === '一部失敗') return 'bg-red-50 text-red-700'
  return 'bg-amber-50 text-amber-700'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="flex-1 p-6 lg:p-8 overflow-y-auto bg-slate-50/50">
    <div class="max-w-6xl mx-auto space-y-5">
      <div>
        <h2 class="text-lg font-bold text-slate-900 tracking-tight">ダッシュボード</h2>
        <p class="text-xs text-slate-400 mt-0.5">配信パフォーマンスの概要</p>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white p-4 rounded-[14px] border border-[#ebedf0]">
          <span class="text-[11.5px] font-medium text-slate-400">総送信数</span>
          <div class="text-[26px] font-semibold text-slate-900 mt-1.5 font-mono tabular-nums tracking-tight">{{ totalStats.sent }}<span class="text-xs text-slate-400 font-normal ml-1">通</span></div>
        </div>
        <div class="bg-white p-4 rounded-[14px] border border-[#ebedf0]">
          <span class="text-[11.5px] font-medium text-slate-400">到達率</span>
          <div class="text-[26px] font-semibold text-emerald-600 mt-1.5 font-mono tabular-nums tracking-tight">{{ totalStats.sent ? Math.round((totalStats.delivered / totalStats.sent) * 100) : 0 }}<span class="text-xs text-slate-400 font-normal ml-1">%</span></div>
        </div>
        <div class="bg-white p-4 rounded-[14px] border border-[#ebedf0]">
          <span class="text-[11.5px] font-medium text-slate-400">開封率</span>
          <div class="text-[26px] font-semibold text-indigo-600 mt-1.5 font-mono tabular-nums tracking-tight">{{ totalStats.delivered ? Math.round((totalStats.opened / totalStats.delivered) * 100) : 0 }}<span class="text-xs text-slate-400 font-normal ml-1">%</span></div>
        </div>
        <div class="bg-white p-4 rounded-[14px] border border-[#ebedf0]">
          <span class="text-[11.5px] font-medium text-slate-400">CTR</span>
          <div class="text-[26px] font-semibold text-blue-600 mt-1.5 font-mono tabular-nums tracking-tight">{{ totalStats.opened ? Math.round((totalStats.clicked / totalStats.opened) * 100) : 0 }}<span class="text-xs text-slate-400 font-normal ml-1">%</span></div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <!-- Channel breakdown -->
        <div class="lg:col-span-2 bg-white p-5 rounded-[14px] border border-[#ebedf0]">
          <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">チャネル別配信数</h3>
          <div class="space-y-4">
            <div v-for="ch in channels" :key="ch.key">
              <div class="flex justify-between text-xs mb-1.5 font-medium text-slate-700">
                <span class="flex items-center gap-1.5"><span>{{ ch.icon }}</span> {{ ch.label }}</span>
                <span class="font-mono text-slate-500 tabular-nums">{{ channelStats[ch.key] }}通</span>
              </div>
              <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div :class="[ch.color, 'h-full rounded-full transition-all duration-500']" :style="{ width: channelPercent(ch.key) + '%' }"></div>
              </div>
            </div>
          </div>
          <!-- Segment breakdown -->
          <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-6 mb-3">セグメント別顧客数</h3>
          <div class="grid grid-cols-2 gap-2">
            <div v-for="seg in segmentBreakdown()" :key="seg.name" class="bg-slate-50 rounded-lg p-3 text-center">
              <div class="text-lg font-black text-slate-900 tabular-nums">{{ seg.count }}</div>
              <div class="text-[9px] font-semibold text-slate-500 mt-0.5 truncate">{{ seg.name }}</div>
            </div>
          </div>
        </div>

        <!-- Recent broadcasts -->
        <div class="lg:col-span-3 bg-white p-5 rounded-[14px] border border-[#ebedf0]">
          <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">直近の配信</h3>
          <div v-if="recentBroadcasts().length === 0" class="flex flex-col items-center justify-center py-12 text-center">
            <div class="text-3xl mb-2">📭</div>
            <p class="text-xs text-slate-400">配信履歴はまだありません</p>
            <p class="text-[10px] text-slate-300 mt-1">「一斉配信」タブから配信を作成しましょう</p>
          </div>
          <div v-else class="space-y-0 divide-y divide-slate-100">
            <div v-for="task in recentBroadcasts()" :key="task.id" class="flex items-center justify-between py-3 first:pt-0">
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-slate-800 truncate">{{ task.title }}</div>
                <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                  <span class="font-semibold text-indigo-500">{{ task.delivery_channel || task.broadcast_templates?.delivery_channel }}</span>
                  <span>·</span>
                  <span>{{ task.broadcast_queues?.length || 0 }}名</span>
                  <span>·</span>
                  <span>{{ formatDate(task.scheduled_at || task.created_at) }}</span>
                </div>
              </div>
              <span :class="['px-2 py-0.5 rounded-md text-[9px] font-bold ml-3 shrink-0', statusClass(task.status)]">{{ task.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
