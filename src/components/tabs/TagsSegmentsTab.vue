<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  customers: Array,
  savedSegments: Array,
  tagGroups: Array,
  tagDefinitions: Array,
})
const emit = defineEmits([
  'createSegment', 'deleteSegment',
  'createTagGroup', 'deleteTagGroup',
  'createTagDefinition', 'assignTagToGroup', 'deleteTagDefinition',
])

const tagUsageCounts = computed(() => {
  const counts = {}
  ;(props.customers || []).forEach(c => (c.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
  return counts
})

// グループごとにタグをまとめる（未分類含む）
const groupedTags = computed(() => {
  const defs = props.tagDefinitions || []
  const groups = (props.tagGroups || []).map(g => ({
    id: g.id,
    name: g.name,
    tags: defs.filter(t => t.group_id === g.id).map(t => ({ ...t, count: tagUsageCounts.value[t.name] || 0 })),
  }))
  const ungroupedDefs = defs.filter(t => !t.group_id).map(t => ({ ...t, count: tagUsageCounts.value[t.name] || 0 }))
  groups.push({ id: null, name: '未分類', tags: ungroupedDefs })
  return groups
})

// 顧客には付いているが、タグ定義としてまだ登録されていないタグ
const unregisteredTags = computed(() => {
  const defNames = new Set((props.tagDefinitions || []).map(t => t.name))
  return Object.entries(tagUsageCounts.value)
    .filter(([name]) => !defNames.has(name))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

const segmentCounts = computed(() => {
  const counts = {}
  ;(props.customers || []).forEach(c => {
    const seg = c.segment || '未診断'
    counts[seg] = (counts[seg] || 0) + 1
  })
  return counts
})

const newGroupName = ref('')
const createGroup = () => {
  if (!newGroupName.value.trim()) return
  emit('createTagGroup', newGroupName.value)
  newGroupName.value = ''
}

const newTagName = ref('')
const newTagGroupId = ref('')
const createTag = () => {
  if (!newTagName.value.trim()) return
  emit('createTagDefinition', { name: newTagName.value, groupId: newTagGroupId.value || null })
  newTagName.value = ''
}

const registerExistingTag = (name, groupId) => {
  emit('createTagDefinition', { name, groupId: groupId || null })
}

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
        <p class="text-xs text-[#9097a1] mt-0.5">タグをグループ化して整理し、条件を組み合わせてセグメント配信</p>
      </div>
    </div>

    <div class="px-7 py-6 flex gap-5 items-start max-w-[1280px]">
      <div class="flex-1 flex flex-col gap-[22px]">
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

        <!-- タググループ -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">タググループ</h3>
          </div>

          <div class="flex flex-col gap-3">
            <div
              v-for="group in groupedTags"
              :key="group.id ?? 'ungrouped'"
              class="bg-white border border-[#ebedf0] rounded-[13px] p-4"
            >
              <div class="flex items-center justify-between mb-2.5">
                <span class="text-[12.5px] font-bold text-slate-800 flex items-center gap-1.5">
                  <span v-if="group.id" class="w-2 h-2 rounded-[2px] bg-[#4f46e5]"></span>
                  <span v-else class="w-2 h-2 rounded-[2px] bg-[#c2c7cf]"></span>
                  {{ group.name }}
                  <span class="font-mono text-[10px] text-[#9097a1] font-normal">{{ group.tags.length }}</span>
                </span>
                <button v-if="group.id" @click="$emit('deleteTagGroup', group.id)" class="text-[10.5px] text-[#c2c7cf] hover:text-red-500 transition-colors">グループ削除</button>
              </div>
              <div v-if="group.tags.length === 0" class="text-[11px] text-[#c2c7cf]">タグがありません</div>
              <div v-else class="flex gap-1.5 flex-wrap">
                <div
                  v-for="t in group.tags"
                  :key="t.id"
                  class="group/tag inline-flex items-center gap-1.5 bg-[#f7f8fa] border border-[#e6e8ec] rounded-full pl-3 pr-1.5 py-1"
                >
                  <span class="text-[11.5px] font-medium text-slate-700">{{ t.name }}</span>
                  <span class="font-mono text-[10px] text-[#9097a1]">{{ t.count }}</span>
                  <select
                    :value="t.group_id || ''"
                    @change="$emit('assignTagToGroup', { id: t.id, groupId: $event.target.value || null })"
                    class="text-[9.5px] bg-transparent text-[#9097a1] border-none focus:outline-none opacity-0 group-hover/tag:opacity-100 transition-opacity w-3 cursor-pointer"
                    title="グループを移動"
                  >
                    <option value="">未分類</option>
                    <option v-for="g in tagGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
                  </select>
                  <button @click="$emit('deleteTagDefinition', t.id)" class="text-[#c2c7cf] hover:text-red-500 transition-colors text-[10px] opacity-0 group-hover/tag:opacity-100">✕</button>
                </div>
              </div>
            </div>
            <div v-if="!tagGroups || tagGroups.length === 0" class="text-[11px] text-[#9097a1]">まだグループがありません。下から作成してください</div>
          </div>
        </div>

        <!-- 未登録タグ（顧客に付いているが未登録） -->
        <div v-if="unregisteredTags.length > 0">
          <h3 class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em] mb-2">未登録のタグ（顧客管理で追加されたもの）</h3>
          <div class="flex gap-1.5 flex-wrap">
            <button
              v-for="t in unregisteredTags"
              :key="t.name"
              @click="registerExistingTag(t.name)"
              class="inline-flex items-center gap-1.5 bg-white border border-dashed border-[#d6d9de] rounded-full pl-3 pr-2.5 py-1 hover:border-[#4f46e5] transition-colors"
              title="クリックしてタグとして登録"
            >
              <span class="text-[11.5px] font-medium text-slate-500">{{ t.name }}</span>
              <span class="font-mono text-[10px] text-[#9097a1]">{{ t.count }}</span>
              <span class="text-[9px] text-[#4f46e5] font-semibold">＋登録</span>
            </button>
          </div>
        </div>

        <!-- グループ・タグ作成フォーム -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white border border-[#ebedf0] rounded-[13px] p-4 flex flex-col gap-2.5">
            <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">＋ グループを作成</div>
            <div class="flex gap-2">
              <input
                v-model="newGroupName"
                @keydown.enter="createGroup"
                placeholder="例: 業種、興味関心"
                class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2 text-[12.5px] focus:outline-none focus:border-[#4f46e5]"
              />
              <button @click="createGroup" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-2 text-[12px] text-white font-semibold hover:brightness-110 transition shrink-0">作成</button>
            </div>
          </div>
          <div class="bg-white border border-[#ebedf0] rounded-[13px] p-4 flex flex-col gap-2.5">
            <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">＋ タグを作成</div>
            <div class="flex gap-2">
              <input
                v-model="newTagName"
                @keydown.enter="createTag"
                placeholder="タグ名"
                class="flex-1 bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2 text-[12.5px] focus:outline-none focus:border-[#4f46e5]"
              />
              <select v-model="newTagGroupId" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-2 py-2 text-[11.5px] focus:outline-none focus:border-[#4f46e5] max-w-[110px]">
                <option value="">未分類</option>
                <option v-for="g in tagGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
              <button @click="createTag" class="bg-[#4f46e5] rounded-[9px] px-3.5 py-2 text-[12px] text-white font-semibold hover:brightness-110 transition shrink-0">作成</button>
            </div>
          </div>
        </div>
      </div>

      <div class="w-[320px] shrink-0">
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
