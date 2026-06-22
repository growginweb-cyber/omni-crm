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
  <div class="flex-1 flex bg-slate-100 overflow-hidden items-center justify-center p-8">
    <div class="w-full max-w-md bg-white rounded-[40px] shadow-2xl border-[12px] border-slate-900 h-[720px] flex flex-col relative overflow-hidden">
      <div class="p-3 bg-amber-50 border-b text-[10px] text-amber-800 shrink-0 flex items-center justify-between">
        <span>⚙️ テスト回答顧客:</span>
        <select :value="liffSelectedCustomerId" @change="$emit('update:liffSelectedCustomerId', $event.target.value)" class="bg-white border rounded px-2 py-0.5 font-bold">
          <option value="" disabled>顧客を選択</option>
          <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50">
        <div v-for="q in surveyQuestions" :key="q.id" class="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 space-y-3">
          <h4 class="text-xs font-bold text-slate-900"><span>{{ q.question_text }}</span></h4>
          <div class="space-y-2">
            <label
              v-for="choice in q.survey_choices"
              :key="choice.id"
              :class="['w-full flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer text-xs font-medium transition-all', liffAnswers[q.id] === choice.id ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-3xs' : 'bg-white text-slate-600']"
            >
              <span>{{ choice.choice_text }}</span>
              <input
                type="radio"
                :name="'liff-q-' + q.id"
                :value="choice.id"
                :checked="liffAnswers[q.id] === choice.id"
                @change="$emit('update:liffAnswers', { ...liffAnswers, [q.id]: choice.id })"
                class="hidden"
              >
            </label>
          </div>
        </div>
      </div>
      <div class="p-4 bg-white border-t shrink-0">
        <button @click="$emit('submit')" :disabled="isLiffSubmitting" class="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20">
          {{ isLiffSubmitting ? '処理中...' : '📊 診断を完了して自動ステップを起動' }}
        </button>
      </div>
    </div>
  </div>
</template>
