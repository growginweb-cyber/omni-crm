<script setup>
defineProps({
  currentTenantId: String,
  userEmail: String,
  activeTab: String,
})
defineEmits(['update:activeTab', 'logout'])

const tabs = [
  { id: 'dashboard', label: 'ダッシュボード', icon: '📊' },
  { id: 'customers', label: '顧客管理', icon: '👥' },
  { id: 'scenarios', label: 'シナリオ設計', icon: '⚙️' },
  { id: 'survey', label: '診断設計', icon: '📋' },
  { id: 'ai-content', label: 'AI生成', icon: '✨' },
  { id: 'broadcast', label: '一斉配信', icon: '🚀' },
  { id: 'user-liff', label: 'LIFF体験', icon: '📱' },
]
</script>

<template>
  <aside class="w-56 bg-slate-950 shrink-0 z-20 flex flex-col h-full">
    <div class="px-5 py-4 border-b border-slate-800/60">
      <h1 class="text-sm font-black tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">AI OMNI CRM</h1>
      <span class="text-[9px] font-mono text-slate-600 bg-slate-900 px-2 py-0.5 rounded mt-1 inline-block">{{ currentTenantId?.substring(0, 8) }}</span>
    </div>
    <nav class="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="$emit('update:activeTab', tab.id)"
        :class="[
          'w-full px-3 py-2 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-2 text-left',
          activeTab === tab.id
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
        ]"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </nav>
    <div class="px-4 py-3 border-t border-slate-800/60">
      <span class="text-[10px] text-slate-500 block truncate mb-2">{{ userEmail }}</span>
      <button @click="$emit('logout')" class="w-full rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-[11px] text-slate-400 border border-slate-700/50 hover:text-white hover:bg-slate-700 transition-colors">ログアウト</button>
    </div>
  </aside>
</template>
