<script setup>
defineProps({
  savedTemplates: Array,
  selectedTemplateId: String,
  broadcastTitle: String,
  scheduledAt: String,
  broadcastTasks: Array,
  processingTaskId: String,
})
defineEmits(['update:selectedTemplateId', 'update:broadcastTitle', 'update:scheduledAt', 'reserve', 'execute'])

const statusClass = (status) => {
  if (status === '完了') return 'bg-emerald-50 text-emerald-700'
  if (status === '失敗' || status === '一部失敗') return 'bg-red-50 text-red-700'
  if (status === '予約中') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-500'
}

const statusIcon = (status) => {
  if (status === '完了') return '✅'
  if (status === '失敗' || status === '一部失敗') return '❌'
  if (status === '予約中') return '⏳'
  return '📤'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

const channelIcon = (ch) => {
  if (ch === 'LINE') return '🟢'
  if (ch === 'Email') return '📧'
  if (ch === 'SMS') return '💬'
  return '📤'
}
</script>

<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- Left: Reservation form -->
    <div class="flex-[2] flex flex-col border-r border-slate-200/60 bg-white overflow-y-auto">
      <div class="px-5 py-4 border-b border-slate-200/60 shrink-0">
        <h2 class="text-lg font-bold text-slate-900">ショット配信</h2>
        <p class="text-[10px] text-slate-400 mt-0.5">テンプレートを選択して配信を予約・実行できます</p>
      </div>

      <div class="p-5 space-y-4 flex-1">
        <div class="bg-white border border-[#ebedf0] rounded-[14px] p-5 space-y-4">
          <h3 class="text-xs font-bold text-slate-700">新規配信を予約</h3>

          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">使用コンテンツ</label>
            <select :value="selectedTemplateId" @change="$emit('update:selectedTemplateId', $event.target.value)" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition">
              <option value="">テンプレートを選択...</option>
              <option v-for="t in savedTemplates" :key="t.id" :value="t.id">{{ channelIcon(t.delivery_channel) }} 【{{ t.delivery_channel }}】{{ t.title }}</option>
            </select>
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">キャンペーン名</label>
            <input :value="broadcastTitle" @input="$emit('update:broadcastTitle', $event.target.value)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition" placeholder="例: 7月キャンペーン配信">
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">配信日時</label>
            <input :value="scheduledAt" @input="$emit('update:scheduledAt', $event.target.value)" type="datetime-local" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition">
          </div>

          <button @click="$emit('reserve')" class="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-[11px] font-bold hover:bg-indigo-700 transition-colors">予約を確定</button>
        </div>
      </div>
    </div>

    <!-- Right: Task list -->
    <div class="flex-[3] bg-slate-50/50 overflow-y-auto">
      <div class="px-5 py-4 border-b border-slate-200/60 bg-white sticky top-0 z-10 shrink-0">
        <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">配信タスク一覧</h3>
      </div>

      <div class="p-5 space-y-3">
        <div v-if="!broadcastTasks || broadcastTasks.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-3xl mb-2">📭</div>
          <p class="text-xs text-slate-400">配信タスクはまだありません</p>
          <p class="text-[10px] text-slate-300 mt-1">左の予約フォームから配信を作成しましょう</p>
        </div>

        <div v-for="task in broadcastTasks" :key="task.id" class="bg-white rounded-[14px] border border-[#ebedf0] overflow-hidden">
          <!-- Task header -->
          <div class="px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="text-sm">{{ statusIcon(task.status) }}</span>
              <div class="min-w-0">
                <div class="text-xs font-bold text-slate-900 truncate">{{ task.title }}</div>
                <div class="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                  <span class="font-semibold" :class="task.delivery_channel === 'LINE' ? 'text-emerald-600' : task.delivery_channel === 'Email' ? 'text-blue-600' : 'text-violet-600'">
                    {{ channelIcon(task.delivery_channel || task.broadcast_templates?.delivery_channel) }} {{ task.delivery_channel || task.broadcast_templates?.delivery_channel }}
                  </span>
                  <span>·</span>
                  <span>{{ task.broadcast_queues?.length || 0 }}名</span>
                  <span>·</span>
                  <span>{{ formatDate(task.scheduled_at || task.created_at) }}</span>
                </div>
              </div>
            </div>
            <span :class="['px-2 py-0.5 rounded-md text-[9px] font-bold shrink-0', statusClass(task.status)]">{{ task.status }}</span>
          </div>

          <!-- Progress bar for completed -->
          <div v-if="task.broadcast_queues && task.broadcast_queues.length > 0" class="px-4 pb-2">
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="task.status === '完了' ? 'bg-emerald-500' : task.status === '失敗' ? 'bg-red-500' : 'bg-amber-400'"
                :style="{ width: task.status === '完了' ? '100%' : task.status === '予約中' ? '0%' : '50%' }"
              ></div>
            </div>
          </div>

          <!-- Execute button -->
          <div v-if="task.status === '予約中'" class="px-4 pb-3">
            <button
              @click="$emit('execute', task.id)"
              :disabled="processingTaskId === task.id"
              class="w-full bg-emerald-600 text-white py-2 rounded-lg text-[11px] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {{ processingTaskId === task.id ? '送信処理中...' : '今すぐ配信を実行' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
