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
const totalOpened = computed(() => trackingEvents.value.filter(e => e.event_type === 'open').length)
const totalClicked = computed(() => trackingEvents.value.filter(e => e.event_type === 'click').length)

const deliveryRate = computed(() => totalSent.value ? Math.round((totalDelivered.value / totalSent.value) * 100) : 0)
const openRate = computed(() => totalDelivered.value ? Math.round((totalOpened.value / totalDelivered.value) * 100) : 0)
const clickRate = computed(() => totalOpened.value ? Math.round((totalClicked.value / totalOpened.value) * 100) : 0)

// Presentation-only: KPI table rows for the Unibox-style metric table
const kpiRows = computed(() => [
  { label: '配信数', value: totalSent.value.toLocaleString() },
  { label: '到達数', value: totalDelivered.value.toLocaleString() },
  { label: '到達率', value: deliveryRate.value + '%' },
  { label: '開封数', value: totalOpened.value.toLocaleString() },
  { label: '開封率', value: openRate.value + '%' },
  { label: 'クリック数', value: totalClicked.value.toLocaleString() },
  { label: 'CTR', value: clickRate.value + '%' },
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
    const chEvents = trackingEvents.value.filter(e => e.channel === ch)
    const opened = chEvents.filter(e => e.event_type === 'open').length
    const clicked = chEvents.filter(e => e.event_type === 'click').length
    return { channel: ch, sent, delivered, opened, clicked, campaigns: tasks.length }
  })
})

// Presentation-only: Unibox channel colors + labels
const channelMeta = {
  LINE: { label: 'LINE', color: '#06C755' },
  Email: { label: 'メール', color: '#3B6EF5' },
  SMS: { label: 'SMS', color: '#8B5CF6' },
}

