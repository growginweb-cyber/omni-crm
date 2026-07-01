<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  stepScenarios: Array,
  savedTemplates: Array,
  stepQueues: Array,
})
defineEmits(['addStep'])

const stepStats = (stepNumber) => {
  const queues = (props.stepQueues || []).filter(q => q.step_number === stepNumber)
  return {
    total: queues.length,
    success: queues.filter(q => q.status === '送信成功').length,
    pending: queues.filter(q => q.status === '未送信' || q.status === '処理中').length,
    failed: queues.filter(q => q.status === '送信失敗').length,
  }
}

const selectedStepIndex = ref(null)

const selectedStep = computed(() => {
  if (selectedStepIndex.value === null) return null
  return props.stepScenarios[selectedStepIndex.value] || null
})

const channelIcon = (ch) => {
  if (ch === 'LINE') return '🟢'
  if (ch === 'Email') return '📧'
  if (ch === 'SMS') return '💬'
  return '📤'
}

const channelColor = (ch) => {
  if (ch === 'LINE') return 'border-emerald-300 bg-emerald-50'
  if (ch === 'Email') return 'border-blue-300 bg-blue-50'
  if (ch === 'SMS') return 'border-violet-300 bg-violet-50'
  return 'border-slate-200 bg-slate-50'
}

const channelAccent = (ch) => {
  if (ch === 'LINE') return 'text-emerald-600'
  if (ch === 'Email') return 'text-blue-600'
  if (ch === 'SMS') return 'text-violet-600'
  return 'text-slate-600'
}

