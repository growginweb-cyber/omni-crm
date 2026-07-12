<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  conversations: Array,
  selectedConversationId: String,
  selectedConversation: Object,
  inboxMessages: Array,
  inboxDraft: String,
  isSendingInbox: Boolean,
})
const emit = defineEmits(['selectConversation', 'update:inboxDraft', 'send', 'toggleStatus'])

const filter = ref('all')

const filteredConversations = computed(() => {
  if (!props.conversations) return []
  if (filter.value === 'unread') return props.conversations.filter(c => c.unread)
  if (filter.value !== 'all') return props.conversations.filter(c => c.channel === filter.value)
  return props.conversations
})

const channelMeta = (ch) => {
  if (ch === 'LINE') return { color: '#06C755', short: 'L', bg: '#e6f8ee', txt: '#06914a' }
  if (ch === 'Email' || ch === 'メール') return { color: '#3B6EF5', short: '@', bg: '#e8efff', txt: '#2954d4' }
  return { color: '#8B5CF6', short: 'S', bg: '#f0ebff', txt: '#6d40d4' }
}

const avatarColor = (name) => {
  const colors = ['#4f46e5', '#06914a', '#d97706', '#7c3aed', '#dc2626', '#0891b2']
  const code = (name || '').charCodeAt(0) || 0
  return colors[code % colors.length]
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="flex-1 flex min-h-0">
    <!-- 会話リスト -->
    <div class="w-[300px] shrink-0 border-r border-[#ebedf0] bg-white flex flex-col">
      <div class="px-4 py-3.5 border-b border-[#ebedf0]">
        <div class="flex items-center justify-between">
          <h1 class="text-base font-semibold">受信トレイ</h1>
          <span class="font-mono text-[11px] text-[#9097a1]">{{ conversations?.length || 0 }} 件</span>
        </div>
        <div class="flex gap-1.5 mt-3">
          <button
            v-for="f in [{k:'all',l:'すべて'},{k:'unread',l:'未読'},{k:'LINE',l:'LINE'},{k:'Email',l:'メール'}]"
            :key="f.k"
            @click="filter = f.k"
            :class="[
              'px-2.5 py-1 rounded-[7px] text-[11px] font-semibold transition-colors',
              filter === f.k ? 'bg-[#ececfd] text-[#4f46e5]' : 'text-[#9097a1] hover:bg-[#f1f2f4]',
            ]"
          >{{ f.l }}</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <button
          v-for="c in filteredConversations"
          :key="c.id"
          @click="$emit('selectConversation', c.id)"
          :class="[
            'w-full flex items-center gap-2.5 px-4 py-3 border-b border-[#f4f5f6] text-left transition-colors',
            selectedConversationId === c.id ? 'bg-[#ececfd]' : 'hover:bg-[#f7f8fa]',
          ]"
        >
          <div class="relative shrink-0">
            <div class="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white font-semibold text-[13px]" :style="{ background: avatarColor(c.customers?.name) }">
              {{ (c.customers?.name || '?').charAt(0) }}
            </div>
            <span
              class="absolute -bottom-[1px] -right-[2px] w-[15px] h-[15px] rounded-full border-2 border-white flex items-center justify-center text-white font-bold"
              style="font-size:7px"
              :style="{ background: channelMeta(c.channel).color }"
            >{{ channelMeta(c.channel).short }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span :class="['text-[13px] truncate', c.unread ? 'font-bold' : 'font-medium']">{{ c.customers?.name || '不明' }}</span>
              <span class="text-[10.5px] text-[#b0b6bf] shrink-0">{{ formatTime(c.last_message_at) }}</span>
            </div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span :class="['flex-1 text-xs truncate', c.unread ? 'text-slate-700' : 'text-[#9097a1]']">{{ c.status }}</span>
              <span v-if="c.unread" class="w-[7px] h-[7px] rounded-full bg-[#4f46e5] shrink-0"></span>
            </div>
          </div>
        </button>
        <div v-if="filteredConversations.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-2xl mb-2">💬</div>
          <p class="text-xs text-[#9097a1]">会話がありません</p>
        </div>
      </div>
    </div>

    <!-- スレッド -->
    <div class="flex-1 min-w-[300px] flex flex-col bg-[#fbfbfc]">
      <template v-if="selectedConversation">
        <header class="flex items-center justify-between px-5 py-[13px] border-b border-[#ebedf0] bg-white">
          <div class="flex items-center gap-[11px]">
            <div class="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white font-semibold text-[13px]" :style="{ background: avatarColor(selectedConversation.customers?.name) }">
              {{ (selectedConversation.customers?.name || '?').charAt(0) }}
            </div>
            <div>
              <div class="font-semibold text-[13.5px] flex items-center gap-2">
                {{ selectedConversation.customers?.name || '不明' }}
                <span class="text-[10px] font-semibold px-[7px] py-[1px] rounded-[5px]" :style="{ background: channelMeta(selectedConversation.channel).bg, color: channelMeta(selectedConversation.channel).txt }">{{ selectedConversation.channel }}</span>
              </div>
              <div class="text-[11px] text-[#9097a1] mt-0.5">{{ selectedConversation.customers?.line_uid || selectedConversation.customers?.email || '' }}</div>
            </div>
          </div>
          <button
            @click="$emit('toggleStatus', { id: selectedConversation.id, status: selectedConversation.status === '対応済み' ? '未対応' : '対応済み' })"
            :class="[
              'text-[11.5px] font-semibold px-3 py-1.5 rounded-[8px] border transition-colors',
              selectedConversation.status === '対応済み'
                ? 'bg-[#e6f8ee] text-[#06914a] border-[#c8f0d8]'
                : 'bg-white text-[#3a3f47] border-[#e6e8ec] hover:bg-[#f1f2f4]',
            ]"
          >{{ selectedConversation.status === '対応済み' ? '✓ 対応済み' : '対応済みにする' }}</button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
          <div
            v-for="m in inboxMessages"
            :key="m.id"
            :class="['flex flex-col max-w-[70%]', m.direction === 'outbound' ? 'items-end ml-auto' : 'items-start']"
          >
            <div
              :class="[
                'px-3.5 py-2.5 rounded-[14px] text-[13px] leading-relaxed whitespace-pre-wrap',
                m.direction === 'outbound' ? 'bg-[#4f46e5] text-white rounded-br-[4px]' : 'bg-white border border-[#ebedf0] rounded-bl-[4px]',
              ]"
            >{{ m.content }}</div>
            <div class="text-[10.5px] text-[#b0b6bf] mt-1">{{ formatTime(m.created_at) }}</div>
          </div>
          <div v-if="!inboxMessages || inboxMessages.length === 0" class="flex-1 flex items-center justify-center text-xs text-[#9097a1]">メッセージはまだありません</div>
        </div>

        <div class="px-5 py-3.5 border-t border-[#ebedf0] bg-white">
          <div class="border border-[#e0e3e8] rounded-[12px] p-2.5 bg-white">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-[11.5px] text-[#9097a1]">送信チャネル:</span>
              <span class="text-[10.5px] font-semibold px-2 py-[2px] rounded-[5px]" :style="{ background: channelMeta(selectedConversation.channel).bg, color: channelMeta(selectedConversation.channel).txt }">{{ selectedConversation.channel }}</span>
            </div>
            <textarea
              :value="inboxDraft"
              @input="$emit('update:inboxDraft', $event.target.value)"
              @keydown.enter.exact.prevent="$emit('send')"
              rows="2"
              class="w-full text-[13px] resize-none focus:outline-none"
              placeholder="メッセージを入力…"
            />
            <div class="flex items-center justify-end mt-2">
              <button
                @click="$emit('send')"
                :disabled="isSendingInbox || !inboxDraft?.trim()"
                class="bg-[#4f46e5] rounded-[8px] px-[18px] py-[7px] text-white font-medium text-[12.5px] hover:brightness-110 disabled:opacity-50 transition"
              >{{ isSendingInbox ? '送信中…' : '送信' }}</button>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="flex-1 flex items-center justify-center text-xs text-[#9097a1]">会話を選択してください</div>
    </div>

    <!-- 顧客パネル -->
    <aside v-if="selectedConversation" class="w-[260px] shrink-0 border-l border-[#ebedf0] bg-white overflow-y-auto p-5">
      <div class="flex flex-col items-center text-center pb-[18px] border-b border-[#f0f1f3]">
        <div class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-xl" :style="{ background: avatarColor(selectedConversation.customers?.name) }">
          {{ (selectedConversation.customers?.name || '?').charAt(0) }}
        </div>
        <div class="font-semibold text-sm mt-2.5">{{ selectedConversation.customers?.name }}</div>
        <div class="text-[11.5px] text-[#9097a1] mt-0.5">{{ selectedConversation.customers?.segment || '未診断' }}</div>
        <div class="flex gap-1.5 mt-3 flex-wrap justify-center">
          <span v-for="t in (selectedConversation.customers?.tags || [])" :key="t" class="bg-[#f1f2f4] text-[#5a606a] text-[10.5px] font-medium px-[9px] py-[3px] rounded-full">{{ t }}</span>
        </div>
      </div>
      <div class="pt-4">
        <h3 class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[11px]">顧客情報</h3>
        <div class="flex justify-between gap-3 py-[7px] border-b border-[#f4f5f6] text-xs">
          <span class="text-[#9097a1]">メール</span>
          <span class="font-medium text-right">{{ selectedConversation.customers?.email || '—' }}</span>
        </div>
        <div class="flex justify-between gap-3 py-[7px] border-b border-[#f4f5f6] text-xs">
          <span class="text-[#9097a1]">電話</span>
          <span class="font-medium text-right">{{ selectedConversation.customers?.phone || '—' }}</span>
        </div>
      </div>
    </aside>
  </div>
</template>
