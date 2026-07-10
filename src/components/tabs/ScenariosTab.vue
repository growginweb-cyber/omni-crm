<script setup>
import { computed } from 'vue'

const props = defineProps({
  scenarioDefs: Array,
  selectedScenarioDefId: String,
  selectedScenarioDef: Object,
  scenarioItems: Array,
  selectedScenarioItemId: String,
  selectedScenarioItem: Object,
  savedTemplates: Array,
  stepQueues: Array,
  stepAiPrompt: String,
  stepAiResult: String,
  stepAiLoading: Boolean,
  pipelineStages: Array,
})
const emit = defineEmits([
  'selectScenarioDef',
  'createScenarioDef',
  'deleteScenarioDef',
  'selectScenarioItem',
  'addScenarioItem',
  'updateScenarioItem',
  'deleteScenarioItem',
  'toggleScenarioActive',
  'update:stepAiPrompt',
  'generateStepContent',
  'updateScenarioTrigger',
])

const stages = computed(() => props.pipelineStages || ['会員登録', '面談予約', '面談実施', '内定', '就業'])

const channelMeta = (ch) => {
  if (ch === 'LINE') return { icon: '🟢', bg: '#e6f8ee', txt: '#06914a', dot: '#06C755' }
  if (ch === 'Email') return { icon: '📧', bg: '#e8efff', txt: '#2954d4', dot: '#3B6EF5' }
  return { icon: '💬', bg: '#f0ebff', txt: '#6d40d4', dot: '#8B5CF6' }
}

