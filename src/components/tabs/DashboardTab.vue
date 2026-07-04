<script setup>
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

// Stacked bar chart: 7 days, simulated distribution of channelStats across days
const days = ['月', '火', '水', '木', '金', '土', '日']
const barData = () => {
  const total = Object.values(props.channelStats || {}).reduce((a, b) => a + b, 0) || 0
  return days.map((day, i) => {
    // Distribute semi-randomly by index
    const seeds = [0.18, 0.12, 0.16, 0.14, 0.20, 0.11, 0.09]
    const dayTotal = total * seeds[i]
    const lineCount = (props.channelStats?.LINE || 0) * seeds[i]
    const emailCount = (props.channelStats?.Email || 0) * seeds[i]
    const smsCount = (props.channelStats?.SMS || 0) * seeds[i]
    const max = total * 0.20
    return {
      day,
      line: max > 0 ? (lineCount / max) * 100 : 20,
      email: max > 0 ? (emailCount / max) * 100 : 10,
      sms: max > 0 ? (smsCount / max) * 100 : 5,
    }
  })
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
  <div class="flex-1 overflow-y-auto bg-[#fbfbfc]">
    <!-- Sticky header -->
    <div class="sticky top-0 z-20 bg-[#fbfbfc] border-b border-[#ebedf0] px-6 lg:px-7 py-3 flex items-center justify-between">
      <div>
        <h2 class="text-base font-bold text-slate-900 tracking-tight">ダッシュボード</h2>
        <p class="text-[11px] text-[#9097a1]">過去30日間</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="border border-[#ebedf0] bg-white rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-[#f7f8fa] transition-colors">期間: 30日</button>
        <button class="bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold hover:bg-indigo-700 transition-colors">レポート出力</button>
      </div>
    </div>

    <div class="max-w-[1280px] mx-auto p-6 lg:p-7 space-y-[14px]">
      <!-- KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-[14px]">
        <!-- 総送信数 -->
        <div class="bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
          <div class="text-[11.5px] font-medium text-[#9097a1]">総送信数</div>
          <div class="text-[26px] font-mono font-semibold text-slate-900 tracking-tight mt-1 tabular-nums">
            {{ totalStats?.sent ?? 0 }}<span class="text-xs text-slate-400 font-normal ml-1">通</span>
          </div>
          <div class="text-[10.5px] text-slate-400 mt-1">— <span class="text-[#b0b6bf]">前期比</span></div>
        </div>
        <!-- 到達率 -->
        <div class="bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
          <div class="text-[11.5px] font-medium text-[#9097a1]">到達率</div>
          <div class="text-[26px] font-mono font-semibold text-emerald-600 tracking-tight mt-1 tabular-nums">
            {{ deliveryRate() }}<span class="text-xs text-slate-400 font-normal ml-0.5">%</span>
          </div>
          <div class="text-[10.5px] text-slate-400 mt-1">— <span class="text-[#b0b6bf]">前期比</span></div>
        </div>
        <!-- 開封率 -->
        <div class="bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
          <div class="text-[11.5px] font-medium text-[#9097a1]">開封率</div>
          <div class="text-[26px] font-mono font-semibold text-indigo-600 tracking-tight mt-1 tabular-nums">
            {{ openRate() }}<span class="text-xs text-slate-400 font-normal ml-0.5">%</span>
          </div>
          <div class="text-[10.5px] text-slate-400 mt-1">— <span class="text-[#b0b6bf]">前期比</span></div>
        </div>
        <!-- CTR -->
        <div class="bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
          <div class="text-[11.5px] font-medium text-[#9097a1]">CTR</div>
          <div class="text-[26px] font-mono font-semibold text-blue-600 tracking-tight mt-1 tabular-nums">
            {{ ctr() }}<span class="text-xs text-slate-400 font-normal ml-0.5">%</span>
          </div>
          <div class="text-[10.5px] text-slate-400 mt-1">— <span class="text-[#b0b6bf]">前期比</span></div>
        </div>
      </div>

      <!-- Middle row: chart + activity -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-[14px]">
        <!-- Channel stacked bar chart (3 cols) -->
        <div class="lg:col-span-3 bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
          <div class="text-[10px] font-bold text-[#9097a1] uppercase tracking-wider mb-4">チャネル別 メッセージ数</div>
          <!-- Chart -->
          <div class="flex items-end gap-[6px] h-[100px]">
            <div v-for="bar in barData()" :key="bar.day" class="flex-1 h-full flex flex-col justify-end gap-0">
              <div :style="{ height: bar.sms + '%', background: '#8B5CF6', minHeight: bar.sms > 0 ? '2px' : '0' }" class="w-full rounded-t-[2px]"></div>
              <div :style="{ height: bar.email + '%', background: '#3B6EF5', minHeight: bar.email > 0 ? '2px' : '0' }" class="w-full"></div>
              <div :style="{ height: bar.line + '%', background: '#06C755', minHeight: bar.line > 0 ? '2px' : '0' }" class="w-full rounded-b-[2px]"></div>
            </div>
          </div>
          <!-- Day labels -->
          <div class="flex gap-[6px] mt-1">
            <div v-for="bar in barData()" :key="bar.day + '-label'" class="flex-1 text-center text-[9px] text-[#9097a1]">{{ bar.day }}</div>
          </div>
          <!-- Legend -->
          <div class="flex items-center gap-4 mt-4">
            <div class="flex items-center gap-1.5">
              <div class="w-[9px] h-[9px] rounded-[2px]" style="background:#06C755"></div>
              <span class="text-[10px] text-slate-500">LINE</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-[9px] h-[9px] rounded-[2px]" style="background:#3B6EF5"></div>
              <span class="text-[10px] text-slate-500">メール</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-[9px] h-[9px] rounded-[2px]" style="background:#8B5CF6"></div>
              <span class="text-[10px] text-slate-500">SMS</span>
            </div>
          </div>
        </div>

        <!-- Recent activity (2 cols) -->
        <div class="lg:col-span-2 bg-white border border-[#ebedf0] rounded-[14px] p-[18px] flex flex-col">
          <div class="text-[10px] font-bold text-[#9097a1] uppercase tracking-wider mb-3">最近のアクティビティ</div>
          <div v-if="recentBroadcasts().length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <p class="text-xs text-slate-400">配信履歴はまだありません</p>
          </div>
          <div v-else class="divide-y divide-[#ebedf0]">
            <div v-for="task in recentBroadcasts()" :key="task.id" class="py-2.5 flex items-start gap-2.5 hover:bg-[#f7f8fa] transition-colors -mx-2 px-2 rounded-lg">
              <div
                class="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                :style="{ background: channelChip(taskChannel(task)).bg }"
              >{{ channelChip(taskChannel(task)).label }}</div>
              <div class="min-w-0 flex-1">
                <div class="text-[11px] font-bold text-slate-800 truncate">{{ task.title }} <span class="font-normal text-slate-600">を配信しました</span></div>
                <div class="text-[10px] mt-0.5" style="color:#b0b6bf">{{ formatTime(task.scheduled_at || task.created_at) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom row: funnel + CV table -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-[14px]">
        <!-- Funnel (2 cols) -->
        <div class="lg:col-span-2 bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
          <div class="text-[10px] font-bold text-[#9097a1] uppercase tracking-wider mb-4">配信→CV ファネル</div>
          <div class="space-y-3">
            <div v-for="(row, i) in [
              { label: '送信', value: totalStats?.sent ?? 0, color: '#4f46e5' },
              { label: '到達', value: totalStats?.delivered ?? 0, color: '#06C755' },
              { label: '開封', value: totalStats?.opened ?? 0, color: '#3B6EF5' },
              { label: 'クリック', value: totalStats?.clicked ?? 0, color: '#8B5CF6' },
              { label: 'CV', value: 0, color: '#f59e0b' },
            ]" :key="i">
              <div class="flex items-center gap-3">
                <div class="text-[11px] text-slate-500 w-12 shrink-0">{{ row.label }}</div>
                <div class="flex-1 bg-[#f3f4f6] rounded-full h-2 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :style="{
                      width: funnelMax() > 0 ? Math.max(2, Math.round((row.value / funnelMax()) * 100)) + '%' : '2%',
                      background: row.color,
                    }"
                  ></div>
                </div>
                <div class="text-[11px] font-mono text-slate-600 tabular-nums w-10 text-right">{{ row.value }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- CV table (3 cols) -->
        <div class="lg:col-span-3 bg-white border border-[#ebedf0] rounded-[14px] p-[18px]">
          <div class="text-[10px] font-bold text-[#9097a1] uppercase tracking-wider mb-4">チャネル別 CV指標</div>
          <!-- Header -->
          <div class="grid grid-cols-5 gap-2 text-[9.5px] font-bold text-[#9097a1] uppercase tracking-wider pb-2 border-b border-[#ebedf0]">
            <div>CH</div>
            <div class="text-right">配信数</div>
            <div class="text-right">開封率</div>
            <div class="text-right">CTR</div>
            <div class="text-right">CVR</div>
          </div>
          <!-- Rows -->
          <div v-for="ch in ['LINE', 'Email', 'SMS']" :key="ch" class="grid grid-cols-5 gap-2 py-2.5 border-b border-[#ebedf0] last:border-0 hover:bg-[#f7f8fa] -mx-2 px-2 rounded-lg transition-colors items-center">
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
