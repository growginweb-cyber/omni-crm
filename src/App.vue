<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from './lib/supabase'

// タブ管理
const activeTab = ref('dashboard')

// 状態管理
const isLoggedIn = ref(false)
const loading = ref(false)
const userEmail = ref('')
const email = ref('')
const password = ref('')
const currentTenantId = ref(null)

// 顧客データ & セグメント管理
const customers = ref([])
const selectedSegment = ref('ALL')
const selectedCustomer = ref(null)

// モーダル・保存状態
const isModalOpen = ref(false)
const isSaving = ref(false)
const newCustomer = ref({ name: '', email: '', phone: '', line_uid: '', segment: '集客最大化タイプ' })

// --- ⚙️ 自動ステップシナリオ設計（アセット選択機能搭載） ---
const stepScenarios = ref([
  { step_number: 1, delay_minutes: 1, delivery_channel: 'LINE', template_id: '', description: '診断直後のブースター追客' },
  { step_number: 2, delay_minutes: 2, delivery_channel: 'Email', template_id: '', description: '2分後のWebセミナー詳細オファー' }
])
const stepQueues = ref([])

// --- AI配信作成タブ用 ---
const selectedChannel = ref('LINE')
const aiTargetSegment = ref('集客最大化タイプ')
const aiPurpose = ref('セミナー集客')
const isGenerating = ref(false)
const generatedContent = ref('')
const generatedImageUrl = ref('')
const generatedFlexJson = ref(null)
const emailSubject = ref('')
const templateTitle = ref('')
const savedTemplates = ref([])

// --- 一斉配信予約タブ用 ---
const selectedTemplateId = ref('')
const broadcastTitle = ref('')
const scheduledAt = ref('')
const isReserving = ref(false)
const broadcastTasks = ref([])
const processingTaskId = ref(null)

// --- 📋 診断コンテンツ管理 ---
const surveyCampaigns = ref([])
const selectedCampaignId = ref('')
const surveyQuestions = ref([])
const newCampaignTitle = ref('')
const newQuestionText = ref('')
const isCreatingQuestion = ref(false)

// 📱 ユーザー診断シミュレーター
const liffSelectedCustomerId = ref('')
const liffAnswers = ref({})
const isLiffSubmitting = ref(false)

// --- 📊 ダッシュボード・アナリティクス集計用 ---
const totalStats = computed(() => {
  if (!broadcastTasks.value || broadcastTasks.value.length === 0) {
    return { sent: 0, delivered: 0, opened: 0, clicked: 0 }
  }
  const completedTasks = broadcastTasks.value.filter(t => t?.status === '完了')
  let sent = 0, delivered = 0, opened = 0, clicked = 0
  completedTasks.forEach(t => { 
    sent += t?.sent_count || 0 
    delivered += t?.delivered_count || 0 
    opened += t?.opened_count || 0 
    clicked += t?.clicked_count || 0 
  })
  return { sent, delivered, opened, clicked }
})

const channelStats = computed(() => {
  const stats = { LINE: 0, Email: 0, SMS: 0 }
  if (!broadcastTasks.value) return stats
  broadcastTasks.value.forEach(t => {
    const ch = t?.delivery_channel || t?.broadcast_templates?.delivery_channel
    if (stats[ch] !== undefined) {
      stats[ch] += t?.sent_count || 0
    }
  })
  return stats
})

const segmentStats = computed(() => {
  const stats = {}
  if (!broadcastTasks.value) return []
  broadcastTasks.value.filter(t => t?.status === '完了').forEach(t => {
    const seg = t?.broadcast_templates?.target_segment || '未分類'
    if (!stats[seg]) stats[seg] = { delivered: 0, clicked: 0 }
    stats[seg].delivered += t?.delivered_count || 0
    stats[seg].clicked += t?.clicked_count || 0
  })
  return Object.entries(stats).map(([name, data]) => ({
    name,
    delivered: data.delivered,
    clicked: data.clicked,
    ctr: data.delivered ? Math.floor((data.clicked / data.delivered) * 100) : 0
  })).sort((a, b) => b.ctr - a.ctr)
})

// 顧客作成
const handleCreateCustomer = async () => {
  if (!newCustomer.value.name || !currentTenantId.value) return
  isSaving.value = true
  try {
    const { error } = await supabase.from('customers').insert([{
      tenant_id: currentTenantId.value, name: newCustomer.value.name,
      line_uid: newCustomer.value.line_uid || '未連携', segment: newCustomer.value.segment
    }])
    if (error) throw error
    newCustomer.value = { name: '', email: '', phone: '', line_uid: '', segment: '集客最大化タイプ' }
    isModalOpen.value = false
    await fetchCustomers()
  } catch (error) { alert(error.message) } finally { isSaving.value = false }
}

