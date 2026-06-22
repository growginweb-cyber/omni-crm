<script setup>
defineProps({
  email: String,
  password: String,
  loading: Boolean,
})
defineEmits(['update:email', 'update:password', 'login'])
</script>

<template>
  <div class="flex-1 flex items-center justify-center bg-slate-950">
    <div class="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100">
      <h2 class="text-xl font-black text-slate-900 mb-2 tracking-tight">AI OMNI CRM</h2>
      <p class="text-xs text-slate-400 mb-6">次世代のマルチチャネル自動化システム</p>
      <div class="space-y-4">
        <div>
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">メールアドレス</label>
          <input
            :value="email"
            @input="$emit('update:email', $event.target.value)"
            type="email"
            class="mt-1 w-full rounded-xl border p-3 text-xs bg-slate-50 focus:outline-none"
            placeholder="admin@example.com"
          >
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">パスワード</label>
          <input
            :value="password"
            @input="$emit('update:password', $event.target.value)"
            type="password"
            class="mt-1 w-full rounded-xl border p-3 text-xs bg-slate-50 focus:outline-none"
            placeholder="••••••••"
          >
        </div>
        <button @click="$emit('login')" :disabled="loading" class="w-full bg-slate-900 text-white p-3 rounded-xl text-xs font-bold hover:bg-slate-800 transition">
          {{ loading ? 'ログイン中...' : 'システムにログイン' }}
        </button>
      </div>
    </div>
  </div>
</template>
