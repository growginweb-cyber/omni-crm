<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  userEmail: String,
  teamMembers: Array,
  currentUserId: String,
  integrationConfigs: Array,
  tenantInvites: Array,
})
const emit = defineEmits(['updateDisplayName', 'saveIntegration', 'toggleIntegration', 'deleteIntegration', 'inviteMember', 'cancelInvite'])

const myName = ref('')
const me = () => (props.teamMembers || []).find(m => m.id === props.currentUserId)

const saveMyName = () => {
  if (!myName.value.trim()) return
  emit('updateDisplayName', myName.value)
}

const newInviteEmail = ref('')
const pendingInvites = computed(() => (props.tenantInvites || []).filter(i => !i.accepted))
const sendInvite = () => {
  if (!newInviteEmail.value.trim()) return
  emit('inviteMember', newInviteEmail.value)
  newInviteEmail.value = ''
}

const providerOptions = [
  { value: 'custom', label: 'カスタム / 汎用Webhook' },
  { value: 'hrmos', label: 'HRMOS' },
  { value: 'jobcan', label: 'ジョブカン' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'hubspot', label: 'HubSpot' },
]
const newProvider = ref('custom')
const newWebhookUrl = ref('')

const addIntegration = () => {
  emit('saveIntegration', { provider: newProvider.value, webhookUrl: newWebhookUrl.value })
  newWebhookUrl.value = ''
}

