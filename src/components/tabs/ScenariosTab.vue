<script setup>
defineProps({
  stepScenarios: Array,
  savedTemplates: Array,
})
defineEmits(['addStep'])
</script>

<template>
  <div class="flex-1 p-8 overflow-y-auto bg-white max-w-5xl mx-auto w-full">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-black text-slate-900">⚙️ ステップ配信シナリオ設計 ＆ コンテンツ選択</h2>
        <p class="text-xs text-slate-400 mt-1">「✨ AI生成/自作」タブでストックしたコンテンツを、各ステップに自由に選んでセットできます。</p>
      </div>
      <button @click="$emit('addStep')" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ ステップを追加</button>
    </div>
    <div class="space-y-4">
      <div v-for="(scenario, index) in stepScenarios" :key="index" class="bg-slate-50 border p-5 rounded-2xl flex items-center gap-6 shadow-3xs">
        <div class="bg-emerald-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{{ scenario.step_number }}</div>
        <div class="flex-1 grid grid-cols-4 gap-4">
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-1">配信タイミング</label>
            <div class="flex items-center gap-2">
              <input type="number" v-model="scenario.delay_minutes" class="border bg-white rounded-lg p-2 text-xs w-20 font-mono text-center">
              <span class="text-xs font-bold text-slate-600">分後</span>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-1">チャネル</label>
            <select v-model="scenario.delivery_channel" class="border bg-white rounded-lg p-2 text-xs w-full font-bold">
              <option value="LINE">🟢 LINE</option>
              <option value="Email">🟦 メール</option>
              <option value="SMS">💬 SMS</option>
            </select>
          </div>
          <div class="col-span-2">
            <label class="text-[10px] font-bold text-slate-500 block mb-1">🔥 配信する自作コンテンツを選択</label>
            <select v-model="scenario.template_id" class="border border-emerald-300 bg-white rounded-lg p-2 text-xs w-full font-bold text-emerald-800 focus:outline-none focus:border-emerald-500">
              <option value="">-- 未選択（フォールバック用標準テキストを送信） --</option>
              <option v-for="t in savedTemplates.filter((tmpl) => tmpl.delivery_channel === scenario.delivery_channel)" :key="t.id" :value="t.id">
                【対象: {{ t.target_segment }}】{{ t.title }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
