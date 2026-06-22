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
  <header class="bg-slate-950 shrink-0 z-20 shadow-md">
    <div class="px-6 py-3 flex justify-between items-center border-b border-slate-800/60">
      <div class="flex items-center gap-3">
        <h1 class="text-sm font-black tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">AI OMNI CRM</h1>
        <span class="text-[9px] font-mono text-slate-600 bg-slate-900 px-2 py-0.5 rounded">{{ currentTenantId?.substring(0, 8) }}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-[11px] text-slate-400 hidden md:inline">{{ userEmail }}</span>
        <button @click="$emit('logout')" class="rounded-lg bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-400 border border-slate-700/50 hover:text-white hover:bg-slate-700 transition-colors">ログアウト</button>
      </div>
    </div>
    <nav class="px-6 flex gap-1 overflow-x-auto py-1.5">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="$emit('update:activeTab', tab.id)"
        :class="[
          'px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all shrink-0 flex items-center gap-1.5',
          activeTab === tab.id
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
        ]"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </header>
</template>
