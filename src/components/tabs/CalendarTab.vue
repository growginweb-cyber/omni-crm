<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  calendarEvents: Array,
  broadcastTasks: Array,
})
const emit = defineEmits(['createEvent', 'deleteEvent'])

const viewMonth = ref(new Date())
const selectedDay = ref(null)

const eventTypeColor = (type) => {
  if (type === 'LINE') return '#06C755'
  if (type === 'メール') return '#3B6EF5'
  if (type === 'SMS') return '#8B5CF6'
  return '#D9883A' // 予約
}

const monthLabel = computed(() => `${viewMonth.value.getFullYear()}年 ${viewMonth.value.getMonth() + 1}月`)

const prevMonth = () => { viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() - 1, 1); selectedDay.value = null }
const nextMonth = () => { viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + 1, 1); selectedDay.value = null }

const dayLabels = ['日', '月', '火', '水', '木', '金', '土']

const allEvents = computed(() => {
  const evs = (props.calendarEvents || []).map(e => ({
    id: e.id,
    date: e.event_date,
    title: e.title,
    color: eventTypeColor(e.event_type),
    manual: true,
  }))
  ;(props.broadcastTasks || []).forEach(t => {
    const dt = t.scheduled_at || t.created_at
    if (!dt) return
    const ch = t.delivery_channel || t.broadcast_templates?.delivery_channel
    evs.push({
      id: 'task-' + t.id,
      date: dt.slice(0, 10),
      title: t.title,
      color: eventTypeColor(ch),
      manual: false,
    })
  })
  return evs
})

const calCells = computed(() => {
  const y = viewMonth.value.getFullYear()
  const m = viewMonth.value.getMonth()
  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({
      day: d,
      dateStr,
      events: allEvents.value.filter(e => e.date === dateStr),
    })
  }
  return cells
})

const newTitle = ref('')
const newType = ref('予約')

const addEvent = () => {
  if (!newTitle.value.trim() || !selectedDay.value) return
  emit('createEvent', { title: newTitle.value, eventDate: selectedDay.value, eventType: newType.value })
  newTitle.value = ''
}

const todayStr = new Date().toISOString().slice(0, 10)
</script>

<template>
  <div class="flex-1 flex min-h-0">
    <div class="flex-1 overflow-y-auto">
      <div class="sticky top-0 z-10 bg-[#fbfbfc] border-b border-[#ebedf0] px-7 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3.5">
          <h1 class="text-lg font-semibold text-slate-900">カレンダー</h1>
          <div class="flex items-center gap-1.5">
            <button @click="prevMonth" class="w-7 h-7 rounded-[7px] border border-[#e6e8ec] bg-white text-[#6b7280] hover:bg-[#f1f2f4] transition-colors flex items-center justify-center">‹</button>
            <span class="text-sm font-semibold min-w-[110px] text-center">{{ monthLabel }}</span>
            <button @click="nextMonth" class="w-7 h-7 rounded-[7px] border border-[#e6e8ec] bg-white text-[#6b7280] hover:bg-[#f1f2f4] transition-colors flex items-center justify-center">›</button>
          </div>
        </div>
        <div class="flex gap-2.5 text-[11px]">
          <span class="flex items-center gap-1.5"><span class="w-[9px] h-[9px] rounded-[2px]" style="background:#D9883A"></span>予約</span>
          <span class="flex items-center gap-1.5"><span class="w-[9px] h-[9px] rounded-[2px]" style="background:#06C755"></span>LINE</span>
          <span class="flex items-center gap-1.5"><span class="w-[9px] h-[9px] rounded-[2px]" style="background:#3B6EF5"></span>メール</span>
          <span class="flex items-center gap-1.5"><span class="w-[9px] h-[9px] rounded-[2px]" style="background:#8B5CF6"></span>SMS</span>
        </div>
      </div>

      <div class="p-7">
        <div class="bg-white border border-[#ebedf0] rounded-[14px] overflow-hidden">
          <div class="grid grid-cols-7 border-b border-[#ebedf0]">
            <div v-for="d in dayLabels" :key="d" class="py-[9px] px-3 text-[11.5px] font-semibold text-[#9097a1] text-center border-r border-[#f0f1f3] last:border-r-0">{{ d }}</div>
          </div>
          <div class="grid grid-cols-7">
            <div
              v-for="(c, i) in calCells"
              :key="i"
              @click="c.day && (selectedDay = c.dateStr)"
              :class="[
                'min-h-[92px] border-r border-b border-[#f0f1f3] p-1.5 last:border-r-0 cursor-pointer transition-colors',
                c.day ? 'hover:bg-[#f7f8fa]' : 'bg-[#fafbfc]',
                selectedDay === c.dateStr ? 'bg-[#ececfd]' : '',
              ]"
            >
              <template v-if="c.day">
                <span :class="['text-xs', c.dateStr === todayStr ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#4f46e5] text-white font-bold' : 'text-slate-600']">{{ c.day }}</span>
                <div class="flex flex-col gap-[2px] mt-[3px]">
                  <div
                    v-for="ev in c.events.slice(0, 3)"
                    :key="ev.id"
                    :style="{ background: ev.color }"
                    class="text-white text-[10px] font-medium px-1.5 py-[2px] rounded-[4px] truncate"
                  >{{ ev.title }}</div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <aside v-if="selectedDay" class="w-[280px] shrink-0 border-l border-[#ebedf0] bg-white overflow-y-auto p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold">{{ selectedDay }}</h3>
        <span @click="selectedDay = null" class="text-[#b0b6bf] cursor-pointer text-base">✕</span>
      </div>
      <div class="flex flex-col gap-2 mb-5">
        <div
          v-for="ev in allEvents.filter(e => e.date === selectedDay)"
          :key="ev.id"
          class="flex items-center gap-2 bg-[#f7f8fa] rounded-[9px] px-3 py-2"
        >
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: ev.color }"></span>
          <span class="text-xs flex-1 truncate">{{ ev.title }}</span>
          <button v-if="ev.manual" @click="$emit('deleteEvent', ev.id)" class="text-[#c2c7cf] hover:text-red-500 text-xs">✕</button>
        </div>
        <p v-if="allEvents.filter(e => e.date === selectedDay).length === 0" class="text-[11px] text-[#9097a1]">予定はありません</p>
      </div>
      <div class="border-t border-[#f0f1f3] pt-4 flex flex-col gap-2.5">
        <div class="text-[11px] font-semibold text-[#9097a1] uppercase tracking-[.04em]">＋ 予定を追加</div>
        <input
          v-model="newTitle"
          placeholder="予定タイトル"
          class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]"
        />
        <select v-model="newType" class="bg-[#f7f8fa] border border-[#ebedf0] rounded-[9px] px-3 py-2.5 text-[12.5px] w-full focus:outline-none focus:border-[#4f46e5]">
          <option>予約</option>
          <option>LINE</option>
          <option>メール</option>
          <option>SMS</option>
        </select>
        <button @click="addEvent" class="bg-[#4f46e5] rounded-[9px] py-[9px] text-[12.5px] text-white font-semibold hover:brightness-110 transition">追加する</button>
      </div>
    </aside>
  </div>
</template>