const providerLabel = (v) => providerOptions.find(p => p.value === v)?.label || v
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-[#fbfbfc]">
    <div class="sticky top-0 z-10 bg-[#fbfbfc] border-b border-[#ebedf0] px-7 py-[18px]">
      <h1 class="text-lg font-semibold text-slate-900">設定</h1>
      <p class="text-xs text-[#9097a1] mt-0.5">プロフィール・チームメンバー・外部連携を管理</p>
    </div>

    <div class="px-7 py-6 max-w-[860px] flex flex-col gap-6">
      <!-- プロフィール -->
      <section>
        <h2 class="text-[13.5px] font-semibold mb-3">プロフィール</h2>
        <div class="bg-white border border-[#ebedf0] rounded-[13px] p-[18px] flex items-center gap-4">
          <div class="w-11 h-11 rounded-full bg-[#1a1d21] flex items-center justify-center text-white font-semibold text-sm shrink-0">{{ (userEmail || '?').charAt(0).toUpperCase() }}</div>
          <div class="flex-1 min-w-0">
            <div class="text-[11px] text-[#9097a1] mb-1">{{ userEmail }}</div>
            <input
              v-model="myName"
              :placeholder="me()?.display_name || '表示名を入力'"
              class="w-full bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2 text-[12.5px] focus:outline-none focus:border-[#4f46e5]"
            />
          </div>
          <button @click="saveMyName" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-2 text-[12.5px] text-white font-medium hover:brightness-110 transition shrink-0">保存</button>
        </div>
      </section>

      <!-- チームメンバー -->
      <section>
        <h2 class="text-[13.5px] font-semibold mb-3">チームメンバー</h2>
        <div class="bg-white border border-[#ebedf0] rounded-[13px] overflow-hidden">
          <div v-for="m in teamMembers" :key="m.id" class="flex items-center gap-3 px-[18px] py-3 border-b border-[#f4f5f6] last:border-0">
            <div class="w-8 h-8 rounded-full bg-[#4f46e5] flex items-center justify-center text-white font-semibold text-xs shrink-0">{{ (m.display_name || m.id).charAt(0).toUpperCase() }}</div>
            <span class="text-[12.5px] font-medium flex-1">{{ m.display_name || '未設定 (' + m.id.slice(0, 8) + ')' }}</span>
            <span v-if="m.id === currentUserId" class="text-[10.5px] font-semibold text-[#4f46e5] bg-[#ececfd] rounded-full px-2 py-0.5">自分</span>
          </div>
          <div v-if="!teamMembers || teamMembers.length === 0" class="px-[18px] py-6 text-center text-[11px] text-[#9097a1]">メンバーがいません</div>
        </div>

        <!-- 招待中 -->
        <div v-if="pendingInvites.length > 0" class="bg-white border border-[#ebedf0] rounded-[13px] overflow-hidden mt-3">
          <div v-for="inv in pendingInvites" :key="inv.id" class="flex items-center gap-3 px-[18px] py-3 border-b border-[#f4f5f6] last:border-0">
            <div class="w-8 h-8 rounded-full bg-[#f1f2f4] flex items-center justify-center text-[#9097a1] text-xs shrink-0">✉</div>
            <span class="text-[12.5px] font-medium flex-1 text-[#3a3f47]">{{ inv.email }}</span>
            <span class="text-[10.5px] font-semibold text-[#b45309] bg-amber-50 rounded-full px-2 py-0.5 shrink-0">招待中</span>
            <button @click="$emit('cancelInvite', inv.id)" class="text-[#c2c7cf] hover:text-red-500 text-xs shrink-0">✕</button>
          </div>
        </div>

        <div class="bg-white border border-[#ebedf0] rounded-[13px] p-[18px] flex flex-col gap-2.5 mt-3">
          <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">＋ メンバーを招待</div>
          <div class="flex gap-2">
            <input
              v-model="newInviteEmail"
              @keydown.enter="sendInvite"
              type="email"
              placeholder="member@example.com"
              class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] focus:outline-none focus:border-[#4f46e5]"
            />
            <button @click="sendInvite" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-2 text-[12.5px] text-white font-semibold hover:brightness-110 transition shrink-0">招待</button>
          </div>
          <p class="text-[10.5px] text-[#9097a1] leading-relaxed">招待するとこのメールアドレスが登録待ちになります。招待済みのメールで新規ログインアカウントが作成されると、自動的にこのワークスペースに参加します。</p>
        </div>
      </section>

      <!-- 外部CRM/ATS連携 -->
      <section>
        <h2 class="text-[13.5px] font-semibold mb-1">外部CRM/ATS連携</h2>
        <p class="text-[11px] text-[#9097a1] mb-3">選考パイプラインの状況を外部システムへWebhook連携します（接続先は今後拡張予定）</p>
        <div class="bg-white border border-[#ebedf0] rounded-[13px] overflow-hidden mb-3">
          <div v-for="c in integrationConfigs" :key="c.id" class="flex items-center gap-3 px-[18px] py-3 border-b border-[#f4f5f6] last:border-0">
            <div class="flex-1 min-w-0">
              <div class="text-[12.5px] font-semibold">{{ providerLabel(c.provider) }}</div>
              <div class="text-[10.5px] text-[#9097a1] font-mono truncate mt-0.5">{{ c.webhook_url || 'URL未設定' }}</div>
            </div>
            <div
              @click="$emit('toggleIntegration', { id: c.id, enabled: !c.enabled })"
              :style="{ background: c.enabled ? '#4f46e5' : '#d6d9de' }"
              class="w-[34px] h-[19px] rounded-full relative cursor-pointer transition-colors shrink-0"
            >
              <div class="absolute top-[2px] w-[15px] h-[15px] rounded-full bg-white transition-all" :style="{ left: c.enabled ? '17px' : '2px' }"></div>
            </div>
            <button @click="$emit('deleteIntegration', c.id)" class="text-[#c2c7cf] hover:text-red-500 text-xs shrink-0">✕</button>
          </div>
          <div v-if="!integrationConfigs || integrationConfigs.length === 0" class="px-[18px] py-6 text-center text-[11px] text-[#9097a1]">連携先はまだありません</div>
        </div>
        <div class="bg-white border border-[#ebedf0] rounded-[13px] p-[18px] flex flex-col gap-2.5">
          <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">＋ 連携先を追加</div>
          <select v-model="newProvider" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]">
            <option v-for="p in providerOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
          <input
            v-model="newWebhookUrl"
            placeholder="https://example.com/webhook"
            class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full font-mono focus:outline-none focus:border-[#4f46e5]"
          />
          <button @click="addIntegration" class="self-start bg-[#4f46e5] rounded-[9px] px-4 py-2 text-[12.5px] text-white font-semibold hover:brightness-110 transition">追加する</button>
        </div>
      </section>
    </div>
  </div>
</template>