const formatDelay = (minutes) => {
  if (!minutes || minutes === 0) return '即時'
  if (minutes < 60) return `${minutes}分後`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}時間後`
  return `${Math.floor(minutes / 1440)}日後`
}

const templateName = (templateId) => {
  if (!templateId || !props.savedTemplates) return '未選択'
  const t = props.savedTemplates.find(t => t.id === templateId)
  return t ? t.title : '未選択'
}

const filteredTemplates = computed(() => {
  if (!selectedStep.value || !props.savedTemplates) return []
  return props.savedTemplates.filter(t => t.delivery_channel === selectedStep.value.delivery_channel)
})
</script>

<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- Center: Flow canvas -->
    <div class="flex-1 min-w-0 overflow-y-auto bg-slate-50/50">
      <div class="px-5 py-4 bg-white border-b border-slate-200/60 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-slate-900">ステップ配信</h2>
          <p class="text-[10px] text-slate-400 mt-0.5">自動追客フローを設計できます</p>
        </div>
        <button @click="$emit('addStep')" class="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 transition-colors">+ ステップ追加</button>
      </div>

      <div class="p-6 max-w-xl mx-auto">
        <!-- Trigger node -->
        <div class="flex flex-col items-center mb-0">
          <div class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[11px] font-bold shadow-sm flex items-center gap-2">
            <span>⚡</span> トリガー：診断完了時
          </div>
          <div class="w-px h-6 bg-slate-300"></div>
        </div>

        <!-- Steps flow -->
        <div v-for="(scenario, index) in stepScenarios" :key="index" class="flex flex-col items-center">
          <!-- Wait node -->
          <div class="bg-white border border-dashed border-slate-300 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
            <span>⏱</span> {{ formatDelay(scenario.delay_minutes) }}
          </div>
          <div class="w-px h-4 bg-slate-300"></div>

          <!-- Step card -->
          <div
            @click="selectedStepIndex = index"
            :class="[
              'w-full max-w-md border-2 rounded-xl p-4 cursor-pointer transition-all',
              selectedStepIndex === index
                ? 'border-indigo-400 bg-white shadow-md ring-2 ring-indigo-100'
                : channelColor(scenario.delivery_channel) + ' hover:shadow-sm',
            ]"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shadow-sm">
                  {{ scenario.step_number }}
                </div>
                <span :class="['text-xs font-bold', channelAccent(scenario.delivery_channel)]">
                  {{ channelIcon(scenario.delivery_channel) }} {{ scenario.delivery_channel }}配信
                </span>
              </div>
              <span class="text-[9px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">Step {{ scenario.step_number }}</span>
            </div>
            <div class="text-[11px] text-slate-600 mb-2">
              <span class="font-semibold">コンテンツ:</span>
              <span class="ml-1">{{ templateName(scenario.template_id) }}</span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <template v-if="stepStats(scenario.step_number).total > 0">
                <span class="text-[9px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
                  計 {{ stepStats(scenario.step_number).total }}名
                </span>
                <span class="text-[9px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                  ✓ {{ stepStats(scenario.step_number).success }}
                </span>
                <span v-if="stepStats(scenario.step_number).pending > 0" class="text-[9px] font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                  ⏳ {{ stepStats(scenario.step_number).pending }}
                </span>
                <span v-if="stepStats(scenario.step_number).failed > 0" class="text-[9px] font-mono bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                  ✗ {{ stepStats(scenario.step_number).failed }}
                </span>
              </template>
              <span v-else class="text-[9px] text-slate-300">実績なし</span>
            </div>
          </div>

          <!-- Connector line -->
          <div v-if="index < stepScenarios.length - 1" class="w-px h-6 bg-slate-300"></div>
        </div>

        <!-- End node -->
        <div class="flex flex-col items-center mt-0" v-if="stepScenarios.length > 0">
          <div class="w-px h-6 bg-slate-300"></div>
          <div class="bg-slate-200 text-slate-500 px-4 py-1.5 rounded-xl text-[10px] font-bold">
            配信完了
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!stepScenarios || stepScenarios.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-3xl mb-2">⚙️</div>
          <p class="text-xs text-slate-400">ステップがまだありません</p>
          <p class="text-[10px] text-slate-300 mt-1">「+ ステップ追加」でフローを作成しましょう</p>
        </div>
      </div>
    </div>

    <!-- Right: Properties panel -->
    <aside class="w-72 bg-white border-l border-slate-200/60 overflow-y-auto shrink-0 flex flex-col">
      <div class="px-4 py-3 border-b border-slate-200/60">
        <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ステップ設定</h3>
      </div>

      <template v-if="selectedStep">
        <div class="p-4 space-y-4 flex-1">
          <!-- Step info -->
          <div class="bg-[#f7f8fa] rounded-[14px] p-3 text-center">
            <div class="text-lg font-black text-slate-900">Step {{ selectedStep.step_number }}</div>
            <div :class="['text-[10px] font-bold', channelAccent(selectedStep.delivery_channel)]">{{ channelIcon(selectedStep.delivery_channel) }} {{ selectedStep.delivery_channel }}</div>
          </div>

          <!-- Timing -->
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">配信タイミング</label>
            <div class="flex items-center gap-2">
              <input type="number" v-model="selectedStep.delay_minutes" class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition" min="0" />
              <span class="text-xs font-bold text-slate-500 whitespace-nowrap">分後</span>
            </div>
            <p class="text-[9px] text-slate-400 mt-1">= {{ formatDelay(selectedStep.delay_minutes) }}</p>
          </div>

          <!-- Channel -->
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">チャネル</label>
            <select v-model="selectedStep.delivery_channel" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition">
              <option value="LINE">🟢 LINE</option>
              <option value="Email">📧 メール</option>
              <option value="SMS">💬 SMS</option>
            </select>
          </div>

          <!-- Content selection -->
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">配信コンテンツ</label>
            <select v-model="selectedStep.template_id" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition">
              <option value="">未選択（標準テキスト）</option>
              <option v-for="t in filteredTemplates" :key="t.id" :value="t.id">{{ t.title }}</option>
            </select>
          </div>

          <!-- Time window -->
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">配信時間帯</label>
            <div class="flex items-center gap-2">
              <input type="time" class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition" value="09:00" />
              <span class="text-xs text-slate-400">〜</span>
              <input type="time" class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition" value="21:00" />
            </div>
            <p class="text-[9px] text-slate-400 mt-1">時間外は翌営業時間に繰り越し</p>
          </div>

          <!-- Day of week -->
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">配信曜日</label>
            <div class="flex gap-1">
              <button v-for="day in ['月','火','水','木','金','土','日']" :key="day" class="w-8 h-8 rounded-lg text-[10px] font-bold border border-slate-200 bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                {{ day }}
              </button>
            </div>
          </div>

          <!-- Segment condition -->
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">対象セグメント</label>
            <select class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition">
              <option>すべて</option>
              <option>集客最大化タイプ</option>
              <option>コスト削減タイプ</option>
              <option>未診断</option>
            </select>
          </div>
        </div>
      </template>

      <!-- No selection -->
      <div v-else class="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div class="text-2xl mb-2">👈</div>
        <p class="text-[11px] text-slate-400">ステップを選択して<br/>設定を編集できます</p>
      </div>
    </aside>
  </div>
</template>
