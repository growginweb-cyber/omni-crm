<script setup>
defineProps({
  customers: Array,
  surveyQuestions: Array,
  liffSelectedCustomerId: String,
  liffAnswers: Object,
  isLiffSubmitting: Boolean,
})
defineEmits(['update:liffSelectedCustomerId', 'update:liffAnswers', 'submit'])
</script>

<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- Left: Info panel -->
    <aside class="w-72 bg-white border-r border-slate-200/60 overflow-y-auto shrink-0 flex flex-col">
      <div class="px-5 py-4 border-b border-slate-200/60">
        <h2 class="text-lg font-bold text-slate-900">LIFF体験</h2>
        <p class="text-[10px] text-slate-400 mt-0.5">ユーザー目線で診断フローを確認できます</p>
      </div>

      <div class="p-5 space-y-4 flex-1">
        <!-- Test customer selection -->
        <div>
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">テスト顧客</label>
          <select :value="liffSelectedCustomerId" @change="$emit('update:liffSelectedCustomerId', $event.target.value)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition">
            <option value="" disabled>顧客を選択...</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <!-- How it works -->
        <div class="bg-[#f7f8fa] rounded-[14px] p-4 border border-[#ebedf0]">
          <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">診断フローの流れ</h4>
          <div class="space-y-3">
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600 shrink-0 mt-0.5">1</div>
              <div>
                <div class="text-[11px] font-bold text-slate-700">質問に回答</div>
                <div class="text-[9px] text-slate-400">表示される質問に順番に回答します</div>
              </div>
            </div>
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600 shrink-0 mt-0.5">2</div>
              <div>
                <div class="text-[11px] font-bold text-slate-700">セグメント判定</div>
                <div class="text-[9px] text-slate-400">回答結果からセグメントが自動判定されます</div>
              </div>
            </div>
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] font-bold text-emerald-600 shrink-0 mt-0.5">3</div>
              <div>
                <div class="text-[11px] font-bold text-slate-700">ステップ配信開始</div>
                <div class="text-[9px] text-slate-400">判定後、自動でシナリオ配信が開始されます</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="bg-[#f7f8fa] rounded-[14px] p-4 border border-[#ebedf0]">
          <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">診断コンテンツ</h4>
          <div class="flex justify-between items-center text-xs mb-1">
            <span class="text-slate-500">質問数</span>
            <span class="font-bold text-slate-800">{{ surveyQuestions?.length || 0 }}問</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-500">回答済み</span>
            <span class="font-bold text-indigo-600">{{ Object.keys(liffAnswers || {}).length }}問</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Center: Phone mockup -->
    <div class="flex-1 flex items-center justify-center bg-slate-100/50 overflow-y-auto p-6">
      <div class="w-[375px] bg-white rounded-[3rem] shadow-2xl border-[14px] border-slate-900 flex flex-col overflow-hidden" style="height: 750px;">
        <!-- Phone status bar -->
        <div class="bg-slate-900 text-white text-center py-1">
          <div class="w-24 h-5 bg-slate-800 rounded-full mx-auto"></div>
        </div>

        <!-- LIFF header -->
        <div class="bg-emerald-500 px-5 py-3 flex items-center gap-2 shrink-0">
          <div class="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center text-sm">📋</div>
          <div>
            <div class="text-white text-xs font-bold">あなたのタイプ診断</div>
            <div class="text-white/70 text-[9px]">質問に答えてピッタリのプランを見つけましょう</div>
          </div>
        </div>

        <!-- Questions area -->
        <div class="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
          <div v-for="(q, qi) in surveyQuestions" :key="q.id" class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div class="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">{{ qi + 1 }}</span>
                <h4 class="text-[11px] font-bold text-slate-900">{{ q.question_text }}</h4>
              </div>
            </div>
            <div class="p-3 space-y-2">
              <label
                v-for="choice in q.survey_choices"
                :key="choice.id"
                :class="[
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left cursor-pointer text-[11px] transition-all',
                  liffAnswers[q.id] === choice.id
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                ]"
              >
                <span :class="['w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0', liffAnswers[q.id] === choice.id ? 'border-indigo-500' : 'border-slate-300']">
                  <span v-if="liffAnswers[q.id] === choice.id" class="w-2 h-2 rounded-full bg-indigo-500"></span>
                </span>
                <span>{{ choice.choice_text }}</span>
                <input
                  type="radio"
                  :name="'liff-q-' + q.id"
                  :value="choice.id"
                  :checked="liffAnswers[q.id] === choice.id"
                  @change="$emit('update:liffAnswers', { ...liffAnswers, [q.id]: choice.id })"
                  class="hidden"
                />
              </label>
            </div>
          </div>

          <div v-if="!surveyQuestions || surveyQuestions.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
            <div class="text-3xl mb-2">📋</div>
            <p class="text-[11px] text-slate-400">診断質問がまだ設定されていません</p>
          </div>
        </div>

        <!-- Submit button -->
        <div class="p-4 bg-white border-t border-slate-200 shrink-0">
          <button @click="$emit('submit')" :disabled="isLiffSubmitting" class="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors disabled:opacity-60">
            {{ isLiffSubmitting ? '処理中...' : '診断を完了する' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