const formatDelay = (minutes) => {
  if (!minutes || minutes === 0) return '即時'
  if (minutes < 60) return `${minutes}分後`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}時間後`
  return `${Math.floor(minutes / 1440)}日後`
}

const templateName = (templateId, savedTemplates) => {
  if (!templateId || !savedTemplates) return '未選択'
  const t = savedTemplates.find(t => t.id === templateId)
  return t ? t.title : '未選択'
}

const filteredTemplates = computed(() => {
  if (!props.selectedScenarioItem || !props.savedTemplates) return []
  return props.savedTemplates.filter(t => t.delivery_channel === props.selectedScenarioItem.delivery_channel)
})

const stepStats = (stepNumber) => {
  const queues = (props.stepQueues || []).filter(q => q.step_number === stepNumber)
  return {
    total: queues.length,
    success: queues.filter(q => q.status === '送信成功').length,
  }
}

const createNewScenario = () => {
  const name = prompt('シナリオ名を入力してください', '新規シナリオ')
  if (name) emit('createScenarioDef', name)
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <header class="flex items-center justify-between px-5 py-3.5 border-b border-[#ebedf0] bg-white">
      <div>
        <h1 class="text-base font-semibold">シナリオ格納庫</h1>
        <p class="text-[11px] text-[#9097a1] mt-0.5">シナリオを作成・編集してください。配信は診断完了時のトリガーで自動実行されます</p>
      </div>
    </header>

    <div class="flex-1 flex min-h-0">
      <!-- 左: シナリオ一覧 -->
      <div class="w-[200px] shrink-0 border-r border-[#ebedf0] bg-white overflow-y-auto flex flex-col">
        <div class="px-3.5 py-3 border-b border-[#f0f1f3] flex items-center justify-between">
          <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">シナリオ</span>
          <span @click="createNewScenario" class="text-[#4f46e5] text-base cursor-pointer font-light">＋</span>
        </div>
        <div
          v-for="s in scenarioDefs"
          :key="s.id"
          @click="$emit('selectScenarioDef', s.id)"
          :class="[
            'flex flex-col px-3.5 py-[11px] text-left w-full border-l-[3px] transition-colors cursor-pointer group',
            selectedScenarioDefId === s.id ? 'border-[#4f46e5] bg-[#ececfd]' : 'border-transparent hover:bg-[#f7f8fa]',
          ]"
        >
          <div class="flex items-center justify-between gap-1">
            <span class="flex items-center gap-1.5 font-semibold text-[12.5px] leading-[1.3] min-w-0">
              <span v-if="s.is_active" class="w-[6px] h-[6px] rounded-full bg-[#06914a] shrink-0"></span>
              <span class="truncate">{{ s.name }}</span>
            </span>
            <button @click.stop="$emit('deleteScenarioDef', s.id)" class="text-[#c2c7cf] hover:text-red-500 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">✕</button>
          </div>
          <span class="text-[10.5px] text-[#9097a1] mt-[3px]">{{ s.trigger_type }}</span>
        </div>
        <div v-if="!scenarioDefs || scenarioDefs.length === 0" class="px-3.5 py-6 text-[11px] text-[#9097a1] text-center">シナリオがありません</div>
      </div>

      <!-- 中央: ステップ一覧 -->
      <div class="w-[260px] shrink-0 border-r border-[#ebedf0] bg-[#fafbfc] overflow-y-auto flex flex-col">
        <div class="px-3.5 py-3 border-b border-[#ebedf0] bg-white flex items-center justify-between">
          <span class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">ステップ</span>
          <template v-if="selectedScenarioDef">
            <button
              @click="$emit('toggleScenarioActive', selectedScenarioDef.id)"
              :class="[
                'text-[10px] font-semibold px-2 py-[3px] rounded-[6px] transition-colors',
                selectedScenarioDef.is_active ? 'bg-[#e6f8ee] text-[#06914a]' : 'bg-[#f1f2f4] text-[#9097a1] hover:bg-[#e6e8ec]',
              ]"
            >{{ selectedScenarioDef.is_active ? '稼働中' : '有効化' }}</button>
          </template>
        </div>
        <div v-if="selectedScenarioDef" class="px-3.5 py-3 border-b border-[#ebedf0] bg-white flex flex-col gap-2">
          <label class="text-[10px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">トリガー</label>
          <select
            :value="selectedScenarioDef.trigger_stage ? '滞留検知' : '友だち追加'"
            @change="$emit('updateScenarioTrigger', { id: selectedScenarioDef.id, triggerType: $event.target.value, triggerStage: selectedScenarioDef.trigger_stage || stages[0], triggerDays: selectedScenarioDef.trigger_days || 3 })"
            class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[8px] px-2.5 py-2 text-[11.5px] focus:outline-none focus:border-[#4f46e5]"
          >
            <option value="友だち追加">友だち追加時</option>
            <option value="滞留検知">滞留検知（ステージ停滞）</option>
          </select>
          <template v-if="selectedScenarioDef.trigger_stage">
            <div class="flex items-center gap-1.5">
              <select
                :value="selectedScenarioDef.trigger_stage"
                @change="$emit('updateScenarioTrigger', { id: selectedScenarioDef.id, triggerType: '滞留検知', triggerStage: $event.target.value, triggerDays: selectedScenarioDef.trigger_days || 3 })"
                class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[8px] px-2 py-1.5 text-[11px] focus:outline-none focus:border-[#4f46e5]"
              >
                <option v-for="s in stages" :key="s" :value="s">{{ s }}</option>
              </select>
              <span class="text-[10.5px] text-[#9097a1] shrink-0">のまま</span>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                type="number"
                :value="selectedScenarioDef.trigger_days"
                @change="$emit('updateScenarioTrigger', { id: selectedScenarioDef.id, triggerType: '滞留検知', triggerStage: selectedScenarioDef.trigger_stage, triggerDays: Number($event.target.value) })"
                class="w-16 bg-[#f7f8fa] border border-[#ebedf0] rounded-[8px] px-2 py-1.5 text-[11px] font-mono text-center focus:outline-none focus:border-[#4f46e5]"
                min="1"
              />
              <span class="text-[10.5px] text-[#9097a1]">日経過で自動起動</span>
            </div>
          </template>
        </div>
        <template v-if="selectedScenarioDef">
          <div class="flex flex-col">
            <div v-for="st in scenarioItems" :key="st.id" class="flex flex-col">
              <button
                @click="$emit('selectScenarioItem', st.id)"
                :class="[
                  'flex items-center gap-2.5 px-3.5 py-[11px] text-left w-full transition-colors',
                  selectedScenarioItemId === st.id ? 'bg-white shadow-[0_1px_4px_rgba(20,24,31,.08)]' : 'hover:bg-white/60',
                ]"
              >
                <span
                  class="text-[9.5px] font-bold px-2 py-[2px] rounded-[5px] shrink-0 whitespace-nowrap"
                  :style="{ background: channelMeta(st.delivery_channel).bg, color: channelMeta(st.delivery_channel).txt }"
                >{{ st.delivery_channel }}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-[12.5px] font-semibold truncate">Step {{ st.step_number }} ・ {{ formatDelay(st.delay_minutes) }}</div>
                  <div class="flex items-center gap-[5px] mt-[2px]">
                    <span class="w-[7px] h-[7px] rounded-[2px]" :style="{ background: channelMeta(st.delivery_channel).dot }"></span>
                    <span class="text-[10.5px] text-[#9097a1] truncate">{{ templateName(st.template_id, savedTemplates) }}</span>
                  </div>
                </div>
              </button>
              <div class="w-[2px] h-3.5 bg-[#e0e3e8] ml-[38px]"></div>
            </div>
            <button
              @click="$emit('addScenarioItem')"
              class="mx-3.5 my-2 bg-white border-[1.5px] border-dashed border-[#d6d9de] rounded-[10px] py-2 text-[12px] text-[#9097a1] hover:border-[#4f46e5] hover:text-[#4f46e5] transition-colors"
            >＋ ステップを追加</button>
          </div>
        </template>
        <div v-else class="px-3.5 py-6 text-[11px] text-[#9097a1] text-center">左からシナリオを選択</div>
      </div>

      <!-- 右: コンテンツエディタ -->
      <div class="flex-1 min-w-0 overflow-y-auto bg-[#fbfbfc]">
        <template v-if="selectedScenarioItem">
          <div class="p-7 max-w-[640px] flex flex-col gap-[18px]">
            <div class="flex items-center gap-2.5">
              <span
                class="text-[10.5px] font-bold px-2.5 py-[3px] rounded-[5px]"
                :style="{ background: channelMeta(selectedScenarioItem.delivery_channel).bg, color: channelMeta(selectedScenarioItem.delivery_channel).txt }"
              >{{ selectedScenarioItem.delivery_channel }}</span>
              <h2 class="text-base font-semibold">Step {{ selectedScenarioItem.step_number }}</h2>
              <button @click="$emit('deleteScenarioItem', selectedScenarioItem.id)" class="ml-auto text-[11px] text-[#c2c7cf] hover:text-red-500 transition-colors">削除</button>
            </div>

            <div class="bg-white border border-[#ebedf0] rounded-[13px] p-[18px] flex flex-col gap-3.5">
              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1.5">配信タイミング</label>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    :value="selectedScenarioItem.delay_minutes"
                    @change="$emit('updateScenarioItem', { id: selectedScenarioItem.id, delayMinutes: Number($event.target.value) })"
                    class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-32 font-mono text-center focus:outline-none focus:border-[#4f46e5]"
                    min="0"
                  />
                  <span class="text-xs font-semibold text-[#6b7280]">分後 = {{ formatDelay(selectedScenarioItem.delay_minutes) }}</span>
                </div>
              </div>

              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1.5">チャネル</label>
                <select
                  :value="selectedScenarioItem.delivery_channel"
                  @change="$emit('updateScenarioItem', { id: selectedScenarioItem.id, deliveryChannel: $event.target.value })"
                  class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]"
                >
                  <option value="LINE">🟢 LINE</option>
                  <option value="Email">📧 メール</option>
                  <option value="SMS">💬 SMS</option>
                </select>
              </div>

              <div>
                <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1.5">配信コンテンツ</label>
                <select
                  :value="selectedScenarioItem.template_id || ''"
                  @change="$emit('updateScenarioItem', { id: selectedScenarioItem.id, templateId: $event.target.value })"
                  class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]"
                >
                  <option value="">未選択（標準テキスト）</option>
                  <option v-for="t in filteredTemplates" :key="t.id" :value="t.id">{{ t.title }}</option>
                </select>
              </div>
            </div>

            <div v-if="stepStats(selectedScenarioItem.step_number).total > 0" class="flex items-center gap-2">
              <span class="text-[10px] font-mono bg-white px-2 py-1 rounded-[6px] border border-[#ebedf0] text-[#6b7280]">計 {{ stepStats(selectedScenarioItem.step_number).total }}名</span>
              <span class="text-[10px] font-mono bg-[#e6f8ee] text-[#06914a] px-2 py-1 rounded-[6px] border border-[#c8f0d8]">✓ {{ stepStats(selectedScenarioItem.step_number).success }}</span>
            </div>

            <!-- AIコンテンツ生成 -->
            <div class="bg-white border border-[#ebedf0] rounded-[13px] p-[18px]">
              <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-2">✨ AIコンテンツ生成</label>
              <textarea
                :value="stepAiPrompt"
                @input="$emit('update:stepAiPrompt', $event.target.value)"
                rows="3"
                class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full resize-none focus:outline-none focus:border-[#4f46e5]"
                placeholder="例: 診断後のフォローアップメッセージを作成して"
              ></textarea>
              <button
                @click="$emit('generateStepContent', { channel: selectedScenarioItem.delivery_channel, prompt: stepAiPrompt })"
                :disabled="stepAiLoading || !stepAiPrompt"
                class="w-full mt-2.5 bg-[#4f46e5] rounded-[9px] py-2.5 text-[12.5px] text-white font-semibold hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
              >
                <span v-if="stepAiLoading" class="animate-spin">⟳</span>
                <span>{{ stepAiLoading ? '生成中…' : 'AI生成' }}</span>
              </button>
              <div v-if="stepAiResult" class="mt-3 bg-[#f7f8fa] rounded-[10px] p-3 text-[11px] text-slate-700 whitespace-pre-wrap border border-[#ebedf0]">{{ stepAiResult }}</div>
            </div>
          </div>
        </template>
        <div v-else class="flex-1 h-full flex flex-col items-center justify-center text-center">
          <div class="text-2xl mb-2">👈</div>
          <p class="text-[11px] text-[#9097a1]">ステップを選択して<br />内容を編集できます</p>
        </div>
      </div>
    </div>
  </div>
</template>
