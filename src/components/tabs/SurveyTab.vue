<script setup>
defineProps({
  surveyCampaigns: Array,
  selectedCampaignId: String,
  surveyQuestions: Array,
  newCampaignTitle: String,
  newQuestionText: String,
  isCreatingQuestion: Boolean,
})
defineEmits([
  'update:newCampaignTitle',
  'update:newQuestionText',
  'selectCampaign',
  'createCampaign',
  'toggleActiveCampaign',
  'createQuestion',
  'addChoice',
])
</script>

<template>
  <div class="flex-1 flex overflow-hidden">
    <aside class="w-1/4 bg-slate-50 border-r p-6">
      <div class="mb-4">
        <h3 class="text-sm font-bold text-slate-400">📋 診断マスター一覧</h3>
        <div class="mt-3 space-y-2">
          <input
            :value="newCampaignTitle"
            @input="$emit('update:newCampaignTitle', $event.target.value)"
            class="w-full border p-2 text-xs rounded-lg"
            placeholder="新しい診断タイトル"
          >
          <button @click="$emit('createCampaign')" class="w-full bg-slate-900 text-white py-1.5 rounded-lg text-xs font-bold">診断を新規作成</button>
        </div>
      </div>
      <div class="space-y-2 border-t pt-4">
        <div
          v-for="cp in surveyCampaigns"
          :key="cp.id"
          @click="$emit('selectCampaign', cp.id)"
          :class="['p-4 rounded-xl border cursor-pointer transition-all', selectedCampaignId === cp.id ? 'bg-white border-indigo-500 shadow-sm' : 'bg-slate-100/50']"
        >
          <div class="flex justify-between items-center">
            <span :class="['text-[9px] px-2 py-0.5 rounded font-bold', cp.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500']">{{ cp.is_active ? '有効' : '無効' }}</span>
            <button v-if="!cp.is_active" @click.stop="$emit('toggleActiveCampaign', cp.id)" class="text-[9px] text-indigo-600 hover:underline">有効化</button>
          </div>
          <h4 class="text-xs font-bold text-slate-800 mt-2">{{ cp.title }}</h4>
        </div>
      </div>
    </aside>
    <main class="w-3/4 p-8 overflow-y-auto flex flex-col bg-white">
      <div class="flex justify-between items-center mb-6 border-b pb-4">
        <div><h2 class="text-xl font-bold text-slate-900">診断ステップフロー設計</h2></div>
        <div class="flex gap-2">
          <input
            :value="newQuestionText"
            @input="$emit('update:newQuestionText', $event.target.value)"
            class="border px-3 py-2 text-xs rounded-xl w-64"
            placeholder="新しい質問文を追加..."
          >
          <button @click="$emit('createQuestion')" :disabled="isCreatingQuestion" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm">質問を追加</button>
        </div>
      </div>
      <div class="flex-1 space-y-6">
        <div v-for="q in surveyQuestions" :key="q.id" class="flex gap-6 items-start bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60">
          <div class="w-1/3 bg-white border rounded-xl p-4 shadow-3xs">
            <span class="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold">質問項目</span>
            <h4 class="text-sm font-bold text-slate-900 mt-2">{{ q.question_text }}</h4>
            <button @click="$emit('addChoice', q.id)" class="mt-4 text-[10px] text-indigo-600 font-bold hover:underline">+ 選択肢を追加</button>
          </div>
          <div class="w-2/3 space-y-2">
            <span class="text-[10px] font-bold text-slate-400 block mb-1">ユーザーの選択肢 と 割り当てセグメント</span>
            <div v-for="choice in q.survey_choices" :key="choice.id" class="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200/60 shadow-3xs">
              <span class="text-xs font-medium text-slate-700">● {{ choice.choice_text }}</span>
              <span class="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg">➔ 分岐先: {{ choice.assigned_segment }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