// 診断キャンペーン管理
const fetchCampaigns = async () => {
  if (!currentTenantId.value) return
  try {
    const { data } = await supabase.from('survey_campaigns').select('*').eq('tenant_id', currentTenantId.value).order('created_at', { ascending: false })
    surveyCampaigns.value = data || []
    if (data?.length > 0 && !selectedCampaignId.value) {
      const active = data.find(c => c.is_active); 
      selectedCampaignId.value = active ? active.id : data[0].id
      await fetchQuestionsByCampaign()
    }
  } catch (error) { console.error(error) }
}

const fetchQuestionsByCampaign = async () => {
  if (!selectedCampaignId.value) return
  try { 
    const { data } = await supabase.from('survey_questions').select('*, survey_choices(*)').eq('campaign_id', selectedCampaignId.value).order('sort_order', { ascending: true })
    surveyQuestions.value = data || [] 
  } catch (error) { console.error(error) }
}

const handleSelectCampaign = async (id) => { selectedCampaignId.value = id; await fetchQuestionsByCampaign() }

const handleCreateCampaign = async () => {
  if (!newCampaignTitle.value) return
  await supabase.from('survey_campaigns').insert([{ tenant_id: currentTenantId.value, title: newCampaignTitle.value, is_active: false }])
  newCampaignTitle.value = ''; await fetchCampaigns()
}

const handleToggleActiveCampaign = async (id) => {
  await supabase.from('survey_campaigns').update({ is_active: false }).eq('tenant_id', currentTenantId.value)
  await supabase.from('survey_campaigns').update({ is_active: true }).eq('id', id)
  await fetchCampaigns(); alert('🎯 LINE流入時診断を切り替えました！')
}

const handleCreateQuestion = async () => {
  if (!newQuestionText.value || !selectedCampaignId.value) return
  isCreatingQuestion.value = true
  await supabase.from('survey_questions').insert([{ tenant_id: currentTenantId.value, campaign_id: selectedCampaignId.value, question_text: newQuestionText.value, sort_order: surveyQuestions.value.length + 1 }])
  newQuestionText.value = ''; await fetchQuestionsByCampaign(); isCreatingQuestion.value = false
}

const handleAddChoice = async (questionId) => {
  const choiceText = prompt('選択肢を入力してください')
  if (!choiceText) return
  const assignedSegment = prompt('紐付けるセグメント名を入力してください', '集客最大化タイプ')
  if (!assignedSegment) return
  await supabase.from('survey_choices').insert([{ question_id: questionId, choice_text: choiceText, assigned_segment: assignedSegment }])
  await fetchQuestionsByCampaign()
}

// ⚙️ ステップ配信スケジュール関連
const fetchStepQueues = async () => {
  if (!currentTenantId.value) return
  const { data } = await supabase.from('step_broadcast_queues').select('*, customers(name, segment)').order('scheduled_at', { ascending: false })
  stepQueues.value = data || []
}

const addScenarioStep = () => {
  const nextStep = stepScenarios.value.length + 1
  stepScenarios.value.push({
    step_number: nextStep, delay_minutes: nextStep, delivery_channel: 'LINE', template_id: '', description: `自動追客ステップ #${nextStep}`
  })
}

// 🔥 画面で設計したシナリオ（テンプレートID付き）を予約
const handleLiffSubmit = async () => {
  if (!liffSelectedCustomerId.value) { alert('顧客を選択してください'); return }
  let finalSegment = '未診断'
  if (surveyQuestions.value && surveyQuestions.value.length > 0) {
    for (const q of surveyQuestions.value) {
      const selectedChoiceId = liffAnswers.value[q.id]
      if (selectedChoiceId) { 
        const choice = q.survey_choices?.find(c => c.id === selectedChoiceId)
        if (choice) finalSegment = choice.assigned_segment 
      }
    }
  } else {
    finalSegment = liffAnswers.value['q1'] === 'choice_1' ? '集客最大化タイプ' : 'コスト削減タイプ'
  }

  isLiffSubmitting.value = true
  try {
    await supabase.from('customers').update({ segment: finalSegment }).eq('id', liffSelectedCustomerId.value)
    
    const now = new Date()
    const insertData = stepScenarios.value.map(scenario => {
      const scheduledTime = new Date(now.getTime() + scenario.delay_minutes * 60 * 1000).toISOString()
      return {
        tenant_id: currentTenantId.value,
        customer_id: liffSelectedCustomerId.value,
        step_number: scenario.step_number,
        delivery_channel: scenario.delivery_channel,
        template_id: scenario.template_id || null, 
        scheduled_at: scheduledTime,
        status: '未送信'
      }
    })

    if (insertData.length > 0) {
      await supabase.from('step_broadcast_queues').insert(insertData)
    }

    alert(`🎯 診断完了！セグメント【${finalSegment}】になりました。\n🚀 設計された ${insertData.length} 個の自動追客ステップが予約されました！`)
    liffAnswers.value = {}
    activeTab.value = 'customers'
    await Promise.all([fetchCustomers(), fetchStepQueues()])
  } catch (e) { alert(e.message) } finally { isLiffSubmitting.value = false }
}

