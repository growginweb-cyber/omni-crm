<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  customers: Array,
  selectedSegment: String,
  selectedCustomer: Object,
  stepQueues: Array,
})
defineEmits(['update:selectedSegment', 'update:selectedCustomer', 'openModal', 'fetchCustomers'])

const searchQuery = ref('')

const filteredCustomers = computed(() => {
  if (!props.customers) return []
  if (!searchQuery.value) return props.customers
  const q = searchQuery.value.toLowerCase()
  return props.customers.filter(
    (c) =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
  )
})

const avatarColor = (name) => {
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500']
  const code = (name || '').charCodeAt(0) || 0
  return colors[code % colors.length]
}

const avatarInitial = (name) => (name || '?').charAt(0)

const segmentStyle = (seg) => {
  if (seg === '集客最大化タイプ') return 'bg-emerald-50 text-emerald-700'
  if (seg === 'コスト削減タイプ') return 'bg-amber-50 text-amber-700'
  if (seg === '未診断') return 'bg-slate-100 text-slate-500'
  return 'bg-indigo-50 text-indigo-700'
}

const statusClass = (status) => {
  if (status === '送信成功') return 'bg-emerald-50 text-emerald-700'
  if (status === '送信失敗') return 'bg-red-50 text-red-700'
  if (status === '送信スキップ') return 'bg-slate-100 text-slate-500'
  return 'bg-amber-50 text-amber-700 animate-pulse'
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

const segments = ['ALL', '集客最大化タイプ', 'コスト削減タイプ', '未診断']
</script>

<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- Left: Customer list -->
    <main class="flex-[3] flex flex-col border-r border-slate-200/60 bg-white overflow-hidden">
      <!-- Toolbar -->
      <div class="px-5 py-4 border-b border-slate-200/60 shrink-0">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-bold text-slate-900">顧客管理</h2>
          <div class="flex items-center gap-2">
            <button @click="$emit('openModal')" class="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 transition-colors">+ 顧客を追加</button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <input
            v-model="searchQuery"
            class="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
            placeholder="🔍 名前・メールで検索..."
          />
        </div>
      </div>

      <!-- Segment tabs -->
      <div class="flex gap-1 px-5 py-2 bg-slate-50/80 border-b border-slate-200/60 shrink-0">
        <button
          v-for="seg in segments"
          :key="seg"
          @click="$emit('update:selectedSegment', seg); $emit('fetchCustomers')"
          :class="[
            'px-3 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap',
            selectedSegment === seg
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-700',
          ]"
        >
          {{ seg }}
        </button>
      </div>

      <!-- Table -->
      <div class="flex-1 overflow-y-auto">
        <table class="w-full">
          <thead class="bg-slate-50 sticky top-0 z-10">
            <tr class="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th class="p-2.5 pl-5 w-10"></th>
              <th class="p-2.5">顧客名</th>
              <th class="p-2.5 hidden lg:table-cell">メール</th>
              <th class="p-2.5 hidden lg:table-cell">電話</th>
              <th class="p-2.5 pr-5 text-right">セグメント</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="c in filteredCustomers"
              :key="c.id"
              @click="$emit('update:selectedCustomer', c)"
              :class="['cursor-pointer transition-colors', selectedCustomer?.id === c.id ? 'bg-indigo-50/60' : 'hover:bg-[#f7f8fa]']"
            >
              <td class="p-2.5 pl-5">
                <div :class="[avatarColor(c.name), 'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white']">
                  {{ avatarInitial(c.name) }}
                </div>
              </td>
              <td class="p-2.5">
                <div class="text-xs font-semibold text-slate-900">{{ c.name }}</div>
                <div class="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{{ c.line_uid && c.line_uid !== '未連携' ? c.line_uid : '' }}</div>
              </td>
              <td class="p-2.5 hidden lg:table-cell">
                <span class="text-[10px] text-slate-500">{{ c.email || '—' }}</span>
              </td>
              <td class="p-2.5 hidden lg:table-cell">
                <span class="text-[10px] text-slate-500">{{ c.phone || '—' }}</span>
              </td>
              <td class="p-2.5 pr-5 text-right">
                <span :class="['inline-block px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap', segmentStyle(c.segment)]">{{ c.segment || '未診断' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredCustomers.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-3xl mb-2">👥</div>
          <p class="text-xs text-slate-400">顧客が見つかりません</p>
        </div>
      </div>
    </main>

    <!-- Right: Detail / Timeline -->
    <aside class="flex-[2] bg-slate-50/50 overflow-y-auto flex flex-col">
      <template v-if="selectedCustomer">
        <!-- Customer detail -->
        <div class="px-5 py-4 border-b border-slate-200/60">
          <div class="flex items-center gap-3 mb-3">
            <div :class="[avatarColor(selectedCustomer.name), 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white']">
              {{ avatarInitial(selectedCustomer.name) }}
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">{{ selectedCustomer.name }}</h3>
              <span :class="['inline-block px-2 py-0.5 rounded-md text-[9px] font-bold mt-0.5', segmentStyle(selectedCustomer.segment)]">{{ selectedCustomer.segment || '未診断' }}</span>
            </div>
          </div>
        </div>
        <div class="px-5 py-3 space-y-2 border-b border-slate-200/60">
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-500 font-semibold">メール</span>
            <span class="text-slate-800">{{ selectedCustomer.email || '—' }}</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-500 font-semibold">電話</span>
            <span class="text-slate-800">{{ selectedCustomer.phone || '—' }}</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-500 font-semibold">LINE UID</span>
            <span class="text-slate-800 font-mono text-[10px] truncate max-w-[160px]">{{ selectedCustomer.line_uid || '—' }}</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-500 font-semibold">登録日</span>
            <span class="text-slate-800">{{ selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleDateString() : '—' }}</span>
          </div>
        </div>
      </template>

      <!-- Timeline -->
      <div class="px-5 py-3 flex-1">
        <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">配信タイムライン</h4>
        <div v-if="stepQueues.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
          <div class="text-2xl mb-2">📭</div>
          <p class="text-[11px] text-slate-400">配信キューはまだありません</p>
        </div>
        <div v-else class="space-y-2">
          <div v-for="queue in stepQueues" :key="queue.id" class="bg-white p-3 rounded-[12px] border border-[#ebedf0] flex flex-col gap-1">
            <div class="flex justify-between items-center">
              <span class="text-xs font-semibold text-slate-800">{{ queue.customers?.name }}</span>
              <span :class="['px-2 py-0.5 rounded-md text-[9px] font-bold', statusClass(queue.status)]">{{ queue.status }}</span>
            </div>
            <div class="flex items-center justify-between text-[10px] text-slate-400">
              <div class="flex items-center gap-1.5">
                <span class="font-semibold text-indigo-500">Step {{ queue.step_number }}</span>
                <span>·</span>
                <span>{{ queue.delivery_channel }}</span>
              </div>
              <div class="font-mono">{{ formatTime(queue.scheduled_at) }}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
