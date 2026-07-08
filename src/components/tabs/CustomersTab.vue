<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  customers: Array,
  selectedSegment: String,
  selectedCustomer: Object,
  stepQueues: Array,
})
const emit = defineEmits(['update:selectedSegment', 'update:selectedCustomer', 'openModal', 'fetchCustomers', 'updateSegment', 'addTag', 'removeTag'])

const searchQuery = ref('')
const tagFilter = ref('')

const allTags = computed(() => {
  if (!props.customers) return []
  const set = new Set()
  props.customers.forEach(c => (c.tags || []).forEach(t => set.add(t)))
  return [...set].sort()
})

const filteredCustomers = computed(() => {
  if (!props.customers) return []
  let list = props.customers
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    )
  }
  if (tagFilter.value) {
    list = list.filter(c => (c.tags || []).includes(tagFilter.value))
  }
  return list
})

const avatarColor = (name) => {
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500']
  const code = (name || '').charCodeAt(0) || 0
  return colors[code % colors.length]
}

const avatarInitial = (name) => (name || '?').charAt(0)

// Presentation-only: status-dot colors per segment (Unibox pattern)
const segmentDot = (seg) => {
  if (seg === '集客最大化タイプ') return { text: 'text-[#06914a]', dot: 'bg-[#06914a]' }
  if (seg === 'コスト削減タイプ') return { text: 'text-[#b45309]', dot: 'bg-[#b45309]' }
  if (seg === '未診断' || !seg) return { text: 'text-[#9097a1]', dot: 'bg-[#9097a1]' }
  return { text: 'text-[#4f46e5]', dot: 'bg-[#4f46e5]' }
}

// Presentation-only: linked channel helpers
const hasLine = (c) => !!(c?.line_uid && c.line_uid !== '未連携')
const hasEmail = (c) => !!c?.email
const hasPhone = (c) => !!c?.phone