// コンテンツ生成・一斉配信系
const simulateAIGeneration = () => {
  if (!aiPurpose.value) return
  isGenerating.value = true; generatedContent.value = ''; generatedImageUrl.value = ''; generatedFlexJson.value = null; emailSubject.value = ''
  
  setTimeout(() => {
    isGenerating.value = false
    const isGrowth = aiTargetSegment.value === '集客最大化タイプ'
    generatedImageUrl.value = isGrowth ? 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600' : 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600'

    if (selectedChannel.value === 'LINE') {
      generatedContent.value = `【診断結果: ${aiTargetSegment.value}】\n\nあなたに最適なマーケティング戦略をAIが分析しました。詳細は下記の限定カードをご確認ください！`
      generatedFlexJson.value = { type: "bubble", hero: { type: "image", url: generatedImageUrl.value, size: "full", aspectRatio: "20:13", aspectMode: "cover" }, body: { type: "box", layout: "vertical", contents: [{ type: "text", text: aiTargetSegment.value, weight: "bold", size: "xl" }] }, footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "uri", label: "🔒 セミナー枠を確定する", uri: "https://example.com" }, style: "primary", color: "#4f46e5" }] } }
    } else if (selectedChannel.value === 'Email') {
      emailSubject.value = `【診断フィードバック】${aiTargetSegment.value}向け限定レポート`
      generatedContent.value = `AI Omni CRM 診断フィードバック\n\n診断結果に基づき、あなたのビジネスを加速させる【${aiTargetSegment.value}】のための具体策をご提案します。\n\n詳細はこちら： https://example.com/report`
    } else if (selectedChannel.value === 'SMS') {
      generatedContent.value = `【AI CRM】診断完了。${aiTargetSegment.value}のあなたへ限定最適化計画！詳細： https://example.com/c`
    }
    templateTitle.value = `${aiTargetSegment.value}向け-${selectedChannel.value}配信アセット`
  }, 300)
}

const saveTemplate = async () => {
  if (!generatedContent.value || !currentTenantId.value) return
  await supabase.from('broadcast_templates').insert([{ tenant_id: currentTenantId.value, title: templateTitle.value, content: generatedContent.value, image_url: generatedImageUrl.value || null, flex_json: generatedFlexJson.value || null, email_subject: emailSubject.value || null, delivery_channel: selectedChannel.value, target_segment: aiTargetSegment.value }])
  alert(`🎉 保存しました！`); await fetchTemplates(); generatedContent.value = ''; generatedImageUrl.value = ''; generatedFlexJson.value = null; emailSubject.value = ''
}

const handleReserveBroadcast = async () => {
  if (!selectedTemplateId.value || !broadcastTitle.value || !scheduledAt.value) return
  isReserving.value = true
  const targetTemplate = savedTemplates.value.find(t => t.id === selectedTemplateId.value)
  const { data: taskData } = await supabase.from('broadcast_tasks').insert([{ tenant_id: currentTenantId.value, template_id: selectedTemplateId.value, title: broadcastTitle.value, scheduled_at: new Date(scheduledAt.value).toISOString(), status: '予約中', delivery_channel: targetTemplate.delivery_channel, sent_count: 0, delivered_count: 0, opened_count: 0, clicked_count: 0 }]).select().single()
  const { data: targetCustomers } = await supabase.from('customers').select('id').eq('tenant_id', currentTenantId.value).eq('segment', targetTemplate.target_segment)
  if (targetCustomers?.length > 0) {
    await supabase.from('broadcast_queues').insert(targetCustomers.map(c => ({ task_id: taskData.id, customer_id: c.id, status: '未送信' })))
    alert(`予約完了（対象: ${targetCustomers.length}名）`)
  }
  await fetchBroadcastTasks(); isReserving.value = false
}

const handleExecuteBroadcast = async (taskId) => {
  processingTaskId.value = taskId
  try {
    await supabase.from('broadcast_tasks').update({ status: '配信中' }).eq('id', taskId)
    const { data: queues } = await supabase.from('broadcast_queues').select('*, customers(line_uid)').eq('task_id', taskId).eq('status', '未送信')
    const { data: taskData } = await supabase.from('broadcast_tasks').select('*, broadcast_templates(*)').eq('id', taskId).single()
    const template = taskData.broadcast_templates
    const channel = taskData.delivery_channel || template.delivery_channel

    let successCount = 0
    if (queues && queues.length > 0) {
      for (const q of queues) {
        if (channel === 'LINE' && q.customers?.line_uid && q.customers.line_uid !== '未連携') {
          await supabase.functions.invoke('send-line-message', { body: { line_uid: q.customers.line_uid, flex_json: template.flex_json, text_content: template.content } })
        } else {
          await new Promise(r => setTimeout(r, 100))
        }
        await supabase.from('broadcast_queues').update({ status: '送信成功', sent_at: new Date().toISOString() }).eq('id', q.id)
        successCount++
      }
    }

    await supabase.from('broadcast_tasks').update({ status: '完了', sent_count: successCount, delivered_count: successCount, opened_count: Math.floor(successCount*0.6), clicked_count: Math.floor(successCount*0.2) }).eq('id', taskId)
    alert(`🚀 配信完了！`)
    await fetchBroadcastTasks(); await fetchCustomers()
  } catch (error) { alert(error.message) } finally { processingTaskId.value = null }
}

