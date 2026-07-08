<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  stepScenarios: Array,
  savedTemplates: Array,
  stepQueues: Array,
  stepAiPrompt: String,
  stepAiResult: String,
  stepAiLoading: Boolean,
})
defineEmits(['addStep', 'update:stepAiPrompt', 'generateStepContent'])

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

const channelBadge = (ch) => {
  if (ch === 'LINE') return 'bg-[#e6f8ee] text-[#06914a]'
  if (ch === 'Email') return 'bg-[#e8efff] text-[#2954d4]'
  if (ch === 'SMS') return 'bg-[#f0ebff] text-[#6d40d4]'
  return 'bg-[#f1f2f4] text-[#9097a1]'
}

const channelLabel = (ch) => {
  if (ch === 'Email') return 'メール'
  return ch
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
    <div class="flex-1 min-w-0 overflow-y-auto bg-[#f6f7f9]" style="background-image:radial-gradient(#dfe2e7 1px,transparent 1px);background-size:22px 22px">
      <div class="sticky top-0 z-10 bg-[#fbfbfc] border-b border-[#ebedf0] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-[16px] font-semibold text-[#1f242b]">ステップ配信</h1>
          <p class="text-[12px] text-[#9097a1] mt-0.5">自動追客フローを設計できます</p>
        </div>
        <button @click="$emit('addStep')" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-[7px] text-[12.5px] text-white font-medium hover:brightness-110 transition">＋ステップ追加</button>
      </div>

      <div class="p-6 max-w-xl mx-auto">
        <!-- Trigger node -->
        <div class="flex flex-col items-center mb-0">
          <div class="bg-[#4f46e5] text-white rounded-[10px] px-4 py-2 text-[11px] font-semibold shadow-sm flex items-center gap-2">
            <span>⚡</span> トリガー：診断完了時
          </div>
          <div class="w-px h-6 bg-[#d6d9de]"></div>
        </div>

        <!-- Steps flow -->
        <div v-for="(scenario, index) in stepScenarios" :key="index" class="flex flex-col items-center">
          <!-- Wait node -->
          <div class="bg-white border border-dashed border-[#d6d9de] rounded-[8px] px-3 py-1.5 text-[10px] font-semibold text-[#9097a1] flex items-center gap-1.5">
            <span>⏱</span> {{ formatDelay(scenario.delay_minutes) }}
          </div>
          <div class="w-px h-4 bg-[#d6d9de]"></div>

          <!-- Step card -->
          <div
            @click="selectedStepIndex = index"
            :class="[
              'w-full max-w-md bg-white rounded-[13px] p-4 cursor-pointer transition-all shadow-[0_2px_8px_-3px_rgba(20,24,31,.08)]',
              selectedStepIndex === index
                ? 'border border-[#4f46e5] ring-2 ring-[#4f46e5]/10'
                : 'border border-[#ebedf0] hover:shadow-md',
            ]"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shadow-sm">
                  {{ scenario.step_number }}
                </div>
                <span :class="['text-[10.5px] font-bold px-2.5 py-[3px] rounded-[5px]', channelBadge(scenario.delivery_channel)]">
                  {{ channelLabel(scenario.delivery_channel) }}
                </span>
              </div>
              <span class="text-[9px] font-mono tabular-nums text-[#9097a1] bg-white px-2 py-0.5 rounded-full border border-[#ebedf0]">Step {{ scenario.step_number }}</span>
            </div>
            <div class="text-[11px] text-[#3a3f47] mb-2">
              <span class="font-semibold">コンテンツ:</span>
              <span class="ml-1">{{ templateName(scenario.template_id) }}</span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <template v-if="stepStats(scenario.step_number).total > 0">
                <span class="text-[9px] font-mono tabular-nums bg-white px-1.5 py-0.5 rounded-full border border-[#ebedf0] text-[#9097a1]">
                  計 {{ stepStats(scenario.step_number).total }}名
                </span>
                <span class="text-[9px] font-mono tabular-nums bg-white px-1.5 py-0.5 rounded-full border border-[#ebedf0] text-[#06914a]">
                  ✓ {{ stepStats(scenario.step_number).success }}
                </span>
                <span v-if="stepStats(scenario.step_number).pending > 0" class="text-[9px] font-mono tabular-nums bg-white px-1.5 py-0.5 rounded-full border border-[#ebedf0] text-[#b45309]">
                  ⏳ {{ stepStats(scenario.step_number).pending }}
                </span>
                <span v-if="stepStats(scenario.step_number).failed > 0" class="text-[9px] font-mono tabular-nums bg-white px-1.5 py-0.5 rounded-full border border-[#ebedf0] text-[#dc2626]">
                  ✗ {{ stepStats(scenario.step_number).failed }}
                </span>
              </template>
              <span v-else class="text-[9px] text-[#9097a1]/60">実績なし</span>
            </div>
          </div>

          <!-- Connector line -->
          <div v-if="index < stepScenarios.length - 1" class="w-px h-6 bg-[#d6d9de]"></div>
        </div>

        <!-- End node -->
        <div class="flex flex-col items-center mt-0" v-if="stepScenarios.length > 0">
          <div class="w-px h-6 bg-[#d6d9de]"></div>
          <div class="bg-white border border-[#ebedf0] text-[#9097a1] px-4 py-1.5 rounded-[10px] text-[10px] font-semibold">
            配信完了
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!stepScenarios || stepScenarios.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-3xl mb-2">⚙️</div>
          <p class="text-[12.5px] text-[#9097a1]">ステップがまだありません</p>
          <p class="text-[11px] text-[#9097a1]/70 mt-1">「＋ステップ追加」でフローを作成しましょう</p>
        </div>
      </div>
    </div>

    <!-- Right: Properties panel -->
    <aside class="w-[320px] shrink-0 border-l border-[#ebedf0] bg-white flex flex-col overflow-y-auto">
      <div class="px-[18px] py-4 border-b border-[#ebedf0]">
        <h2 class="text-[15px] font-semibold text-[#1f242b]">ステップ設定</h2>
        <p class="text-[11.5px] text-[#9097a1] mt-0.5">選択したステップの配信条件を編集</p>
      </div>

      <template v-if="selectedStep">
        <div class="px-[18px] py-4 flex flex-col gap-[18px] flex-1">
          <!-- Step info -->
          <div class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[12px] p-3 text-center">
            <div class="text-lg font-semibold text-[#1f242b] font-mono tabular-nums">Step {{ selectedStep.step_number }}</div>
            <span :class="['inline-block mt-1 text-[10.5px] font-bold px-2.5 py-[3px] rounded-[5px]', channelBadge(selectedStep.delivery_channel)]">{{ channelLabel(selectedStep.delivery_channel) }}</span>
          </div>

          <!-- Timing -->
          <div>
            <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">配信タイミング</label>
            <div class="flex items-center gap-2">
              <input type="number" v-model="selectedStep.delay_minutes" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] font-mono tabular-nums text-center focus:outline-none focus:border-[#4f46e5]" min="0" />
              <span class="text-[12px] font-semibold text-[#9097a1] whitespace-nowrap">分後</span>
            </div>
            <p class="text-[10px] text-[#9097a1] mt-1">= {{ formatDelay(selectedStep.delay_minutes) }}</p>
          </div>

          <!-- Channel -->
          <div>
            <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">チャネル</label>
            <select v-model="selectedStep.delivery_channel" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] w-full focus:outline-none focus:border-[#4f46e5]">
              <option value="LINE">🟢 LINE</option>
              <option value="Email">📧 メール</option>
              <option value="SMS">💬 SMS</option>
            </select>
          </div>

          <!-- Content selection -->
          <div>
            <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">配信コンテンツ</label>
            <select v-model="selectedStep.template_id" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] w-full focus:outline-none focus:border-[#4f46e5]">
              <option value="">未選択（標準テキスト）</option>
              <option v-for="t in filteredTemplates" :key="t.id" :value="t.id">{{ t.title }}</option>
            </select>
          </div>

          <!-- Time window -->
          <div>
            <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">配信時間帯</label>
            <div class="flex items-center gap-2">
              <input type="time" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] focus:outline-none focus:border-[#4f46e5]" value="09:00" />
              <span class="text-[12px] text-[#9097a1]">〜</span>
              <input type="time" class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] focus:outline-none focus:border-[#4f46e5]" value="21:00" />
            </div>
            <p class="text-[10px] text-[#9097a1] mt-1">時間外は翌営業時間に繰り越し</p>
          </div>

          <!-- Day of week -->
          <div>
            <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">配信曜日</label>
            <div class="flex gap-1">
              <button v-for="day in ['月','火','水','木','金','土','日']" :key="day" class="w-8 h-8 rounded-[8px] text-[11px] font-semibold border border-[#e6e8ec] bg-white text-[#9097a1] hover:bg-[#f1f2f4] hover:text-[#4f46e5] hover:border-[#4f46e5] transition-colors">
                {{ day }}
              </button>
            </div>
          </div>

          <!-- Segment condition -->
          <div>
            <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">対象セグメント</label>
            <select class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] w-full focus:outline-none focus:border-[#4f46e5]">
              <option>すべて</option>
              <option>集客最大化タイプ</option>
              <option>コスト削減タイプ</option>
              <option>未診断</option>
            </select>
          </div>

          <!-- AI content generation -->
          <div class="border-t border-[#ebedf0] pt-4">
            <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[9px] block">✨ AIコンテンツ生成</label>
            <textarea
              :value="stepAiPrompt"
              @input="$emit('update:stepAiPrompt', $event.target.value)"
              rows="3"
              class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] text-[#3a3f47] w-full resize-none placeholder-[#9097a1] focus:outline-none focus:border-[#4f46e5]"
              placeholder="例: 診断後のフォローアップメッセージを作成して"
            ></textarea>
            <button
              @click="$emit('generateStepContent', { channel: selectedStep.delivery_channel, segment: selectedStep.segment, prompt: stepAiPrompt })"
              :disabled="stepAiLoading || !stepAiPrompt"
              class="w-full mt-2 bg-[#4f46e5] rounded-[10px] py-[11px] text-[13px] text-white font-semibold hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span v-if="stepAiLoading" class="animate-spin">⟳</span>
              <span>{{ stepAiLoading ? '生成中...' : '✨ AI生成' }}</span>
            </button>
            <div v-if="stepAiResult" class="mt-3 bg-[#f7f8fa] rounded-[10px] p-3 text-[11px] text-[#3a3f47] whitespace-pre-wrap border border-[#ebedf0]">{{ stepAiResult }}</div>
          </div>
        </div>
      </template>

      <!-- No selection -->
      <div v-else class="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div class="text-2xl mb-2">👈</div>
        <p class="text-[11.5px] text-[#9097a1]">ステップを選択して<br/>設定を編集できます</p>
      </div>
    </aside>
  </div>
</template>
