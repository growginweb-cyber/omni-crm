<script setup>
import { ref } from 'vue'

const props = defineProps({
  autoreplyRules: Array,
})
const emit = defineEmits(['createRule', 'toggleRule', 'deleteRule'])

const isFormOpen = ref(false)
const keyword = ref('')
const matchType = ref('部分一致')
const replyContent = ref('')
const channel = ref('LINE')

const channelDot = (ch) => {
  if (ch === 'LINE') return '#06C755'
  if (ch === 'メール') return '#3B6EF5'
  if (ch === 'SMS') return '#8B5CF6'
  return '#8B5CF6'
}

const submit = () => {
  if (!keyword.value.trim()) return
  emit('createRule', { keyword: keyword.value, matchType: matchType.value, replyContent: replyContent.value, channel: channel.value })
  keyword.value = ''
  replyContent.value = ''
  isFormOpen.value = false
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-[#fbfbfc]">
    <div class="sticky top-0 z-10 bg-[#fbfbfc] border-b border-[#ebedf0] px-7 py-[18px] flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-900">自動応答</h1>
        <p class="text-xs text-[#9097a1] mt-0.5">キーワードに反応して自動返信・通知</p>
      </div>
      <button
        @click="isFormOpen = !isFormOpen"
        class="bg-[#4f46e5] rounded-[9px] px-3.5 py-[7px] text-[12.5px] text-white font-medium hover:brightness-110 transition"
      >＋ ルールを追加</button>
    </div>

    <div class="px-7 py-6 max-w-[1100px]">
      <div v-if="isFormOpen" class="bg-white border border-[#ebedf0] rounded-[13px] p-5 mb-5 flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1.5">キーワード</label>
            <input v-model="keyword" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]" placeholder="例: 営業時間" />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1.5">マッチ方式</label>
            <select v-model="matchType" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]">
              <option>完全一致</option>
              <option>部分一致</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1.5">応答内容</label>
          <textarea v-model="replyContent" rows="2" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full resize-none focus:outline-none focus:border-[#4f46e5]" placeholder="自動返信するメッセージ" />
        </div>
        <div>
          <label class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] block mb-1.5">チャネル</label>
          <select v-model="channel" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]">
            <option>LINE</option>
            <option>メール</option>
            <option>SMS</option>
          </select>
        </div>
        <button @click="submit" class="self-start bg-[#4f46e5] rounded-[9px] px-4 py-2 text-[12.5px] text-white font-semibold hover:brightness-110 transition">保存する</button>
      </div>

      <div class="bg-white border border-[#ebedf0] rounded-[14px] overflow-hidden">
        <div class="grid gap-3 px-[18px] py-[11px] bg-[#fafbfc] border-b border-[#ebedf0] text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.03em]" style="grid-template-columns:1.2fr .8fr 2fr .9fr .7fr 60px">
          <span>キーワード</span><span>マッチ</span><span>応答内容</span><span>チャネル</span><span>反応数</span><span>有効</span>
        </div>
        <div
          v-for="r in autoreplyRules"
          :key="r.id"
          class="grid gap-3 px-[18px] py-[13px] border-b border-[#f4f5f6] items-center hover:bg-[#f7f8fa] transition-colors group"
          style="grid-template-columns:1.2fr .8fr 2fr .9fr .7fr 60px"
        >
          <span class="font-mono text-[12.5px] font-semibold">{{ r.keyword }}</span>
          <span class="text-[11.5px] text-[#6b7280]">{{ r.match_type }}</span>
          <span class="text-xs text-[#3a3f47] truncate">{{ r.reply_content }}</span>
          <span class="inline-flex items-center gap-[5px] text-[11.5px]"><span class="w-2 h-2 rounded-[2px]" :style="{ background: channelDot(r.channel) }"></span>{{ r.channel }}</span>
          <span class="font-mono text-xs text-[#6b7280]">{{ r.hit_count }}</span>
          <div class="flex items-center gap-2">
            <div
              @click="$emit('toggleRule', { id: r.id, enabled: !r.enabled })"
              :style="{ background: r.enabled ? '#4f46e5' : '#d6d9de' }"
              class="w-[34px] h-[19px] rounded-full relative cursor-pointer transition-colors shrink-0"
            >
              <div class="absolute top-[2px] w-[15px] h-[15px] rounded-full bg-white transition-all" :style="{ left: r.enabled ? '17px' : '2px' }"></div>
            </div>
            <button @click="$emit('deleteRule', r.id)" class="text-[#c2c7cf] hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
          </div>
        </div>
        <div v-if="!autoreplyRules || autoreplyRules.length === 0" class="flex flex-col items-center justify-center py-14 text-center">
          <div class="text-2xl mb-2">⚡</div>
          <p class="text-xs text-[#9097a1]">自動応答ルールはまだありません</p>
        </div>
      </div>
    </div>
  </div>
</template>
