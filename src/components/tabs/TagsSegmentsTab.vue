<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  customers: Array,
  savedSegments: Array,
})
const emit = defineEmits(['createSegment', 'deleteSegment'])

const tagGroups = computed(() => {
  if (!props.customers) return []
  const counts = {}
  props.customers.forEach(c => (c.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
  const tags = Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  if (tags.length === 0) return []
  return [{ label: '顧客タグ', tags }]
})

const segmentCounts = computed(() => {
  const counts = {}
  ;(props.customers || []).forEach(c => {
    const seg = c.segment || '未診断'
    counts[seg] = (counts[seg] || 0) + 1
  })
  return counts
})

const newSegmentName = ref('')
const newSegmentFilter = ref('')

const createSegment = () => {
  if (!newSegmentName.value.trim()) return
  emit('createSegment', { name: newSegmentName.value, segmentFilter: newSegmentFilter.value || null, tagFilter: [] })
  newSegmentName.value = ''
  newSegmentFilter.value = ''
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-[#fbfbfc]">
    <div class="sticky top-0 z-10 bg-[#fbfbfc] border-b border-[#ebedf0] px-7 py-[18px] flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-900">タグ・セグメント</h1>
        <p class="text-xs text-[#9097a1] mt-0.5">タグで顧客を分類し、条件を組み合わせてセグメント配信</p>
      </div>
    </div>

    <div class="px-7 py-6 flex gap-5 items-start max-w-[1200px]">
      <div class="flex-1 flex flex-col gap-[18px]">
        <div>
          <h3 class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[10px]">セグメント別顧客数</h3>
          <div class="flex gap-2 flex-wrap">
            <span
              v-for="(count, seg) in segmentCounts"
              :key="seg"
              class="inline-flex items-center gap-[7px] bg-white border border-[#e6e8ec] rounded-full px-3 py-[5px] text-xs font-medium"
            >
              {{ seg }}
              <span class="font-mono text-[#9097a1] text-[11px]">{{ count }}</span>
            </span>
          </div>
        </div>

        <div v-for="group in tagGroups" :key="group.label">
          <h3 class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[10px]">{{ group.label }}</h3>
          <div class="flex gap-2 flex-wrap">
            <span
              v-for="t in group.tags"
              :key="t.name"
              class="inline-flex items-center gap-[7px] bg-white border border-[#e6e8ec] rounded-full px-3 py-[5px] text-xs font-medium"
            >
              {{ t.name }}
              <span class="font-mono text-[#9097a1] text-[11px]">{{ t.count }}</span>
            </span>
          </div>
        </div>
        <div v-if="tagGroups.length === 0" class="text-xs text-[#9097a1]">顧客管理でタグを追加すると、ここに一覧表示されます</div>
      </div>

      <div class="w-[340px] shrink-0">
        <h3 class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-[10px]">保存済みセグメント</h3>
        <div class="flex flex-col gap-[9px] mb-4">
          <div
            v-for="s in savedSegments"
            :key="s.id"
            class="bg-white border border-[#ebedf0] rounded-[12px] px-[15px] py-[13px] group"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-[12.5px]">{{ s.name }}</span>
              <button @click="$emit('deleteSegment', s.id)" class="text-[#c2c7cf] hover:text-red-500 transition-colors text-xs opacity-0 group-hover:opacity-100">✕</button>
            </div>
            <div class="font-mono text-[#9097a1] text-[10.5px] mt-1.5 leading-relaxed">
              {{ s.segment_filter || 'すべて' }}<span v-if="s.tag_filter?.length"> ・ タグ: {{ s.tag_filter.join(', ') }}</span>
            </div>
          </div>
          <div v-if="!savedSegments || savedSegments.length === 0" class="text-[11px] text-[#9097a1]">保存済みセグメントはまだありません</div>
        </div>

        <div class="bg-white border border-[#ebedf0] rounded-[13px] p-4 flex flex-col gap-2.5">
          <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">＋ セグメント作成</div>
          <input
            v-model="newSegmentName"
            placeholder="セグメント名"
            class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]"
          />
          <select
            v-model="newSegmentFilter"
            class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]"
          >
            <option value="">すべて</option>
            <option value="集客最大化タイプ">集客最大化タイプ</option>
            <option value="コスト削減タイプ">コスト削減タイプ</option>
            <option value="未診断">未診断</option>
          </select>
          <button
            @click="createSegment"
            class="bg-[#4f46e5] rounded-[9px] py-[9px] text-[12.5px] text-white font-semibold hover:brightness-110 transition"
          >
            作成する
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