const statusClass = (status) => {
  if (status === '送信成功') return 'text-[#06914a] bg-[#06914a]/10'
  if (status === '送信失敗') return 'text-red-600 bg-red-50'
  if (status === '送信スキップ') return 'text-[#9097a1] bg-[#f1f2f4]'
  return 'text-[#b45309] bg-amber-50 animate-pulse'
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

const segments = ['ALL', '集客最大化タイプ', 'コスト削減タイプ', '未診断']
const allSegments = ['集客最大化タイプ', 'コスト削減タイプ', '未診断']

const newTag = ref('')
const addTag = () => {
  const tag = newTag.value.trim()
  if (!tag || !props.selectedCustomer) return
  emit('addTag', { id: props.selectedCustomer.id, tag })
  newTag.value = ''
}
</script>

<template>
  <div class="flex-1 flex overflow-hidden bg-[#fbfbfc]">
    <!-- Left: Customer list -->
    <main class="flex-[3] flex flex-col border-r border-[#ebedf0] overflow-hidden">
      <!-- Header -->
      <div class="sticky top-0 z-10 bg-[#fbfbfc] border-b border-[#ebedf0] px-7 py-[18px] shrink-0">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-baseline gap-2">
            <h2 class="text-[16px] font-semibold text-[#1b1f24]">顧客管理</h2>
            <span class="font-mono text-[11px] text-[#9097a1]">{{ filteredCustomers.length }}件</span>
          </div>
          <button @click="$emit('openModal')" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-[7px] text-[12.5px] text-white font-medium hover:bg-[#4338ca] transition-colors">＋ 顧客を追加</button>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex-1 flex items-center gap-[7px] bg-white border border-[#e6e8ec] rounded-[9px] px-3 py-[7px] text-[12.5px]">
            <span class="text-[#9097a1]">🔍</span>
            <input
              v-model="searchQuery"
              class="flex-1 bg-transparent text-[12.5px] placeholder-[#9097a1] focus:outline-none"
              placeholder="名前・メールで検索..."
            />
          </div>
          <select v-if="allTags.length" v-model="tagFilter" class="bg-white border border-[#e6e8ec] rounded-[9px] px-2.5 py-[7px] text-[12px] focus:outline-none max-w-[130px]">
            <option value="">タグ絞り込み</option>
            <option v-for="tag in allTags" :key="tag" :value="tag">🏷 {{ tag }}</option>
          </select>
        </div>
      </div>

      <!-- Segment tabs -->
      <div class="flex gap-1 px-7 py-2 border-b border-[#ebedf0] shrink-0">
        <button
          v-for="seg in segments"
          :key="seg"
          @click="$emit('update:selectedSegment', seg); $emit('fetchCustomers')"
          :class="[
            'px-3 py-1 text-[11px] font-semibold rounded-[7px] transition-all whitespace-nowrap',
            selectedSegment === seg
              ? 'bg-white text-[#4f46e5] shadow-sm border border-[#ebedf0]'
              : 'text-[#9097a1] hover:text-[#3a3f47]',
          ]"
        >
          {{ seg }}
        </button>
      </div>

      <!-- Table -->
      <div class="flex-1 overflow-y-auto bg-white">
        <div class="sticky top-0 z-10 grid gap-3 px-[18px] py-[11px] bg-[#fafbfc] border-b border-[#ebedf0] text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.03em]" style="grid-template-columns: 1.8fr 1fr 1.2fr 1.1fr">
          <div>名前</div>
          <div>連携チャネル</div>
          <div>タグ</div>
          <div>セグメント</div>
        </div>
        <div
          v-for="c in filteredCustomers"
          :key="c.id"
          @click="$emit('update:selectedCustomer', c)"
          class="grid gap-3 px-[18px] py-[13px] border-b border-[#f4f5f6] items-center cursor-pointer transition-colors"
          :class="selectedCustomer?.id === c.id ? 'bg-[#eef2ff]' : 'hover:bg-[#f7f8fa]'"
          style="grid-template-columns: 1.8fr 1fr 1.2fr 1.1fr"
        >
          <!-- 名前 -->
          <div class="flex items-center gap-2.5 min-w-0">
            <div :class="[avatarColor(c.name), 'w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0']">
              {{ avatarInitial(c.name) }}
            </div>
            <div class="min-w-0">
              <div class="text-[12.5px] font-medium text-[#1b1f24] truncate">{{ c.name }}</div>
              <div class="text-[11px] text-[#9097a1] font-mono truncate">{{ hasLine(c) ? c.line_uid : '' }}</div>
            </div>
          </div>
          <!-- 連携チャネル -->
          <div class="flex items-center gap-1.5">
            <span v-if="hasLine(c)" class="w-5 h-5 rounded-[5px] bg-[#06C755] text-white text-[10px] font-bold flex items-center justify-center" title="LINE">L</span>
            <span v-if="hasEmail(c)" class="w-5 h-5 rounded-[5px] bg-[#3B6EF5] text-white text-[10px] font-bold flex items-center justify-center" title="メール">@</span>
            <span v-if="hasPhone(c)" class="w-5 h-5 rounded-[5px] bg-[#8B5CF6] text-white text-[10px] font-bold flex items-center justify-center" title="SMS">S</span>
            <span v-if="!hasLine(c) && !hasEmail(c) && !hasPhone(c)" class="text-[11px] text-[#b0b6bf]">—</span>
          </div>
          <!-- タグ -->
          <div class="flex items-center gap-1 flex-wrap min-w-0">
            <span
              v-for="tag in (c.tags || []).slice(0, 2)"
              :key="tag"
              class="bg-[#f1f2f4] text-[#5a606a] text-[10.5px] px-2 py-0.5 rounded-full whitespace-nowrap"
            >{{ tag }}</span>
            <span v-if="(c.tags || []).length > 2" class="text-[10.5px] text-[#9097a1]">+{{ c.tags.length - 2 }}</span>
            <span v-if="!(c.tags?.length)" class="text-[11px] text-[#b0b6bf]">—</span>
          </div>
          <!-- セグメント -->
          <div>
            <span class="inline-flex items-center gap-[5px] text-[11.5px] font-medium whitespace-nowrap" :class="segmentDot(c.segment).text">
              <span class="w-[6px] h-[6px] rounded-full" :class="segmentDot(c.segment).dot"></span>
              {{ c.segment || '未診断' }}
            </span>
          </div>
        </div>
        <div v-if="filteredCustomers.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
          <p class="text-[12px] text-[#9097a1]">顧客が見つかりません</p>
        </div>
      </div>
    </main>

    <!-- Right: Detail / Timeline -->
    <aside class="flex-[2] bg-white overflow-y-auto flex flex-col">
      <template v-if="selectedCustomer">
        <!-- Customer detail header -->
        <div class="px-6 pt-6 pb-4 border-b border-[#f4f5f6] flex flex-col items-center text-center">
          <div :class="[avatarColor(selectedCustomer.name), 'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white mb-2.5']">
            {{ avatarInitial(selectedCustomer.name) }}
          </div>
          <h3 class="text-[14px] font-semibold text-[#1b1f24]">{{ selectedCustomer.name }}</h3>
          <div class="flex flex-wrap justify-center gap-1 mt-1.5">
            <span
              v-for="tag in (selectedCustomer.tags || [])"
              :key="tag"
              class="bg-[#f1f2f4] text-[#5a606a] text-[10.5px] px-2 py-0.5 rounded-full"
            >{{ tag }}</span>
          </div>
          <select
            :value="selectedCustomer.segment || '未診断'"
            @change="emit('updateSegment', { id: selectedCustomer.id, segment: $event.target.value })"
            class="mt-2.5 bg-white border border-[#e6e8ec] rounded-[9px] px-2.5 py-1 text-[11.5px] font-medium cursor-pointer focus:outline-none"
            :class="segmentDot(selectedCustomer.segment).text"
          >
            <option v-for="s in allSegments" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <!-- 顧客情報 -->
        <div class="px-6 py-4 border-b border-[#f4f5f6]">
          <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-1.5">顧客情報</div>
          <div class="flex justify-between py-[7px] border-b border-[#f4f5f6] text-[12px]">
            <span class="text-[#9097a1]">メール</span>
            <span class="font-medium text-[#1b1f24] text-right">{{ selectedCustomer.email || '—' }}</span>
          </div>
          <div class="flex justify-between py-[7px] border-b border-[#f4f5f6] text-[12px]">
            <span class="text-[#9097a1]">電話</span>
            <span class="font-medium text-[#1b1f24] text-right">{{ selectedCustomer.phone || '—' }}</span>
          </div>
          <div class="flex justify-between py-[7px] border-b border-[#f4f5f6] text-[12px]">
            <span class="text-[#9097a1]">LINE UID</span>
            <span class="font-medium text-[#1b1f24] font-mono text-[11px] truncate max-w-[160px] text-right">{{ selectedCustomer.line_uid || '—' }}</span>
          </div>
          <div class="flex justify-between py-[7px] border-b border-[#f4f5f6] text-[12px]">
            <span class="text-[#9097a1]">登録日</span>
            <span class="font-medium text-[#1b1f24] text-right">{{ selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleDateString() : '—' }}</span>
          </div>
        </div>

        <!-- 連携チャネル -->
        <div class="px-6 py-4 border-b border-[#f4f5f6]">
          <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-2">連携チャネル</div>
          <div class="space-y-1.5">
            <div class="flex items-center gap-[9px] px-2.5 py-2 bg-[#f7f8fa] rounded-[9px]">
              <span class="w-5 h-5 rounded-[5px] bg-[#06C755] text-white text-[10px] font-bold flex items-center justify-center">L</span>
              <span class="flex-1 text-[12px] font-medium text-[#3a3f47]">LINE</span>
              <span class="text-[11px] font-medium" :class="hasLine(selectedCustomer) ? 'text-[#06914a]' : 'text-[#b0b6bf]'">{{ hasLine(selectedCustomer) ? '接続済み' : '未連携' }}</span>
            </div>
            <div class="flex items-center gap-[9px] px-2.5 py-2 bg-[#f7f8fa] rounded-[9px]">
              <span class="w-5 h-5 rounded-[5px] bg-[#3B6EF5] text-white text-[10px] font-bold flex items-center justify-center">@</span>
              <span class="flex-1 text-[12px] font-medium text-[#3a3f47]">メール</span>
              <span class="text-[11px] font-medium" :class="hasEmail(selectedCustomer) ? 'text-[#06914a]' : 'text-[#b0b6bf]'">{{ hasEmail(selectedCustomer) ? '接続済み' : '未連携' }}</span>
            </div>
            <div class="flex items-center gap-[9px] px-2.5 py-2 bg-[#f7f8fa] rounded-[9px]">
              <span class="w-5 h-5 rounded-[5px] bg-[#8B5CF6] text-white text-[10px] font-bold flex items-center justify-center">S</span>
              <span class="flex-1 text-[12px] font-medium text-[#3a3f47]">SMS</span>
              <span class="text-[11px] font-medium" :class="hasPhone(selectedCustomer) ? 'text-[#06914a]' : 'text-[#b0b6bf]'">{{ hasPhone(selectedCustomer) ? '接続済み' : '未連携' }}</span>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div class="px-6 py-4 border-b border-[#f4f5f6]">
          <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-2">タグ</div>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="tag in (selectedCustomer.tags || [])"
              :key="tag"
              class="inline-flex items-center gap-1 bg-[#f1f2f4] text-[#5a606a] text-[10.5px] px-2 py-0.5 rounded-full"
            >
              {{ tag }}
              <button @click="emit('removeTag', { id: selectedCustomer.id, tag })" class="text-[#9097a1] hover:text-red-500 transition-colors leading-none">✕</button>
            </span>
            <span v-if="!(selectedCustomer.tags?.length)" class="text-[11px] text-[#b0b6bf]">タグなし</span>
          </div>
          <div class="flex gap-1.5">
            <input
              v-model="newTag"
              @keydown.enter.prevent="addTag"
              class="flex-1 bg-white border border-[#e6e8ec] rounded-[9px] px-3 py-[7px] text-[12px] placeholder-[#9097a1] focus:outline-none focus:border-[#4f46e5]"
              placeholder="タグを追加..."
            />
            <button @click="addTag" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-[7px] text-[11.5px] text-white font-medium hover:bg-[#4338ca] transition-colors">追加</button>
          </div>
        </div>
      </template>

      <!-- Timeline -->
      <div class="px-6 py-4 flex-1">
        <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-3">配信タイムライン</div>
        <div v-if="stepQueues.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
          <p class="text-[12px] text-[#9097a1]">配信キューはまだありません</p>
        </div>
        <div v-else class="space-y-2">
          <div v-for="queue in stepQueues" :key="queue.id" class="bg-white border border-[#ebedf0] rounded-[9px] px-3 py-2.5 flex flex-col gap-1">
            <div class="flex justify-between items-center">
              <span class="text-[12.5px] font-medium text-[#1b1f24]">{{ queue.customers?.name }}</span>
              <span :class="['px-2 py-0.5 rounded-full text-[10.5px] font-medium', statusClass(queue.status)]">{{ queue.status }}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-[#9097a1]">
              <div class="flex items-center gap-1.5">
                <span class="font-semibold text-[#4f46e5]">Step {{ queue.step_number }}</span>
                <span>·</span>
                <span>{{ queue.delivery_channel }}</span>
              </div>
              <div class="font-mono tabular-nums">{{ formatTime(queue.scheduled_at) }}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
