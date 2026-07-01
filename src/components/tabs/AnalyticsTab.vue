<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'

const props = defineProps({
  broadcastTasks: Array,
  customers: Array,
  currentTenantId: String,
})

const trackingEvents = ref([])
const period = ref('7d')
const loading = ref(false)

const fetchTrackingEvents = async () => {
  if (!props.currentTenantId) return
  loading.value = true
  const daysMap = { '7d': 7, '30d': 30, '90d': 90 }
  const days = daysMap[period.value] || 7
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data } = await supabase
    .from('tracking_events')
    .select('*')
    .eq('tenant_id', props.currentTenantId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000)
  trackingEvents.value = data || []
  loading.value = false
}

onMounted(fetchTrackingEvents)

const totalSent = computed(() => {
  if (!props.broadcastTasks) return 0
  return props.broadcastTasks.reduce((a, t) => a + (t.sent_count || 0), 0)
})
const totalDelivered = computed(() => {
  if (!props.broadcastTasks) return 0
  return props.broadcastTasks.reduce((a, t) => a + (t.delivered_count || 0), 0)
})
const totalOpened = computed(() => {
  if (!props.broadcastTasks) return 0
  return props.broadcastTasks.reduce((a, t) => a + (t.opened_count || 0), 0)
})
const totalClicked = computed(() => {
  if (!props.broadcastTasks) return 0
  return props.broadcastTasks.reduce((a, t) => a + (t.clicked_count || 0), 0)
})

const deliveryRate = computed(() => totalSent.value ? Math.round((totalDelivered.value / totalSent.value) * 100) : 0)
const openRate = computed(() => totalDelivered.value ? Math.round((totalOpened.value / totalDelivered.value) * 100) : 0)
const clickRate = computed(() => totalOpened.value ? Math.round((totalClicked.value / totalOpened.value) * 100) : 0)

const funnelSteps = computed(() => [
  { label: '送信', value: totalSent.value, rate: 100, color: 'bg-slate-400' },
  { label: '到達', value: totalDelivered.value, rate: deliveryRate.value, color: 'bg-blue-500' },
  { label: '開封', value: totalOpened.value, rate: openRate.value, color: 'bg-indigo-500' },
  { label: 'クリック', value: totalClicked.value, rate: clickRate.value, color: 'bg-emerald-500' },
])

const channelBreakdown = computed(() => {
  const channels = ['LINE', 'Email', 'SMS']
  return channels.map(ch => {
    const tasks = (props.broadcastTasks || []).filter(t => {
      const c = t.delivery_channel || t.broadcast_templates?.delivery_channel
      return c === ch
    })
    const sent = tasks.reduce((a, t) => a + (t.sent_count || 0), 0)
    const delivered = tasks.reduce((a, t) => a + (t.delivered_count || 0), 0)
    const opened = tasks.reduce((a, t) => a + (t.opened_count || 0), 0)
    const clicked = tasks.reduce((a, t) => a + (t.clicked_count || 0), 0)
    return { channel: ch, sent, delivered, opened, clicked, campaigns: tasks.length }
  })
})

const channelMeta = {
  LINE: { icon: '🟢', color: 'emerald' },
  Email: { icon: '📧', color: 'blue' },
  SMS: { icon: '💬', color: 'violet' },
}

const campaignPerformance = computed(() => {
  if (!props.broadcastTasks) return []
  return props.broadcastTasks
    .filter(t => t.status === '完了' || t.status === '一部失敗')
    .slice(0, 10)
    .map(t => ({
      ...t,
      channel: t.delivery_channel || t.broadcast_templates?.delivery_channel,
      openRate: t.delivered_count ? Math.round((t.opened_count / t.delivered_count) * 100) : 0,
      clickRate: t.opened_count ? Math.round((t.clicked_count / t.opened_count) * 100) : 0,
    }))
})

const recentEvents = computed(() => trackingEvents.value.slice(0, 20))

const dailyEvents = computed(() => {
  const map = {}
  trackingEvents.value.forEach(e => {
    const day = e.created_at.substring(0, 10)
    if (!map[day]) map[day] = { opens: 0, clicks: 0 }
    if (e.event_type === 'open') map[day].opens++
    else map[day].clicks++
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date: date.substring(5), ...counts }))
})

const maxDailyValue = computed(() => {
  if (dailyEvents.value.length === 0) return 1
  return Math.max(...dailyEvents.value.map(d => Math.max(d.opens, d.clicks)), 1)
})

const segmentEngagement = computed(() => {
  if (!props.customers) return []
  const segMap = {}
  props.customers.forEach(c => {
    const seg = c.segment || '未診断'
    if (!segMap[seg]) segMap[seg] = { count: 0 }
    segMap[seg].count++
  })
  return Object.entries(segMap).map(([name, data]) => ({
    name,
    count: data.count,
    pct: props.customers.length ? Math.round((data.count / props.customers.length) * 100) : 0,
  }))
})

