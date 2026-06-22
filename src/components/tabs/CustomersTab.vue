<script setup>
defineProps({
  customers: Array,
  selectedSegment: String,
  selectedCustomer: Object,
  stepQueues: Array,
})
defineEmits(['update:selectedSegment', 'update:selectedCustomer', 'openModal', 'fetchCustomers'])

const statusClass = (status) => {
  if (status === '送信成功') return 'bg-emerald-50 text-emerald-700'
  if (status === '送信失敗') return 'bg-red-50 text-red-700'
  if (status === '送信スキップ') return 'bg-slate-100 text-slate-500'
  return 'bg-amber-50 text-amber-700 animate-pulse'
}
</script>

<template>
  <div class="flex-1 flex overflow-hidden">
    <main class="w-3/5 p-6 overflow-y-auto border-r border-slate-200/60 flex flex-col bg-white">
      <div class="flex items-center justify-between mb-5 shrink-0">
        <h2 class="text-lg font-bold text-slate-900">顧客管理</h2>
        <button @click="$emit('openModal')" class="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors">+ 顧客を追加</button>
      </div>
      <div class="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg shrink-0 flex-wrap border">
        <button
          v-for="seg in ['ALL', '集客最大化タイプ', 'コスト削減タイプ', '未診断']"
          :key="seg"
          @click="$emit('update:selectedSegment', seg); $emit('fetchCustomers')"
          :class="['px-3 py-1.5 text-[11px] font-bold rounded-md transition-all whitespace-nowrap', selectedSegment === seg ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700']"
        >
          {{ seg }}
        </button>
      </div>
      <div class="overflow-hidden border border-slate-200 rounded-xl bg-white flex-1">
        <table class="w-full">
          <thead class="bg-slate-50">
            <tr class="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th class="p-3 pl-5">顧客</th>
              <th class="p-3 w-36 text-right pr-5">セグメント</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="c in customers"
              :key="c.id"
              @click="$emit('update:selectedCustomer', c)"
              :class="['cursor-pointer transition-colors', selectedCustomer?.id === c.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50']"
            >
              <td class="p-3 pl-5">
                <div class="font-semibold text-sm text-slate-900">{{ c.name }}</div>
                <div class="text-[11px] text-slate-400 font-mono truncate max-w-[240px]">{{ c.line_uid }}</div>
              </td>
              <td class="p-3 pr-5 text-right">
                <span class="inline-block px-2 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 whitespace-nowrap">{{ c.segment }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
    <aside class="w-2/5 p-6 bg-slate-50/50 overflow-y-auto flex flex-col">
      <h3 class="font-bold text-sm text-slate-900 mb-1">ステップ配信タイムライン</h3>
      <p class="text-[11px] text-slate-400 mb-4">シナリオに従い自動生成された配信キュー</p>
      <div v-if="stepQueues.length === 0" class="flex-1 flex items-center justify-center">
        <p class="text-xs text-slate-400">配信キューはまだありません</p>
      </div>
      <div v-else class="space-y-2">
        <div v-for="queue in stepQueues" :key="queue.id" class="bg-white p-3.5 rounded-xl border flex flex-col gap-1.5">
          <div class="flex justify-between items-center">
            <span class="text-xs font-semibold text-slate-800">{{ queue.customers?.name }}</span>
            <span :class="['px-2 py-0.5 rounded text-[10px] font-bold', statusClass(queue.status)]">{{ queue.status }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <div>Step {{ queue.step_number }} / {{ queue.delivery_channel }}</div>
            <div class="font-mono text-[10px]">{{ new Date(queue.scheduled_at).toLocaleTimeString() }}</div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
