<script setup>
import { computed } from 'vue'

const props = defineProps({
  savedTemplates: Array,
  selectedTemplateId: String,
  broadcastTitle: String,
  scheduledAt: String,
  broadcastTargetSegment: String,
  broadcastTasks: Array,
  processingTaskId: String,
})
defineEmits(['update:selectedTemplateId', 'update:broadcastTitle', 'update:scheduledAt', 'update:broadcastTargetSegment', 'reserve', 'execute'])

const statusDot = (status) => {
  if (status === '完了') return { text: 'text-[#06914a]', dot: 'bg-[#06914a]', pulse: false }
  if (status === '失敗' || status === '一部失敗') return { text: 'text-[#dc2626]', dot: 'bg-[#dc2626]', pulse: false }
  if (status === '予約中') return { text: 'text-[#9097a1]', dot: 'bg-[#9097a1]', pulse: false }
  return { text: 'text-[#b45309]', dot: 'bg-[#b45309]', pulse: true }
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

const channelSquare = (ch) => {
  if (ch === 'LINE') return 'bg-[#06C755]'
  if (ch === 'Email') return 'bg-[#3B6EF5]'
  if (ch === 'SMS') return 'bg-[#8B5CF6]'
  return 'bg-[#9097a1]'
}

const taskChannel = (task) => task.delivery_channel || task.broadcast_templates?.delivery_channel || '—'

// Presentation-only KPIs
const kpiTotalTasks = computed(() => (props.broadcastTasks || []).length)
const kpiTotalSends = computed(() =>
  (props.broadcastTasks || []).reduce((sum, t) => sum + (t.broadcast_queues?.length || 0), 0)
)
const kpiCompletionRate = computed(() => {
  const tasks = props.broadcastTasks || []
  if (tasks.length === 0) return '—'
  const done = tasks.filter(t => t.status === '完了').length
  return `${Math.round((done / tasks.length) * 100)}%`
})
</script>

<template>
  <div class="flex-1 flex overflow-hidden bg-[#fbfbfc]">
    <!-- Left: settings panel -->
    <div class="w-[320px] shrink-0 border-r border-[#ebedf0] bg-white flex flex-col overflow-y-auto">
      <div class="px-[18px] py-4 border-b border-[#ebedf0]">
        <h2 class="text-[15px] font-semibold text-[#1f242b]">一斉配信 設定</h2>
        <p class="text-[11.5px] text-[#9097a1] mt-0.5">コンテンツを選んで配信日時・対象を設定</p>
      </div>

      <div class="px-[18px] py-4 flex flex-col gap-[18px] flex-1">
        <div>
          <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">使用コンテンツ</label>
          <select :value="selectedTemplateId" @change="$emit('update:selectedTemplateId', $event.target.value)" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] w-full focus:outline-none focus:border-[#4f46e5]">
            <option value="">テンプレートを選択...</option>
            <option v-for="t in savedTemplates" :key="t.id" :value="t.id">{{ channelIcon(t.delivery_channel) }} 【{{ t.delivery_channel }}】{{ t.title }}</option>
          </select>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">キャンペーン名</label>
          <input :value="broadcastTitle" @input="$emit('update:broadcastTitle', $event.target.value)" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] w-full placeholder-[#9097a1] focus:outline-none focus:border-[#4f46e5]" placeholder="例: 7月キャンペーン配信">
        </div>

        <div>
          <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">対象セグメント</label>
          <select :value="broadcastTargetSegment" @change="$emit('update:broadcastTargetSegment', $event.target.value)" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] w-full focus:outline-none focus:border-[#4f46e5]">
            <option value="ALL">すべての顧客</option>
            <option value="集客最大化タイプ">集客最大化タイプ</option>
            <option value="コスト削減タイプ">コスト削減タイプ</option>
            <option value="未診断">未診断</option>
          </select>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">配信日時</label>
          <input :value="scheduledAt" @input="$emit('update:scheduledAt', $event.target.value)" type="datetime-local" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] w-full focus:outline-none focus:border-[#4f46e5]">
        </div>

        <button @click="$emit('reserve')" class="mt-auto w-full bg-[#4f46e5] rounded-[10px] py-[11px] text-[13px] text-white font-semibold hover:brightness-110 transition">配信を予約する →</button>
      </div>
    </div>

    <!-- Right: results -->
    <div class="flex-1 overflow-y-auto bg-[#fbfbfc]">
      <div class="sticky top-0 z-10 bg-[#fbfbfc] border-b border-[#ebedf0] px-6 py-4">
        <h1 class="text-[16px] font-semibold text-[#1f242b]">配信実績</h1>
        <p class="text-[12px] text-[#9097a1] mt-0.5">キャンペーン名・チャネル・指標</p>
      </div>

      <div class="p-6 space-y-4">
        <!-- KPI cards -->
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-white border border-[#ebedf0] rounded-[12px] px-4 py-3.5">
            <div class="text-[11.5px] text-[#9097a1]">今月の配信数</div>
            <div class="font-mono tabular-nums text-[22px] font-semibold text-[#1f242b] mt-1">{{ kpiTotalTasks }}</div>
          </div>
          <div class="bg-white border border-[#ebedf0] rounded-[12px] px-4 py-3.5">
            <div class="text-[11.5px] text-[#9097a1]">総配信通数</div>
            <div class="font-mono tabular-nums text-[22px] font-semibold text-[#1f242b] mt-1">{{ kpiTotalSends }}</div>
          </div>
          <div class="bg-white border border-[#ebedf0] rounded-[12px] px-4 py-3.5">
            <div class="text-[11.5px] text-[#9097a1]">完了率</div>
            <div class="font-mono tabular-nums text-[22px] font-semibold text-[#1f242b] mt-1">{{ kpiCompletionRate }}</div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!broadcastTasks || broadcastTasks.length === 0" class="bg-white border border-[#ebedf0] rounded-[14px] flex flex-col items-center justify-center py-16 text-center">
          <div class="text-3xl mb-2">📭</div>
          <p class="text-[12.5px] text-[#9097a1]">配信タスクはまだありません</p>
          <p class="text-[11px] text-[#9097a1]/70 mt-1">左の設定パネルから配信を作成しましょう</p>
        </div>

        <!-- Task table card -->
        <div v-else class="bg-white border border-[#ebedf0] rounded-[14px] overflow-hidden">
          <div class="grid [grid-template-columns:2.2fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-2.5 border-b border-[#ebedf0]">
            <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">キャンペーン</span>
            <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">チャネル</span>
            <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">配信数</span>
            <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">ステータス</span>
            <span class="w-[104px]"></span>
          </div>

          <div v-for="task in broadcastTasks" :key="task.id" class="grid [grid-template-columns:2.2fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-3 border-b border-[#ebedf0] last:border-b-0">
            <div class="min-w-0">
              <div class="text-[12.5px] font-medium text-[#1f242b] truncate">{{ task.title }}</div>
              <div class="text-[11px] text-[#9097a1] mt-0.5">{{ formatDate(task.scheduled_at || task.created_at) }}</div>
            </div>
            <div class="flex items-center gap-[6px]">
              <span :class="['w-2 h-2 rounded-[2px] shrink-0', channelSquare(taskChannel(task))]"></span>
              <span class="text-[12px] text-[#3a3f47]">{{ taskChannel(task) }}</span>
            </div>
            <div class="font-mono tabular-nums text-[12.5px] text-[#3a3f47]">{{ task.broadcast_queues?.length || 0 }}</div>
            <div :class="['inline-flex items-center gap-[5px] text-[11.5px] font-medium', statusDot(task.status).text]">
              <span :class="['w-[6px] h-[6px] rounded-full shrink-0', statusDot(task.status).dot, statusDot(task.status).pulse ? 'animate-pulse' : '']"></span>
              {{ task.status }}
            </div>
            <div class="w-[104px] flex justify-end">
              <button
                v-if="task.status === '予約中'"
                @click="$emit('execute', task.id)"
                :disabled="processingTaskId === task.id"
                class="bg-white border border-[#e6e8ec] rounded-[8px] px-3 py-1.5 text-[12px] text-[#3a3f47] hover:bg-[#f1f2f4] transition disabled:opacity-60 whitespace-nowrap"
              >
                {{ processingTaskId === task.id ? '送信中...' : '実行' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