const segmentColor = (name) => {
  if (name === '集客最大化タイプ') return 'bg-emerald-500'
  if (name === 'コスト削減タイプ') return 'bg-amber-500'
  if (name === '未診断') return 'bg-slate-300'
  return 'bg-indigo-500'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

const changePeriod = (p) => {
  period.value = p
  fetchTrackingEvents()
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
    <div class="max-w-7xl mx-auto space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-slate-900">MAアナリティクス</h2>
          <p class="text-[10px] text-slate-400 mt-0.5">配信パフォーマンスとエンゲージメント分析</p>
        </div>
        <div class="flex bg-slate-100 p-0.5 rounded-lg">
          <button
            v-for="p in [{ id: '7d', label: '7日' }, { id: '30d', label: '30日' }, { id: '90d', label: '90日' }]"
            :key="p.id"
            @click="changePeriod(p.id)"
            :class="['px-3 py-1 text-[10px] font-bold rounded-md transition-all', period === p.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600']"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <!-- Funnel -->
      <div class="bg-white rounded-[14px] border border-[#ebedf0] p-5">
        <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">コンバージョンファネル</h3>
        <div class="flex items-end gap-1 justify-between">
          <div v-for="(step, i) in funnelSteps" :key="step.label" class="flex-1 flex flex-col items-center">
            <div class="text-xl font-black text-slate-900 tabular-nums mb-1">{{ step.value.toLocaleString() }}</div>
            <div class="text-[9px] font-bold text-slate-400 mb-2">{{ step.label }}</div>
            <div class="w-full rounded-t-lg relative overflow-hidden" :style="{ height: Math.max(20, step.rate * 1.5) + 'px' }">
              <div :class="[step.color, 'absolute inset-0 rounded-t-lg transition-all duration-700']"></div>
            </div>
            <div class="text-[10px] font-bold mt-1.5 tabular-nums" :class="i === 0 ? 'text-slate-400' : step.rate >= 50 ? 'text-emerald-600' : step.rate >= 20 ? 'text-amber-600' : 'text-red-500'">
              {{ i === 0 ? '' : step.rate + '%' }}
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Channel comparison -->
        <div class="lg:col-span-2 bg-white rounded-[14px] border border-[#ebedf0] p-5">
          <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">チャネル別パフォーマンス</h3>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th class="pb-2.5">チャネル</th>
                  <th class="pb-2.5 text-right">配信数</th>
                  <th class="pb-2.5 text-right">送信</th>
                  <th class="pb-2.5 text-right">到達</th>
                  <th class="pb-2.5 text-right">開封</th>
                  <th class="pb-2.5 text-right">クリック</th>
                  <th class="pb-2.5 text-right">開封率</th>
                  <th class="pb-2.5 text-right">CTR</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="ch in channelBreakdown" :key="ch.channel" class="text-xs">
                  <td class="py-2.5">
                    <span class="font-bold text-slate-800">{{ channelMeta[ch.channel]?.icon }} {{ ch.channel }}</span>
                  </td>
                  <td class="py-2.5 text-right text-slate-500 tabular-nums">{{ ch.campaigns }}</td>
                  <td class="py-2.5 text-right font-mono tabular-nums text-slate-700">{{ ch.sent }}</td>
                  <td class="py-2.5 text-right font-mono tabular-nums text-slate-700">{{ ch.delivered }}</td>
                  <td class="py-2.5 text-right font-mono tabular-nums text-slate-700">{{ ch.opened }}</td>
                  <td class="py-2.5 text-right font-mono tabular-nums text-slate-700">{{ ch.clicked }}</td>
                  <td class="py-2.5 text-right">
                    <span :class="['font-bold tabular-nums', ch.delivered ? (ch.opened / ch.delivered >= 0.3 ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-300']">
                      {{ ch.delivered ? Math.round((ch.opened / ch.delivered) * 100) : 0 }}%
                    </span>
                  </td>
                  <td class="py-2.5 text-right">
                    <span :class="['font-bold tabular-nums', ch.opened ? (ch.clicked / ch.opened >= 0.1 ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-300']">
                      {{ ch.opened ? Math.round((ch.clicked / ch.opened) * 100) : 0 }}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Segment distribution -->
        <div class="bg-white rounded-[14px] border border-[#ebedf0] p-5">
          <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">セグメント分布</h3>
          <div class="space-y-3">
            <div v-for="seg in segmentEngagement" :key="seg.name">
              <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-semibold text-slate-700">{{ seg.name }}</span>
                <span class="font-mono text-slate-400 tabular-nums">{{ seg.count }}名 ({{ seg.pct }}%)</span>
              </div>
              <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div :class="[segmentColor(seg.name), 'h-full rounded-full transition-all duration-500']" :style="{ width: seg.pct + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <!-- Daily trend chart -->
        <div class="lg:col-span-3 bg-white rounded-[14px] border border-[#ebedf0] p-5">
          <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">日別イベント推移</h3>
          <div v-if="dailyEvents.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
            <div class="text-2xl mb-2">📊</div>
            <p class="text-[10px] text-slate-400">トラッキングデータがまだありません</p>
            <p class="text-[9px] text-slate-300 mt-1">配信にトラッキングピクセルが含まれると自動で計測されます</p>
          </div>
          <div v-else class="flex items-end gap-1 h-40">
            <div v-for="d in dailyEvents" :key="d.date" class="flex-1 flex flex-col items-center gap-0.5 min-w-0">
              <div class="w-full flex flex-col items-center gap-0.5 flex-1 justify-end">
                <div class="bg-indigo-400 w-full rounded-t-sm" :style="{ height: Math.max(2, (d.opens / maxDailyValue) * 100) + 'px' }" :title="d.opens + ' opens'"></div>
                <div class="bg-emerald-400 w-full rounded-t-sm" :style="{ height: Math.max(2, (d.clicks / maxDailyValue) * 100) + 'px' }" :title="d.clicks + ' clicks'"></div>
              </div>
              <span class="text-[7px] text-slate-400 font-mono truncate w-full text-center">{{ d.date }}</span>
            </div>
          </div>
          <div v-if="dailyEvents.length > 0" class="flex items-center gap-4 mt-3 justify-center">
            <div class="flex items-center gap-1.5"><div class="w-2.5 h-2.5 rounded-sm bg-indigo-400"></div><span class="text-[9px] text-slate-500">開封</span></div>
            <div class="flex items-center gap-1.5"><div class="w-2.5 h-2.5 rounded-sm bg-emerald-400"></div><span class="text-[9px] text-slate-500">クリック</span></div>
          </div>
        </div>

        <!-- Recent events feed -->
        <div class="lg:col-span-2 bg-white rounded-[14px] border border-[#ebedf0] p-5">
          <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">リアルタイムイベント</h3>
          <div v-if="recentEvents.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
            <div class="text-2xl mb-2">⚡</div>
            <p class="text-[10px] text-slate-400">イベントはまだありません</p>
          </div>
          <div v-else class="space-y-1 max-h-48 overflow-y-auto">
            <div v-for="ev in recentEvents" :key="ev.id" class="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
              <span :class="['w-5 h-5 rounded-full flex items-center justify-center text-[9px]', ev.event_type === 'open' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600']">
                {{ ev.event_type === 'open' ? '👁' : '👆' }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-[10px] text-slate-700 truncate">
                  <span class="font-bold">{{ ev.event_type === 'open' ? '開封' : 'クリック' }}</span>
                  <span class="text-slate-400 ml-1">{{ ev.delivery_channel }}</span>
                </div>
              </div>
              <span class="text-[9px] text-slate-400 font-mono shrink-0">{{ formatDate(ev.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Campaign performance table -->
      <div class="bg-white rounded-[14px] border border-[#ebedf0] p-5">
        <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">キャンペーン別パフォーマンス</h3>
        <div v-if="campaignPerformance.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
          <div class="text-2xl mb-2">📭</div>
          <p class="text-[10px] text-slate-400">完了した配信はまだありません</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th class="pb-2.5">キャンペーン名</th>
                <th class="pb-2.5">チャネル</th>
                <th class="pb-2.5 text-right">送信</th>
                <th class="pb-2.5 text-right">到達</th>
                <th class="pb-2.5 text-right">開封</th>
                <th class="pb-2.5 text-right">クリック</th>
                <th class="pb-2.5 text-right">開封率</th>
                <th class="pb-2.5 text-right">CTR</th>
                <th class="pb-2.5 text-right">ステータス</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="c in campaignPerformance" :key="c.id" class="text-xs hover:bg-slate-50/50 transition-colors">
                <td class="py-2.5">
                  <div class="font-bold text-slate-800 truncate max-w-[200px]">{{ c.title }}</div>
                  <div class="text-[9px] text-slate-400 font-mono">{{ formatDate(c.scheduled_at || c.created_at) }}</div>
                </td>
                <td class="py-2.5">
                  <span class="font-bold" :class="c.channel === 'LINE' ? 'text-emerald-600' : c.channel === 'Email' ? 'text-blue-600' : 'text-violet-600'">
                    {{ channelMeta[c.channel]?.icon }} {{ c.channel }}
                  </span>
                </td>
                <td class="py-2.5 text-right font-mono tabular-nums text-slate-700">{{ c.sent_count }}</td>
                <td class="py-2.5 text-right font-mono tabular-nums text-slate-700">{{ c.delivered_count }}</td>
                <td class="py-2.5 text-right font-mono tabular-nums text-slate-700">{{ c.opened_count }}</td>
                <td class="py-2.5 text-right font-mono tabular-nums text-slate-700">{{ c.clicked_count }}</td>
                <td class="py-2.5 text-right">
                  <span :class="['font-bold tabular-nums', c.openRate >= 30 ? 'text-emerald-600' : c.openRate >= 15 ? 'text-amber-600' : 'text-red-500']">{{ c.openRate }}%</span>
                </td>
                <td class="py-2.5 text-right">
                  <span :class="['font-bold tabular-nums', c.clickRate >= 10 ? 'text-emerald-600' : c.clickRate >= 3 ? 'text-amber-600' : 'text-red-500']">{{ c.clickRate }}%</span>
                </td>
                <td class="py-2.5 text-right">
                  <span :class="['px-2 py-0.5 rounded-md text-[9px] font-bold', c.status === '完了' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700']">{{ c.status }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
