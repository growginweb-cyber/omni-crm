<script setup>
import { ref } from 'vue'

const props = defineProps({
  currentTenantId: String,
  userEmail: String,
  activeTab: String,
  selectedChannel: String,
})
const emit = defineEmits(['update:activeTab', 'selectChannel', 'logout'])

const navGroups = [
  {
    label: 'ホーム',
    items: [
      { id: 'dashboard', label: 'ダッシュボード', icon: '📊' },
      { id: 'inbox', label: '受信トレイ', icon: '✉️' },
      { id: 'analytics', label: 'MAアナリティクス', icon: '📈' },
      { id: 'calendar', label: 'カレンダー', icon: '📅' },
    ],
  },
  {
    label: '配信',
    items: [
      { id: 'broadcast', label: 'ショット配信', icon: '🚀' },
      { id: 'scenarios', label: 'シナリオ格納庫', icon: '🗂️' },
      { id: 'autoreply', label: '自動応答', icon: '⚡' },
      {
        id: 'ai-content', label: 'コンテンツ作成', icon: '✨',
        children: [
          { channel: 'LINE', label: 'LINE', icon: '🟢' },
          { channel: 'Email', label: 'メール', icon: '📧' },
          { channel: 'SMS', label: 'SMS', icon: '💬' },
        ],
      },
    ],
  },
  {
    label: '集客・アクション',
    items: [
      { id: 'survey', label: '診断設計', icon: '📋' },
    ],
  },
  {
    label: '顧客管理',
    items: [
      { id: 'customers', label: '顧客管理', icon: '👥' },
      { id: 'tags', label: 'タグ・セグメント', icon: '🏷️' },
    ],
  },
  {
    label: 'テスト',
    items: [
      { id: 'user-liff', label: 'LIFF体験', icon: '📱' },
    ],
  },
  {
    label: '設定',
    items: [
      { id: 'settings', label: '設定', icon: '⚙️' },
    ],
  },
]

const expandedItems = ref(['ai-content'])

const toggleExpand = (id) => {
  const idx = expandedItems.value.indexOf(id)
  if (idx >= 0) expandedItems.value.splice(idx, 1)
  else expandedItems.value.push(id)
}

const handleParentClick = (item) => {
  toggleExpand(item.id)
  emit('update:activeTab', item.id)
}

const handleChildClick = (parentId, child) => {
  emit('update:activeTab', parentId)
  emit('selectChannel', child.channel)
}

const isExpanded = (id) => expandedItems.value.includes(id)
</script>

<template>
  <aside class="w-[230px] bg-white shrink-0 z-20 flex flex-col h-full border-r border-[#ebedf0]">
    <div class="px-3 pt-3 pb-1">
      <button class="w-full flex items-center gap-2.5 bg-[#f7f8fa] border border-[#ebedf0] rounded-[10px] px-2.5 py-2 hover:bg-[#f1f2f4] transition-colors">
        <div class="w-7 h-7 rounded-[8px] bg-indigo-600 flex items-center justify-center text-white font-bold text-[13px] shrink-0">A</div>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-semibold text-[12.5px] text-[#1a1d21] truncate">AI OMNI CRM</div>
          <div class="text-[10.5px] text-[#9097a1] truncate">{{ currentTenantId?.substring(0, 8) }}</div>
        </div>
        <span class="text-[11px] text-[#b0b6bf] shrink-0">⇅</span>
      </button>
    </div>
    <nav class="flex-1 px-3 pb-2 overflow-y-auto">
      <div v-for="(group, gi) in navGroups" :key="gi">
        <div v-if="group.label" class="px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[#aeb3bb] uppercase tracking-[.06em]">{{ group.label }}</div>
        <template v-for="item in group.items" :key="item.id">
          <!-- Item with children (expandable) -->
          <template v-if="item.children">
            <button
              @click="handleParentClick(item)"
              :class="[
                'flex items-center gap-2.5 px-2.5 py-[7px] rounded-[9px] text-[13px] w-full text-left transition-colors mb-0.5',
                activeTab === item.id
                  ? 'bg-[#ececfd] text-[#4f46e5] font-semibold'
                  : 'text-[#4a4f57] font-medium hover:bg-[#f1f2f4]',
              ]"
            >
              <span class="w-[18px] flex justify-center text-[14px]">{{ item.icon }}</span>
              <span class="flex-1">{{ item.label }}</span>
              <span class="text-[8px] text-[#b0b6bf] transition-transform" :class="isExpanded(item.id) ? 'rotate-90' : ''">▶</span>
            </button>
            <div v-if="isExpanded(item.id)" class="ml-[22px] border-l border-[#ebedf0] pl-1.5 mb-1">
              <button
                v-for="child in item.children"
                :key="child.channel"
                @click="handleChildClick(item.id, child)"
                :class="[
                  'flex items-center gap-2.5 px-2.5 py-[7px] rounded-[9px] text-[13px] w-full text-left transition-colors mb-0.5',
                  activeTab === item.id && selectedChannel === child.channel
                    ? 'bg-[#ececfd] text-[#4f46e5] font-semibold'
                    : 'text-[#4a4f57] font-medium hover:bg-[#f1f2f4]',
                ]"
              >
                <span class="w-[18px] flex justify-center text-[14px]">{{ child.icon }}</span>
                <span>{{ child.label }}</span>
              </button>
            </div>
          </template>
          <!-- Regular item -->
          <button
            v-else
            @click="$emit('update:activeTab', item.id)"
            :class="[
              'flex items-center gap-2.5 px-2.5 py-[7px] rounded-[9px] text-[13px] w-full text-left transition-colors mb-0.5',
              activeTab === item.id
                ? 'bg-[#ececfd] text-[#4f46e5] font-semibold'
                : 'text-[#4a4f57] font-medium hover:bg-[#f1f2f4]',
            ]"
          >
            <span class="w-[18px] flex justify-center text-[14px]">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </button>
        </template>
      </div>
    </nav>
    <div class="border-t border-[#f0f1f3] p-3">
      <div class="flex items-center gap-2 px-1 py-1">
        <div class="w-7 h-7 rounded-full bg-[#1a1d21] flex items-center justify-center text-white font-semibold text-[11px] shrink-0">{{ userEmail?.charAt(0)?.toUpperCase() }}</div>
        <div class="flex-1 min-w-0">
          <div class="text-[12px] font-semibold text-[#1a1d21] truncate">{{ userEmail?.split('@')[0] }}</div>
          <div class="text-[10.5px] text-[#9097a1] truncate">{{ userEmail }}</div>
        </div>
      </div>
      <button @click="$emit('logout')" class="w-full mt-1.5 border border-[#e6e8ec] rounded-[8px] px-2.5 py-1.5 text-[12px] text-[#3a3f47] hover:bg-[#f1f2f4] transition-colors">ログアウト</button>
    </div>
  </aside>
</template>