const fetchTemplates = async () => {
  const { data } = await supabase.from('broadcast_templates').select('*').eq('tenant_id', currentTenantId.value).order('created_at', { ascending: false })
  savedTemplates.value = data || []
}

const fetchBroadcastTasks = async () => {
  const { data } = await supabase.from('broadcast_tasks').select('*, broadcast_templates(title, target_segment, delivery_channel), broadcast_queues(id, status)').eq('tenant_id', currentTenantId.value).order('created_at', { ascending: false })
  broadcastTasks.value = data || []
}

const fetchCustomers = async () => {
  let query = supabase.from('customers').select('*').eq('tenant_id', currentTenantId.value)
  if (selectedSegment.value !== 'ALL') query = query.eq('segment', selectedSegment.value)
  const { data } = await query.order('created_at', { ascending: false })
  customers.value = data || []
  if (customers.value.length > 0) selectedCustomer.value = customers.value[0]
}

const fetchUserTenant = async (userId) => {
  const { data } = await supabase.from('profiles').select('tenant_id').eq('id', userId).single()
  if (data) {
    currentTenantId.value = data.tenant_id
    await Promise.all([fetchTemplates(), fetchBroadcastTasks(), fetchCampaigns(), fetchCustomers(), fetchStepQueues()])
  }
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) { isLoggedIn.value = true; userEmail.value = session.user.email; await fetchUserTenant(session.user.id) }
})

const handleLogin = async () => {
  loading.value = true
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
  if (error) { alert(`ログイン失敗: ${error.message}`) }
  else { isLoggedIn.value = true; userEmail.value = data.user.email; await fetchUserTenant(data.user.id) }
  loading.value = false
}

const handleLogout = async () => { await supabase.auth.signOut(); isLoggedIn.value = false }
</script>

