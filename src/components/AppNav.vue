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
    items: [
      { id: 'dashboard', label: 'ダッシュボード', icon: '📊' },
      { id: 'analytics', label: 'MAアナリティクス', icon: '📈' },
    ],
  },
  {
    label: '顧客・配信',
    items: [
      { id: 'customers', label: '顧客管理', icon: '👥' },
      { id: 'broadcast', label: 'ショット配信', icon: '🚀' },
    ],
  },
  {
    label: '設計・作成',
    items: [
      {
        id: 'ai-content', label: 'コンテンツ作成', icon: '✨',
        children: [
          { channel: 'LINE', label: 'LINE', icon: '🟢' },
          { channel: 'Email', label: 'メール', icon: '📧' },
          { channel: 'SMS', label: 'SMS', icon: '💬' },
        ],
      },
      { id: 'scenarios', label: 'ステップ配信', icon: '⚙️' },
      { id: 'survey', label: '診断設計', icon: '📋' },
    ],
  },
  {
    label: 'テスト',
    items: [
      { id: 'user-liff', label: 'LIFF体験', icon: '📱' },
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
  <aside class="w-[230px] bg-white shrink-0 z-20 flex flex-col h-full border-r border-slate-200/70">
    <div class="px-4 pt-4 pb-3">
      <button class="w-full flex items-center gap-2.5 bg-slate-50 border border-slate-200/70 rounded-[10px] px-2.5 py-2 hover:bg-slate-100/80 transition-colors">
        <div class="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-[13px] shrink-0">A</div>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-semibold text-[12.5px] text-slate-900 truncate">AI OMNI CRM</div>
          <div class="text-slate-400 text-[10px] font-mono truncate">{{ currentTenantId?.substring(0, 8) }}</div>
        </div>
      </button>
    </div>
    <nav class="flex-1 px-3 pb-2 overflow-y-auto">
      <div v-for="(group, gi) in navGroups" :key="gi" :class="gi > 0 ? 'mt-1' : ''">
        <div v-if="group.label" class="px-2.5 pt-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{{ group.label }}</div>
        <template v-for="item in group.items" :key="item.id">
          <!-- Item with children (expandable) -->
          <template v-if="item.children">
            <button
              @click="handleParentClick(item)"
              :class="[
                'w-full px-2.5 py-[7px] text-[13px] font-medium rounded-[9px] transition-all flex items-center gap-2.5 text-left mb-0.5',
                activeTab === item.id
                  ? 'bg-indigo-50 text-indigo-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100/70',
              ]"
            >
              <span class="w-[18px] flex justify-center text-sm">{{ item.icon }}</span>
              <span class="flex-1">{{ item.label }}</span>
              <span class="text-[8px] text-slate-400 transition-transform" :class="isExpanded(item.id) ? 'rotate-90' : ''">▶</span>
            </button>
            <div v-if="isExpanded(item.id)" class="ml-[26px] border-l border-slate-200 pl-2 mb-1">
              <button
                v-for="child in item.children"
                :key="child.channel"
                @click="handleChildClick(item.id, child)"
                :class="[
                  'w-full px-2.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-all flex items-center gap-2 text-left mb-0.5',
                  activeTab === item.id && selectedChannel === child.channel
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100/70',
                ]"
              >
                <span class="text-xs">{{ child.icon }}</span>
                <span>{{ child.label }}</span>
              </button>
            </div>
          </template>
          <!-- Regular item -->
          <button
            v-else
            @click="$emit('update:activeTab', item.id)"
            :class="[
              'w-full px-2.5 py-[7px] text-[13px] font-medium rounded-[9px] transition-all flex items-center gap-2.5 text-left mb-0.5',
              activeTab === item.id
                ? 'bg-indigo-50 text-indigo-600 font-semibold'
                : 'text-slate-600 hover:bg-slate-100/70',
            ]"
          >
            <span class="w-[18px] flex justify-center text-sm">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </button>
        </template>
      </div>
    </nav>
    <div class="px-3 py-3 border-t border-slate-200/70">
      <div class="flex items-center gap-2 px-1.5 py-1">
        <div class="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-white font-semibold text-[11px] shrink-0">{{ userEmail?.charAt(0)?.toUpperCase() }}</div>
        <span class="text-[11px] text-slate-500 truncate flex-1">{{ userEmail }}</span>
      </div>
      <button @click="$emit('logout')" class="w-full mt-1.5 rounded-[8px] bg-white px-2.5 py-1.5 text-[11px] text-slate-500 border border-slate-200 hover:text-slate-900 hover:bg-slate-50 transition-colors">ログアウト</button>
    </div>
  </aside>
</template>