const campaignPerformance = computed(() => {
  if (!props.broadcastTasks) return []
  return props.broadcastTasks
    .filter(t => t.status === '完了' || t.status === '一部失敗')
    .slice(0, 10)
    .map(t => {
      const taskEvents = trackingEvents.value.filter(e => e.broadcast_task_id === t.id)
      const opened = taskEvents.filter(e => e.event_type === 'open').length
      const clicked = taskEvents.filter(e => e.event_type === 'click').length
      const delivered = t.delivered_count || 0
      return {
        ...t,
        channel: t.delivery_channel || t.broadcast_templates?.delivery_channel,
        openRate: delivered ? Math.round((opened / delivered) * 100) : 0,
        clickRate: opened ? Math.round((clicked / opened) * 100) : 0,
      }
    })
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
  if (name === '集客最大化タイプ') return 'bg-[#06914a]'
  if (name === 'コスト削減タイプ') return 'bg-[#b45309]'
  if (name === '未診断') return 'bg-[#9097a1]'
  return 'bg-[#4f46e5]'
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
  <div class="flex-1 overflow-y-auto bg-[#fbfbfc]">
    <!-- Sticky page header -->
    <div class="sticky top-0 z-10 bg-[#fbfbfc] border-b border-[#ebedf0] px-7 py-[18px] flex items-center justify-between">
      <div>
        <h1 class="text-[18px] font-semibold text-[#1b1f24]">MAアナリティクス</h1>
        <p class="text-[12px] text-[#9097a1] mt-0.5">配信数・開封率・CTR・CVR ・ 過去14日間</p>
      </div>
      <div class="flex bg-[#f1f2f4] p-0.5 rounded-[9px]">
        <button
          v-for="p in [{ id: '7d', label: '7日' }, { id: '30d', label: '30日' }, { id: '90d', label: '90日' }]"
          :key="p.id"
          @click="changePeriod(p.id)"
          :class="['px-3 py-1 text-[11px] font-semibold rounded-[7px] transition-all', period === p.id ? 'bg-white text-[#4f46e5] shadow-sm border border-[#ebedf0]' : 'text-[#9097a1] hover:text-[#3a3f47]']"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <div class="max-w-[1180px] mx-auto px-7 py-6 space-y-4">
      <!-- Section 1: KPI table -->
      <div class="bg-white border border-[#ebedf0] rounded-[14px] overflow-hidden">
        <div class="grid gap-3 px-[18px] py-[11px] bg-[#fafbfc] border-b border-[#ebedf0] text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.03em]" style="grid-template-columns: 1.4fr 1fr 1fr">
          <div>指標</div>
          <div>値</div>
          <div>前期比</div>
        </div>
        <div
          v-for="row in kpiRows"
          :key="row.label"
          class="grid gap-3 px-[18px] py-[13px] border-b border-[#f4f5f6] items-center hover:bg-[#f7f8fa]"
          style="grid-template-columns: 1.4fr 1fr 1fr"
        >
          <div class="text-[12.5px] font-medium text-[#3a3f47]">{{ row.label }}</div>
          <div class="font-mono tabular-nums text-[14px] font-semibold text-[#1b1f24]">{{ row.value }}</div>
          <div class="text-[12px] text-slate-400">—</div>
        </div>
      </div>

      <!-- Section 2: time-series chart -->
      <div class="bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
        <h3 class="text-[13.5px] font-semibold text-[#1b1f24] mb-4">指標推移</h3>
        <div v-if="dailyEvents.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
          <p class="text-[12px] text-[#9097a1]">トラッキングデータがまだありません</p>
          <p class="text-[11px] text-[#b0b6bf] mt-1">配信にトラッキングピクセルが含まれると自動で計測されます</p>
        </div>
        <div v-else class="flex items-end gap-1 h-40">
          <div v-for="d in dailyEvents" :key="d.date" class="flex-1 flex flex-col items-center gap-0.5 min-w-0">
            <div class="w-full flex flex-col items-center gap-0.5 flex-1 justify-end">
              <div class="bg-[#4f46e5] w-full rounded-t-sm" :style="{ height: Math.max(2, (d.opens / maxDailyValue) * 100) + 'px' }" :title="d.opens + ' opens'"></div>
              <div class="bg-[#06914a] w-full rounded-t-sm" :style="{ height: Math.max(2, (d.clicks / maxDailyValue) * 100) + 'px' }" :title="d.clicks + ' clicks'"></div>
            </div>
            <span class="text-[9px] text-[#9097a1] font-mono truncate w-full text-center">{{ d.date }}</span>
          </div>
        </div>
        <div v-if="dailyEvents.length > 0" class="flex items-center gap-4 mt-3 justify-center">
          <div class="inline-flex items-center gap-[5px] text-[11.5px] font-medium text-[#5a606a]"><span class="w-[6px] h-[6px] rounded-full bg-[#4f46e5]"></span>開封</div>
          <div class="inline-flex items-center gap-[5px] text-[11.5px] font-medium text-[#5a606a]"><span class="w-[6px] h-[6px] rounded-full bg-[#06914a]"></span>クリック</div>
        </div>
      </div>

      <!-- Section 3: channel comparison -->
      <div class="bg-white border border-[#ebedf0] rounded-[14px] overflow-hidden">
        <div class="px-[18px] pt-[16px] pb-2">
          <h3 class="text-[13.5px] font-semibold text-[#1b1f24]">チャネル別パフォーマンス</h3>
        </div>
        <div class="grid gap-3 px-[18px] py-[11px] bg-[#fafbfc] border-y border-[#ebedf0] text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.03em]" style="grid-template-columns: 1.4fr 1fr 1fr 1fr">
          <div>CH</div>
          <div>開封率</div>
          <div>CTR</div>
          <div>CVR</div>
        </div>
        <div
          v-for="ch in channelBreakdown"
          :key="ch.channel"
          class="grid gap-3 px-[18px] py-[13px] border-b border-[#f4f5f6] items-center hover:bg-[#f7f8fa]"
          style="grid-template-columns: 1.4fr 1fr 1fr 1fr"
        >
          <div class="flex items-center gap-[7px]">
            <span class="w-2 h-2 rounded-[2px] shrink-0" :style="{ background: channelMeta[ch.channel]?.color }"></span>
            <span class="text-[12.5px] font-medium text-[#1b1f24]">{{ channelMeta[ch.channel]?.label || ch.channel }}</span>
          </div>
          <div class="font-mono tabular-nums text-[12.5px]" :class="ch.delivered ? 'font-semibold text-[#06914a]' : 'text-slate-400'">
            {{ ch.delivered ? Math.round((ch.opened / ch.delivered) * 100) + '%' : '—' }}
          </div>
          <div class="font-mono tabular-nums text-[12.5px]" :class="ch.opened ? 'font-semibold text-[#06914a]' : 'text-slate-400'">
            {{ ch.opened ? Math.round((ch.clicked / ch.opened) * 100) + '%' : '—' }}
          </div>
          <div class="text-[12px] text-slate-400">—</div>
        </div>
      </div>

      <!-- Segment distribution -->
      <div class="bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
        <h3 class="text-[13.5px] font-semibold text-[#1b1f24] mb-4">セグメント分布</h3>
        <div class="space-y-3">
          <div v-for="seg in segmentEngagement" :key="seg.name">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[12.5px] font-medium text-[#3a3f47]">{{ seg.name }}</span>
              <span class="font-mono tabular-nums text-[11.5px] text-[#9097a1]">{{ seg.count }}名 ({{ seg.pct }}%)</span>
            </div>
            <div class="w-full bg-[#f1f2f4] h-2 rounded-full overflow-hidden">
              <div :class="[segmentColor(seg.name), 'h-full rounded-full transition-all duration-500']" :style="{ width: seg.pct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Campaign performance table -->
      <div class="bg-white border border-[#ebedf0] rounded-[14px] overflow-hidden">
        <div class="px-[18px] pt-[16px] pb-2">
          <h3 class="text-[13.5px] font-semibold text-[#1b1f24]">キャンペーン別パフォーマンス</h3>
        </div>
        <div v-if="campaignPerformance.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
          <p class="text-[12px] text-[#9097a1]">完了した配信はまだありません</p>
        </div>
        <template v-else>
          <div class="grid gap-3 px-[18px] py-[11px] bg-[#fafbfc] border-y border-[#ebedf0] text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.03em]" style="grid-template-columns: 2fr 1fr .7fr .7fr .7fr .7fr .8fr .8fr">
            <div>キャンペーン</div>
            <div>CH</div>
            <div class="text-right">送信</div>
            <div class="text-right">到達</div>
            <div class="text-right">開封率</div>
            <div class="text-right">CTR</div>
            <div class="text-right">クリック</div>
            <div class="text-right">状態</div>
          </div>
          <div
            v-for="c in campaignPerformance"
            :key="c.id"
            class="grid gap-3 px-[18px] py-[13px] border-b border-[#f4f5f6] items-center hover:bg-[#f7f8fa] cursor-pointer"
            style="grid-template-columns: 2fr 1fr .7fr .7fr .7fr .7fr .8fr .8fr"
          >
            <div class="min-w-0">
              <div class="text-[12.5px] font-medium text-[#1b1f24] truncate">{{ c.title }}</div>
              <div class="text-[11px] text-[#9097a1] font-mono">{{ formatDate(c.scheduled_at || c.created_at) }}</div>
            </div>
            <div class="flex items-center gap-[7px]">
              <span class="w-2 h-2 rounded-[2px] shrink-0" :style="{ background: channelMeta[c.channel]?.color }"></span>
              <span class="text-[12px] text-[#3a3f47]">{{ channelMeta[c.channel]?.label || c.channel }}</span>
            </div>
            <div class="text-right font-mono tabular-nums text-[12.5px] text-[#3a3f47]">{{ c.sent_count }}</div>
            <div class="text-right font-mono tabular-nums text-[12.5px] text-[#3a3f47]">{{ c.delivered_count }}</div>
            <div class="text-right font-mono tabular-nums text-[12.5px] font-semibold" :class="c.openRate >= 15 ? 'text-[#06914a]' : 'text-[#3a3f47]'">{{ c.openRate }}%</div>
            <div class="text-right font-mono tabular-nums text-[12.5px] font-semibold" :class="c.clickRate >= 3 ? 'text-[#06914a]' : 'text-[#3a3f47]'">{{ c.clickRate }}%</div>
            <div class="text-right font-mono tabular-nums text-[12.5px] text-[#3a3f47]">{{ c.clicked_count }}</div>
            <div class="text-right">
              <span class="inline-flex items-center gap-[5px] text-[11.5px] font-medium" :class="c.status === '完了' ? 'text-[#06914a]' : 'text-red-600'">
                <span class="w-[6px] h-[6px] rounded-full" :class="c.status === '完了' ? 'bg-[#06914a]' : 'bg-red-500'"></span>
                {{ c.status }}
              </span>
            </div>
          </div>
        </template>
      </div>

      <!-- Recent events feed -->
      <div class="bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
        <h3 class="text-[13.5px] font-semibold text-[#1b1f24] mb-3">リアルタイムイベント</h3>
        <div v-if="recentEvents.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
          <p class="text-[12px] text-[#9097a1]">イベントはまだありません</p>
        </div>
        <div v-else class="max-h-56 overflow-y-auto">
          <div v-for="ev in recentEvents" :key="ev.id" class="flex items-center gap-2.5 py-[9px] border-b border-[#f4f5f6] last:border-0">
            <span class="inline-flex items-center gap-[5px] text-[11.5px] font-medium shrink-0" :class="ev.event_type === 'open' ? 'text-[#4f46e5]' : 'text-[#06914a]'">
              <span class="w-[6px] h-[6px] rounded-full" :class="ev.event_type === 'open' ? 'bg-[#4f46e5]' : 'bg-[#06914a]'"></span>
              {{ ev.event_type === 'open' ? '開封' : 'クリック' }}
            </span>
            <span class="flex-1 min-w-0 text-[11.5px] text-[#9097a1] truncate">{{ ev.delivery_channel }}</span>
            <span class="text-[11px] text-[#9097a1] font-mono tabular-nums shrink-0">{{ formatDate(ev.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