<template>
  <div class="h-screen bg-slate-50/80 flex flex-col font-sans text-slate-800 antialiased">
    <nav v-if="isLoggedIn" class="bg-slate-950 text-white px-8 py-3.5 flex justify-between items-center shadow-md shrink-0 z-20">
      <div class="flex items-center gap-6">
        <div>
          <h1 class="text-md font-black tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">AI OMNI CRM</h1>
          <p class="text-[9px] font-mono text-slate-500 mt-0.5">Workspace: {{ currentTenantId?.substring(0,8) }}...</p>
        </div>
        <div class="flex bg-slate-900 rounded-xl p-1 border border-slate-800/80 shadow-inner overflow-x-auto">
          <button @click="activeTab = 'dashboard'" :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0', activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200']">📊 分析ダッシュボード</button>
          <button @click="activeTab = 'customers'" :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0', activeTab === 'customers' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200']">顧客・配信ログ</button>
          <button @click="activeTab = 'scenarios'" :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition-all text-emerald-400 shrink-0', activeTab === 'scenarios' ? 'bg-emerald-600 text-white shadow-md' : 'hover:text-emerald-300']">⚙️ シナリオ設計</button>
          <button @click="activeTab = 'survey'" :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0', activeTab === 'survey' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200']">📋 診断設計</button>
          <button @click="activeTab = 'ai-content'" :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0', activeTab === 'ai-content' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white']">✨ AI生成</button>
          <button @click="activeTab = 'broadcast'" :class="['px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0', activeTab === 'broadcast' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white']">🚀 一斉配信予約</button>
          <button @click="activeTab = 'user-liff'" :class="['px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-yellow-400 shrink-0', activeTab === 'user-liff' ? 'bg-amber-500 text-slate-900 shadow-md' : 'hover:text-yellow-300']">📱 LIFF体験</button>
        </div>
      </div>
      <div class="flex items-center gap-4 shrink-0">
        <span class="text-xs text-slate-300 font-medium hidden md:inline">{{ userEmail }}</span>
        <button @click="handleLogout" class="rounded-xl bg-slate-800 px-3 py-1 text-xs text-slate-400 border border-slate-700 hover:text-white">ログアウト</button>
      </div>
    </nav>

    <div v-if="!isLoggedIn" class="flex-1 flex items-center justify-center bg-slate-950">
      <div class="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100">
        <h2 class="text-xl font-black text-slate-900 mb-2 tracking-tight">AI OMNI CRM</h2>
        <p class="text-xs text-slate-400 mb-6">次世代のマルチチャネル自動化システム</p>
        <div class="space-y-4">
          <div><label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">メールアドレス</label><input v-model="email" type="email" class="mt-1 w-full rounded-xl border p-3 text-xs bg-slate-50 focus:outline-none" placeholder="admin@example.com"></div>
          <div><label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">パスワード</label><input v-model="password" type="password" class="mt-1 w-full rounded-xl border p-3 text-xs bg-slate-50 focus:outline-none" placeholder="••••••••"></div>
          <button @click="handleLogin" :disabled="loading" class="w-full bg-slate-900 text-white p-3 rounded-xl text-xs font-bold hover:bg-slate-800 transition">{{ loading ? 'ログイン中...' : 'システムにログイン' }}</button>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'dashboard' && isLoggedIn" class="flex-1 p-8 overflow-y-auto bg-slate-50/50">
      <div class="max-w-6xl mx-auto space-y-8">
        <div><h2 class="text-2xl font-black text-slate-900 tracking-tight">アナリティクスダッシュボード</h2></div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-3xs"><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">総送信数</span><div class="text-2xl font-black text-slate-900 mt-2 font-mono">{{ totalStats.sent }} <span class="text-xs text-slate-400 font-normal">通</span></div></div>
          <div class="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-3xs"><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">着信・到達率</span><div class="text-2xl font-black text-emerald-600 mt-2 font-mono">{{ totalStats.sent ? 100 : 0 }} <span class="text-xs font-normal text-slate-400">%</span></div></div>
          <div class="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-3xs"><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">平均開封率</span><div class="text-2xl font-black text-indigo-600 mt-2 font-mono">{{ totalStats.delivered ? '60.0' : '0.0' }} <span class="text-xs font-normal text-slate-400">%</span></div></div>
          <div class="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-3xs"><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CTR</span><div class="text-2xl font-black text-blue-600 mt-2 font-mono">{{ totalStats.opened ? '20.0' : '0.0' }} <span class="text-xs font-normal text-slate-400">%</span></div></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 bg-white p-6 rounded-2xl border shadow-3xs flex flex-col justify-between"><h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">📈 開封・クリックの推移</h3><div class="h-48 flex items-end gap-3 pt-6 px-2 border-b border-l border-slate-100"><div class="flex-1 bg-indigo-100 rounded-t-lg" style="height: 40%"></div><div class="flex-1 bg-indigo-300 rounded-t-lg" style="height: 65%"></div><div class="flex-1 bg-indigo-500 rounded-t-lg" style="height: 85%"></div><div class="flex-1 bg-indigo-600 rounded-t-lg" style="height: 60%"></div></div></div>
          <div class="bg-white p-6 rounded-2xl border shadow-3xs"><h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">📊 チャネル別 配信比率</h3><div class="space-y-4"><div><div class="flex justify-between text-xs mb-1 font-medium"><span>🟢 LINE</span><span class="font-mono">{{ channelStats.LINE }} 通</span></div><div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-emerald-500 h-full" :style="{ width: channelStats.LINE ? '100%' : '10%' }"></div></div></div><div><div class="flex justify-between text-xs mb-1 font-medium"><span>🟦 メール</span><span class="font-mono">{{ channelStats.Email }} 通</span></div><div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-blue-500 h-full" :style="{ width: channelStats.Email ? '100%' : '10%' }"></div></div></div><div><div class="flex justify-between text-xs mb-1 font-medium"><span>💬 SMS</span><span class="font-mono">{{ channelStats.SMS }} 通</span></div><div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-orange-500 h-full" :style="{ width: channelStats.SMS ? '100%' : '10%' }"></div></div></div></div></div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'customers' && isLoggedIn" class="flex-1 flex overflow-hidden">
      <main class="w-3/5 p-8 overflow-y-auto border-r border-slate-200/60 flex flex-col bg-white">
        <div class="flex items-center justify-between mb-6 shrink-0">
          <div><h2 class="text-xl font-bold text-slate-900">顧客セグメント管理</h2></div>
          <button @click="isModalOpen = true" class="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-md">✨ テストユーザー追加</button>
        </div>
        <div class="flex gap-1.5 mb-6 bg-slate-100 p-1 rounded-xl shrink-0 w-max border"><button v-for="seg in ['ALL', '集客最大化タイプ', 'コスト削減タイプ', '未診断']" :key="seg" @click="selectedSegment = seg; fetchCustomers()" :class="['px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all', selectedSegment === seg ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500']">{{ seg }}</button></div>
        <div class="overflow-hidden border border-slate-200 rounded-xl bg-white"><table class="min-w-full divide-y"><thead class="bg-slate-50"><tr class="text-left text-xs font-bold text-slate-400"><th class="p-4 pl-6">顧客プロファイル</th><th class="p-4">セグメント</th></tr></thead><tbody class="divide-y bg-white"><tr v-for="c in customers" :key="c.id" @click="selectedCustomer = c" :class="['cursor-pointer hover:bg-slate-50/50', selectedCustomer?.id === c.id ? 'bg-indigo-50/40' : '']"><td class="p-4 pl-6"><div class="font-bold text-sm">{{ c.name }}</div><div class="text-xs text-slate-400 font-mono">{{ c.line_uid }}</div></td><td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold bg-indigo-50 text-indigo-700">{{ c.segment }}</span></td></tr></tbody></table></div>
      </main>
      <aside class="w-2/5 p-8 bg-slate-50/50 overflow-y-auto flex flex-col">
        <h3 class="font-black text-md text-slate-900 mb-2">⚙️ 全自動追客ステップ・タイムライン</h3>
        <p class="text-xs text-slate-400 mb-4">右のシナリオ通りに生成された配信予定ログ</p>
        <div class="space-y-3">
          <div v-for="queue in stepQueues" :key="queue.id" class="bg-white p-4 rounded-2xl border shadow-3xs flex flex-col gap-2">
            <div class="flex justify-between items-center"><span class="text-xs font-bold">{{ queue.customers?.name }}</span><span :class="['px-2 py-0.5 rounded text-[9px] font-bold', queue.status === '送信成功' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700 animate-pulse']">{{ queue.status }}</span></div>
            <div class="flex items-center justify-between text-[11px] text-slate-400"><div>ステップ #{{ queue.step_number }} ({{ queue.delivery_channel }})</div><div class="font-mono text-[10px]">予定: {{ new Date(queue.scheduled_at).toLocaleTimeString() }}</div></div>
          </div>
        </div>
      </aside>
    </div>

    <div v-else-if="activeTab === 'scenarios' && isLoggedIn" class="flex-1 p-8 overflow-y-auto bg-white max-w-5xl mx-auto w-full">
      <div class="flex justify-between items-center mb-6">
        <div><h2 class="text-xl font-black text-slate-900">⚙️ ステップ配信シナリオ設計 ＆ コンテンツ選択</h2><p class="text-xs text-slate-400 mt-1">「✨ AI生成/自作」タブでストックしたコンテンツを、各ステップに自由に選んでセットできます。</p></div>
        <button @click="addScenarioStep" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ ステップを追加</button>
      </div>

      <div class="space-y-4">
        <div v-for="(scenario, index) in stepScenarios" :key="index" class="bg-slate-50 border p-5 rounded-2xl flex items-center gap-6 shadow-3xs">
          <div class="bg-emerald-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{{ scenario.step_number }}</div>
          <div class="flex-1 grid grid-cols-4 gap-4">
            <div><label class="text-[10px] font-bold text-slate-400 block mb-1">配信タイミング</label><div class="flex items-center gap-2"><input type="number" v-model="scenario.delay_minutes" class="border bg-white rounded-lg p-2 text-xs w-20 font-mono text-center"><span class="text-xs font-bold text-slate-600">分後</span></div></div>
            <div><label class="text-[10px] font-bold text-slate-400 block mb-1">チャネル</label><select v-model="scenario.delivery_channel" class="border bg-white rounded-lg p-2 text-xs w-full font-bold"><option value="LINE">🟢 LINE</option><option value="Email">🟦 メール</option><option value="SMS">💬 SMS</option></select></div>
            <div class="col-span-2">
              <label class="text-[10px] font-bold text-slate-500 block mb-1">🔥 配信する自作コンテンツを選択</label>
              <select v-model="scenario.template_id" class="border border-emerald-300 bg-white rounded-lg p-2 text-xs w-full font-bold text-emerald-800 focus:outline-none focus:border-emerald-500">
                <option value="">-- 未選択（フォールバック用標準テキストを送信） --</option>
                <option v-for="t in savedTemplates.filter(tmpl => tmpl.delivery_channel === scenario.delivery_channel)" :key="t.id" :value="t.id">【対象: {{ t.target_segment }}】{{ t.title }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'survey' && isLoggedIn" class="flex-1 flex overflow-hidden">
      <aside class="w-1/4 bg-slate-50 border-r p-6">
        <div class="mb-4">
          <h3 class="text-sm font-bold text-slate-400">📋 診断マスター一覧</h3>
          <div class="mt-3 space-y-2"><input v-model="newCampaignTitle" class="w-full border p-2 text-xs rounded-lg" placeholder="新しい診断タイトル"><button @click="handleCreateCampaign" class="w-full bg-slate-900 text-white py-1.5 rounded-lg text-xs font-bold">診断を新規作成</button></div>
        </div>
        <div class="space-y-2 border-t pt-4">
          <div v-for="cp in surveyCampaigns" :key="cp.id" @click="handleSelectCampaign(cp.id)" :class="['p-4 rounded-xl border cursor-pointer transition-all', selectedCampaignId === cp.id ? 'bg-white border-indigo-500 shadow-sm' : 'bg-slate-100/50']">
            <div class="flex justify-between items-center"><span :class="['text-[9px] px-2 py-0.5 rounded font-bold', cp.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500']">{{ cp.is_active ? '有効' : '無効' }}</span><button v-if="!cp.is_active" @click.stop="handleToggleActiveCampaign(cp.id)" class="text-[9px] text-indigo-600 hover:underline">有効化</button></div>
            <h4 class="text-xs font-bold text-slate-800 mt-2">{{ cp.title }}</h4>
          </div>
        </div>
      </aside>
      <main class="w-3/4 p-8 overflow-y-auto flex flex-col bg-white">
        <div class="flex justify-between items-center mb-6 border-b pb-4">
          <div><h2 class="text-xl font-bold text-slate-900">診断ステップフロー設計</h2></div>
          <div class="flex gap-2"><input v-model="newQuestionText" class="border px-3 py-2 text-xs rounded-xl w-64" placeholder="新しい質問文を追加..."><button @click="handleCreateQuestion" :disabled="isCreatingQuestion" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm">質問を追加</button></div>
        </div>
        <div class="flex-1 space-y-6">
          <div v-for="q in surveyQuestions" :key="q.id" class="flex gap-6 items-start bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60">
            <div class="w-1/3 bg-white border rounded-xl p-4 shadow-3xs"><span class="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold">質問項目</span><h4 class="text-sm font-bold text-slate-900 mt-2">{{ q.question_text }}</h4><button @click="handleAddChoice(q.id)" class="mt-4 text-[10px] text-indigo-600 font-bold hover:underline">+ 選択肢を追加</button></div>
            <div class="w-2/3 space-y-2"><span class="text-[10px] font-bold text-slate-400 block mb-1">ユーザーの選択肢 と 割り当てセグメント</span>
              <div v-for="choice in q.survey_choices" :key="choice.id" class="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200/60 shadow-3xs"><span class="text-xs font-medium text-slate-700">● {{ choice.choice_text }}</span><span class="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg">➔ 分岐先: {{ choice.assigned_segment }}</span></div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <div v-else-if="activeTab === 'ai-content' && isLoggedIn" class="flex-1 flex overflow-hidden bg-white">
      <div class="w-2/5 p-8 overflow-y-auto border-r">
        <h2 class="text-xl font-bold text-slate-900 tracking-tight mb-5">✨ オムニクリエイティブスタジオ</h2>
        <div class="mb-6 bg-slate-100 p-1 rounded-xl w-max flex">
          <button @click="selectedChannel = 'LINE'" :class="['px-4 py-1.5 text-xs font-bold rounded-lg', selectedChannel === 'LINE' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-400']">🟢 LINE</button>
          <button @click="selectedChannel = 'Email'" :class="['px-4 py-1.5 text-xs font-bold rounded-lg', selectedChannel === 'Email' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400']">🟦 メール</button>
        </div>
        <div class="space-y-4 bg-slate-50 p-5 rounded-2xl border mb-6">
          <div><label class="text-xs font-bold text-slate-500">対象セグメント</label><select v-model="aiTargetSegment" class="mt-2 w-full rounded-xl border bg-white p-2.5 text-xs"><option value="集客最大化タイプ">集客最大化タイプ</option><option value="コスト削減タイプ">コスト削減タイプ</option></select></div>
          <button @click="simulateAIGeneration" class="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold">✨ メッセージフォームを起動</button>
        </div>
        <div v-if="generatedContent" class="space-y-4 flex-1 flex flex-col">
          <input v-model="templateTitle" class="border text-xs rounded-xl px-3 py-2 w-full font-bold" placeholder="アセット名・タイトル（例: 初回クーポン配信）">
          <textarea v-model="generatedContent" rows="5" class="w-full border p-3 text-xs rounded-xl font-mono flex-grow" placeholder="ここに自由に自作メッセージを入力..."></textarea>
          <button @click="saveTemplate" class="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white self-end">💾 テンプレートとして保存</button>
        </div>
      </div>
      <div class="w-1/5 p-6 bg-slate-100 border-r flex flex-col items-center"><span class="text-[10px] font-bold text-slate-400 mb-4">📱 プレビュー</span>
        <div v-if="generatedContent && selectedChannel === 'LINE'" class="w-full bg-white rounded-2xl shadow-md border overflow-hidden max-w-[260px]"><div class="w-full aspect-[20/13] bg-slate-200"><img :src="generatedImageUrl" class="w-full h-full object-cover"></div><div class="p-4"><div class="text-[9px] font-bold text-emerald-600">診断結果</div><div class="text-md font-black text-slate-900">{{ aiTargetSegment }}</div></div></div>
        <div v-else-if="generatedContent" class="bg-white p-4 rounded-xl border text-xs w-full font-mono whitespace-pre-wrap shadow-xs">{{ generatedContent }}</div>
      </div>
      <div class="w-2/5 p-8 overflow-y-auto bg-slate-50/30">
        <h3 class="font-bold text-slate-900 text-sm mb-4">💾 ストック済みアセット</h3>
        <div class="space-y-3"><div v-for="t in savedTemplates" :key="t.id" class="bg-white p-4 rounded-xl border flex flex-col space-y-2"><div class="flex justify-between items-center font-bold text-xs"><span class="text-slate-800 font-black text-xs">{{ t.title }}</span><span class="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-400">{{ t.delivery_channel }}</span></div><p class="text-[10px] text-slate-400 truncate bg-slate-50 p-2 rounded-lg font-mono">{{ t.content }}</p></div></div>
      </div>
    </div>

    <div v-else-if="activeTab === 'broadcast' && isLoggedIn" class="flex-1 flex overflow-hidden bg-white">
      <div class="w-1/2 p-8 overflow-y-auto border-r flex flex-col bg-white">
        <h2 class="text-xl font-bold text-slate-900 tracking-tight mb-6">🚀 一斉配信スケジュール予約</h2>
        <div class="space-y-4 bg-slate-50 p-5 rounded-2xl border">
          <div><label class="text-xs font-bold text-slate-500">使用コンテンツ</label><select v-model="selectedTemplateId" class="mt-2 w-full rounded-xl border bg-white p-2.5 text-xs focus:outline-none"><option value="">選択してください</option><option v-for="t in savedTemplates" :key="t.id" :value="t.id">【{{ t.delivery_channel }}】{{ t.title }}</option></select></div>
          <div><label class="text-xs font-bold text-slate-500">キャンペーン名</label><input v-model="broadcastTitle" class="mt-2 w-full border bg-white p-2.5 text-xs rounded-xl focus:outline-none" placeholder="例: 本番一斉送信テスト"></div>
          <div><label class="text-xs font-bold text-slate-500">配信日時</label><input v-model="scheduledAt" type="datetime-local" class="mt-2 w-full border bg-white p-2.5 text-xs rounded-xl focus:outline-none"></div>
          <button @click="handleReserveBroadcast" class="w-full bg-slate-900 text-white p-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition">予約スケジュールを確定</button>
        </div>
      </div>
      <div class="w-1/2 p-8 overflow-y-auto bg-slate-50/30">
        <h3 class="font-bold text-slate-900 text-sm mb-4">📋 一斉配信タスク管理</h3>
        <div class="space-y-4">
          <div v-for="task in broadcastTasks" :key="task.id" class="bg-white p-5 rounded-2xl border shadow-2xs flex flex-col space-y-3">
            <div class="flex justify-between items-center"><span class="font-bold text-sm text-slate-900">{{ task.title }}</span><span :class="['px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider', task.status === '完了' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700']">{{ task.status }}</span></div>
            <div class="text-[11px] text-slate-400">チャネル: <span class="font-bold text-indigo-600">{{ task.delivery_channel }}</span> / 対象: {{ task.broadcast_queues?.length || 0 }}名</div>
            <button @click="handleExecuteBroadcast(task.id)" v-if="task.status === '予約中'" :disabled="processingTaskId === task.id" class="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-xs font-bold mt-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-transform">{{ processingTaskId === task.id ? '送信中...' : '🚀 今すぐ本番送信を実行！' }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'user-liff' && isLoggedIn" class="flex-1 flex bg-slate-100 overflow-hidden items-center justify-center p-8">
      <div class="w-full max-w-md bg-white rounded-[40px] shadow-2xl border-[12px] border-slate-900 h-[720px] flex flex-col relative overflow-hidden">
        <div class="p-3 bg-amber-50 border-b text-[10px] text-amber-800 shrink-0 flex items-center justify-between"><span>⚙️ テスト回答顧客:</span><select v-model="liffSelectedCustomerId" class="bg-white border rounded px-2 py-0.5 font-bold"><option value="" disabled>顧客を選択</option><option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option></select></div>
        <div class="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50">
          <div v-for="q in surveyQuestions" :key="q.id" class="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 space-y-3">
            <h4 class="text-xs font-bold text-slate-900"><span>{{ q.question_text }}</span></h4>
            <div class="space-y-2">
              <label v-for="choice in q.survey_choices" :key="choice.id" :class="['w-full flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer text-xs font-medium transition-all', liffAnswers[q.id] === choice.id ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-3xs' : 'bg-white text-slate-600']"><span>{{ choice.choice_text }}</span><input type="radio" :name="'liff-q-' + q.id" :value="choice.id" v-model="liffAnswers[q.id]" class="hidden"></label>
            </div>
          </div>
        </div>
        <div class="p-4 bg-white border-t shrink-0"><button @click="handleLiffSubmit" :disabled="isLiffSubmitting" class="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20">{{ isLiffSubmitting ? '処理中...' : '📊 診断を完了して自動ステップを起動' }}</button></div>
      </div>
    </div>

    <div v-if="isModalOpen" class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 class="text-base font-bold text-slate-900 mb-4">✨ テスト用顧客の追加</h3>
        <div class="space-y-4 mb-6">
          <div><label class="text-[10px] font-bold text-slate-400 uppercase">お名前</label><input v-model="newCustomer.name" class="mt-1 w-full border p-2 text-xs rounded-lg focus:outline-none" placeholder="例: テスト用 アカウント"></div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-100"><label class="text-[10px] font-bold text-emerald-600 uppercase">🟢 送信先のLINEユーザーID</label><input v-model="newCustomer.line_uid" class="mt-1 w-full border border-emerald-200 bg-white p-2 text-xs rounded-lg font-mono focus:outline-none" placeholder="Uから始まる別アカウントのID"></div>
        </div>
        <div class="flex gap-3"><button @click="isModalOpen = false" class="flex-1 bg-slate-50 text-slate-500 py-2 rounded-xl text-xs font-bold">キャンセル</button><button @click="handleCreateCustomer" class="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold">保存</button></div>
      </div>
    </div>
  </div>
</template>