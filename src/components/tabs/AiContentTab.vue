<script setup>
defineProps({
  selectedChannel: String,
  aiTargetSegment: String,
  generatedContent: String,
  generatedImageUrl: String,
  templateTitle: String,
  savedTemplates: Array,
})
defineEmits(['update:selectedChannel', 'update:aiTargetSegment', 'update:generatedContent', 'update:templateTitle', 'generate', 'save'])
</script>

<template>
  <div class="flex-1 flex overflow-hidden bg-white">
    <div class="w-2/5 p-8 overflow-y-auto border-r">
      <h2 class="text-xl font-bold text-slate-900 tracking-tight mb-5">✨ オムニクリエイティブスタジオ</h2>
      <div class="mb-6 bg-slate-100 p-1 rounded-xl w-max flex">
        <button @click="$emit('update:selectedChannel', 'LINE')" :class="['px-4 py-1.5 text-xs font-bold rounded-lg', selectedChannel === 'LINE' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-400']">🟢 LINE</button>
        <button @click="$emit('update:selectedChannel', 'Email')" :class="['px-4 py-1.5 text-xs font-bold rounded-lg', selectedChannel === 'Email' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400']">🟦 メール</button>
      </div>
      <div class="space-y-4 bg-slate-50 p-5 rounded-2xl border mb-6">
        <div>
          <label class="text-xs font-bold text-slate-500">対象セグメント</label>
          <select :value="aiTargetSegment" @change="$emit('update:aiTargetSegment', $event.target.value)" class="mt-2 w-full rounded-xl border bg-white p-2.5 text-xs">
            <option value="集客最大化タイプ">集客最大化タイプ</option>
            <option value="コスト削減タイプ">コスト削減タイプ</option>
          </select>
        </div>
        <button @click="$emit('generate')" class="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold">✨ メッセージフォームを起動</button>
      </div>
      <div v-if="generatedContent" class="space-y-4 flex-1 flex flex-col">
        <input :value="templateTitle" @input="$emit('update:templateTitle', $event.target.value)" class="border text-xs rounded-xl px-3 py-2 w-full font-bold" placeholder="アセット名・タイトル（例: 初回クーポン配信）">
        <textarea :value="generatedContent" @input="$emit('update:generatedContent', $event.target.value)" rows="5" class="w-full border p-3 text-xs rounded-xl font-mono flex-grow" placeholder="ここに自由に自作メッセージを入力..."></textarea>
        <button @click="$emit('save')" class="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white self-end">💾 テンプレートとして保存</button>
      </div>
    </div>
    <div class="w-1/5 p-6 bg-slate-100 border-r flex flex-col items-center">
      <span class="text-[10px] font-bold text-slate-400 mb-4">📱 プレビュー</span>
      <div v-if="generatedContent && selectedChannel === 'LINE'" class="w-full bg-white rounded-2xl shadow-md border overflow-hidden max-w-[260px]">
        <div class="w-full aspect-[20/13] bg-slate-200"><img :src="generatedImageUrl" class="w-full h-full object-cover"></div>
        <div class="p-4">
          <div class="text-[9px] font-bold text-emerald-600">診断結果</div>
          <div class="text-md font-black text-slate-900">{{ aiTargetSegment }}</div>
        </div>
      </div>
      <div v-else-if="generatedContent" class="bg-white p-4 rounded-xl border text-xs w-full font-mono whitespace-pre-wrap shadow-xs">{{ generatedContent }}</div>
    </div>
    <div class="w-2/5 p-8 overflow-y-auto bg-slate-50/30">
      <h3 class="font-bold text-slate-900 text-sm mb-4">💾 ストック済みアセット</h3>
      <div class="space-y-3">
        <div v-for="t in savedTemplates" :key="t.id" class="bg-white p-4 rounded-xl border flex flex-col space-y-2">
          <div class="flex justify-between items-center font-bold text-xs">
            <span class="text-slate-800 font-black text-xs">{{ t.title }}</span>
            <span class="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-400">{{ t.delivery_channel }}</span>
          </div>
          <p class="text-[10px] text-slate-400 truncate bg-slate-50 p-2 rounded-lg font-mono">{{ t.content }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
