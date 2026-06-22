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
  if (status === '完了') return 'bg-green-50 text-green-700'
  if (status === '失敗' || status === '一部失敗') return 'bg-red-50 text-red-700'
  return 'bg-amber-50 text-amber-700'
}
</script>

<template>
  <div class="flex-1 flex overflow-hidden bg-white">
    <div class="w-1/2 p-8 overflow-y-auto border-r flex flex-col bg-white">
      <h2 class="text-xl font-bold text-slate-900 tracking-tight mb-6">🚀 一斉配信スケジュール予約</h2>
      <div class="space-y-4 bg-slate-50 p-5 rounded-2xl border">
        <div>
          <label class="text-xs font-bold text-slate-500">使用コンテンツ</label>
          <select :value="selectedTemplateId" @change="$emit('update:selectedTemplateId', $event.target.value)" class="mt-2 w-full rounded-xl border bg-white p-2.5 text-xs focus:outline-none">
            <option value="">選択してください</option>
            <option v-for="t in savedTemplates" :key="t.id" :value="t.id">【{{ t.delivery_channel }}】{{ t.title }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-bold text-slate-500">キャンペーン名</label>
          <input :value="broadcastTitle" @input="$emit('update:broadcastTitle', $event.target.value)" class="mt-2 w-full border bg-white p-2.5 text-xs rounded-xl focus:outline-none" placeholder="例: 本番一斉送信テスト">
        </div>
        <div>
          <label class="text-xs font-bold text-slate-500">配信日時</label>
          <input :value="scheduledAt" @input="$emit('update:scheduledAt', $event.target.value)" type="datetime-local" class="mt-2 w-full border bg-white p-2.5 text-xs rounded-xl focus:outline-none">
        </div>
        <button @click="$emit('reserve')" class="w-full bg-slate-900 text-white p-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition">予約スケジュールを確定</button>
      </div>
    </div>
    <div class="w-1/2 p-8 overflow-y-auto bg-slate-50/30">
      <h3 class="font-bold text-slate-900 text-sm mb-4">📋 一斉配信タスク管理</h3>
      <div class="space-y-4">
        <div v-for="task in broadcastTasks" :key="task.id" class="bg-white p-5 rounded-2xl border shadow-2xs flex flex-col space-y-3">
          <div class="flex justify-between items-center">
            <span class="font-bold text-sm text-slate-900">{{ task.title }}</span>
            <span :class="['px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider', statusClass(task.status)]">{{ task.status }}</span>
          </div>
          <div class="text-[11px] text-slate-400">
            チャネル: <span class="font-bold text-indigo-600">{{ task.delivery_channel }}</span> / 対象: {{ task.broadcast_queues?.length || 0 }}名
          </div>
          <button
            @click="$emit('execute', task.id)"
            v-if="task.status === '予約中'"
            :disabled="processingTaskId === task.id"
            class="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-xs font-bold mt-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-transform"
          >
            {{ processingTaskId === task.id ? '送信中...' : '🚀 今すぐ本番送信を実行！' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
