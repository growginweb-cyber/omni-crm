<script setup>
defineProps({
  totalStats: Object,
  channelStats: Object,
})

const channels = [
  { key: 'LINE', label: 'LINE', color: 'bg-emerald-500' },
  { key: 'Email', label: 'メール', color: 'bg-blue-500' },
  { key: 'SMS', label: 'SMS', color: 'bg-orange-500' },
]
</script>

<template>
  <div class="flex-1 p-6 lg:p-8 overflow-y-auto bg-slate-50/50">
    <div class="max-w-6xl mx-auto space-y-6">
      <h2 class="text-xl font-black text-slate-900 tracking-tight">ダッシュボード</h2>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white p-5 rounded-2xl border border-slate-200/60">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">総送信数</span>
          <div class="text-2xl font-black text-slate-900 mt-1.5 font-mono">{{ totalStats.sent }}<span class="text-xs text-slate-400 font-normal ml-1">通</span></div>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200/60">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">到達率</span>
          <div class="text-2xl font-black text-emerald-600 mt-1.5 font-mono">{{ totalStats.sent ? Math.round((totalStats.delivered / totalStats.sent) * 100) : 0 }}<span class="text-xs text-slate-400 font-normal ml-1">%</span></div>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200/60">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">開封率</span>
          <div class="text-2xl font-black text-indigo-600 mt-1.5 font-mono">{{ totalStats.delivered ? Math.round((totalStats.opened / totalStats.delivered) * 100) : 0 }}<span class="text-xs text-slate-400 font-normal ml-1">%</span></div>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200/60">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CTR</span>
          <div class="text-2xl font-black text-blue-600 mt-1.5 font-mono">{{ totalStats.opened ? Math.round((totalStats.clicked / totalStats.opened) * 100) : 0 }}<span class="text-xs text-slate-400 font-normal ml-1">%</span></div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 bg-white p-5 rounded-2xl border">
          <h3 class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">配信推移</h3>
          <div class="h-44 flex items-end gap-3 px-2 border-b border-l border-slate-100">
            <div class="flex-1 bg-indigo-100 rounded-t-lg" style="height: 40%"></div>
            <div class="flex-1 bg-indigo-200 rounded-t-lg" style="height: 65%"></div>
            <div class="flex-1 bg-indigo-400 rounded-t-lg" style="height: 85%"></div>
            <div class="flex-1 bg-indigo-600 rounded-t-lg" style="height: 60%"></div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-2xl border">
          <h3 class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-5">チャネル別</h3>
          <div class="space-y-4">
            <div v-for="ch in channels" :key="ch.key">
              <div class="flex justify-between text-xs mb-1 font-medium">
                <span>{{ ch.label }}</span>
                <span class="font-mono text-slate-500">{{ channelStats[ch.key] }}通</span>
              </div>
              <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div :class="[ch.color, 'h-full rounded-full']" :style="{ width: channelStats[ch.key] ? '100%' : '5%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
