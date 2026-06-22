<script setup>
defineProps({
  newCustomer: Object,
  isSaving: Boolean,
})
defineEmits(['update:newCustomer', 'close', 'save'])
</script>

<template>
  <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
      <h3 class="text-base font-bold text-slate-900 mb-4">✨ テスト用顧客の追加</h3>
      <div class="space-y-4 mb-6">
        <div>
          <label class="text-[10px] font-bold text-slate-400 uppercase">お名前</label>
          <input
            :value="newCustomer.name"
            @input="$emit('update:newCustomer', { ...newCustomer, name: $event.target.value })"
            class="mt-1 w-full border p-2 text-xs rounded-lg focus:outline-none"
            placeholder="例: テスト用 アカウント"
          >
        </div>
        <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
          <label class="text-[10px] font-bold text-emerald-600 uppercase">🟢 送信先のLINEユーザーID</label>
          <input
            :value="newCustomer.line_uid"
            @input="$emit('update:newCustomer', { ...newCustomer, line_uid: $event.target.value })"
            class="mt-1 w-full border border-emerald-200 bg-white p-2 text-xs rounded-lg font-mono focus:outline-none"
            placeholder="Uから始まる別アカウントのID"
          >
        </div>
      </div>
      <div class="flex gap-3">
        <button @click="$emit('close')" class="flex-1 bg-slate-50 text-slate-500 py-2 rounded-xl text-xs font-bold">キャンセル</button>
        <button @click="$emit('save')" :disabled="isSaving" class="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold">保存</button>
      </div>
    </div>
  </div>
</template>
