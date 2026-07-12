import { ref, computed, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { sendLineMessage, simulateChannelDelivery } from '../lib/broadcast'
import { injectEmailTracking, rewriteUrls, buildSmsContent } from '../lib/tracking'

export function useCrm() {
  const activeTab = ref('dashboard')

  const isLoggedIn = ref(false)
  const loading = ref(false)
  const userEmail = ref('')
  const email = ref('')
  const password = ref('')
  const currentTenantId = ref(null)

  const customers = ref([])
  const selectedSegment = ref('ALL')
  const selectedCustomer = ref(null)

  const isModalOpen = ref(false)
  const isSaving = ref(false)
  const newCustomer = ref({ name: '', email: '', phone: '', line_uid: '', segment: '集客最大化タイプ' })

  const stepScenarios = ref([
    { step_number: 1, delay_minutes: 1, delivery_channel: 'LINE', template_id: '', description: '診断直後のブースター追客' },
    { step_number: 2, delay_minutes: 2, delivery_channel: 'Email', template_id: '', description: '2分後のWebセミナー詳細オファー' },
  ])
  const stepQueues = ref([])

  const selectedChannel = ref('LINE')
  const aiTargetSegment = ref('集客最大化タイプ')
  const aiPurpose = ref('セミナー集客')
  const isGenerating = ref(false)
  const generatedContent = ref('')
  const generatedImageUrl = ref('')
  const generatedFlexJson = ref(null)
  const generatedEmailHtml = ref('')
  const generatedMessagesJson = ref(null)
  const emailSubject = ref('')
  const templateTitle = ref('')
  const savedTemplates = ref([])

  const selectedTemplateId = ref('')
  const broadcastTitle = ref('')
  const scheduledAt = ref('')
  const broadcastTargetSegment = ref('ALL')
  const broadcastTargetSavedSegmentId = ref('')
  const isReserving = ref(false)
  const broadcastTasks = ref([])
  const processingTaskId = ref(null)

  const surveyCampaigns = ref([])
  const selectedCampaignId = ref('')
  const surveyQuestions = ref([])
  const flowJson = ref(null)
  const newCampaignTitle = ref('')
  const newQuestionText = ref('')
  const isCreatingQuestion = ref(false)

  const liffSelectedCustomerId = ref('')
  const liffAnswers = ref({})
  const isLiffSubmitting = ref(false)

  const stepAiPrompt = ref('')
  const stepAiResult = ref('')
  const stepAiLoading = ref(false)

  // --- シナリオ格納庫 ---
  const scenarioDefs = ref([])
  const selectedScenarioDefId = ref(null)
  const scenarioItems = ref([])
  const selectedScenarioItemId = ref(null)

  const selectedScenarioDef = computed(() =>
    scenarioDefs.value.find(s => s.id === selectedScenarioDefId.value) || null
  )
  const selectedScenarioItem = computed(() =>
    scenarioItems.value.find(s => s.id === selectedScenarioItemId.value) || null
  )

  const fetchScenarioDefs = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('step_scenario_defs')
      .select('*')
      .eq('tenant_id', currentTenantId.value)
      .order('created_at', { ascending: true })
    scenarioDefs.value = data || []

    // 初回のみ：既存のstepScenariosから既定シナリオを作成
    if (scenarioDefs.value.length === 0 && stepScenarios.value.length > 0) {
      await createScenarioDef('診断完了フォロー', true)
      for (const s of stepScenarios.value) {
        await createScenarioItem({
          scenarioDefId: scenarioDefs.value[0].id,
          stepNumber: s.step_number,
          deliveryChannel: s.delivery_channel,
          templateId: s.template_id || null,
          delayMinutes: s.delay_minutes,
        })
      }
    }
    if (!selectedScenarioDefId.value && scenarioDefs.value.length > 0) {
      await selectScenarioDef(scenarioDefs.value[0].id)
    }
  }

  const fetchScenarioItems = async (scenarioDefId) => {
    if (!scenarioDefId) { scenarioItems.value = []; return }
    const { data } = await supabase
      .from('step_scenario_items')
      .select('*')
      .eq('scenario_def_id', scenarioDefId)
      .order('step_number', { ascending: true })
    scenarioItems.value = data || []
  }

  const selectScenarioDef = async (id) => {
    selectedScenarioDefId.value = id
    selectedScenarioItemId.value = null
    await fetchScenarioItems(id)
  }

  const createScenarioDef = async (name, isActive = false) => {
    if (!name?.trim() || !currentTenantId.value) return
    const { data } = await supabase.from('step_scenario_defs').insert([{
      tenant_id: currentTenantId.value,
      name,
      is_active: isActive,
    }]).select().single()
    if (data) {
      scenarioDefs.value.push(data)
      await selectScenarioDef(data.id)
    }
  }

  const updateScenarioTrigger = async ({ id, triggerType, triggerStage, triggerDays }) => {
    const patch = {
      trigger_type: triggerType,
      trigger_stage: triggerType === '滞留検知' ? triggerStage : null,
      trigger_days: triggerType === '滞留検知' ? triggerDays : null,
    }
    await supabase.from('step_scenario_defs').update(patch).eq('id', id)
    const def = scenarioDefs.value.find(s => s.id === id)
    if (def) Object.assign(def, patch)
  }

  const deleteScenarioDef = async (id) => {
    await supabase.from('step_scenario_defs').delete().eq('id', id)
    scenarioDefs.value = scenarioDefs.value.filter(s => s.id !== id)
    if (selectedScenarioDefId.value === id) {
      selectedScenarioDefId.value = null
      scenarioItems.value = []
      if (scenarioDefs.value.length > 0) await selectScenarioDef(scenarioDefs.value[0].id)
    }
  }

  const createScenarioItem = async ({ scenarioDefId, stepNumber, deliveryChannel, templateId, delayMinutes }) => {
    if (!scenarioDefId || !currentTenantId.value) return
    const { data } = await supabase.from('step_scenario_items').insert([{
      tenant_id: currentTenantId.value,
      scenario_def_id: scenarioDefId,
      step_number: stepNumber,
      delivery_channel: deliveryChannel || 'LINE',
      template_id: templateId || null,
      delay_minutes: delayMinutes ?? 0,
    }]).select().single()
    if (data && scenarioDefId === selectedScenarioDefId.value) scenarioItems.value.push(data)
    return data
  }

  const addScenarioItemToSelected = async () => {
    if (!selectedScenarioDefId.value) return
    const nextStep = scenarioItems.value.length + 1
    const item = await createScenarioItem({
      scenarioDefId: selectedScenarioDefId.value,
      stepNumber: nextStep,
      deliveryChannel: 'LINE',
      delayMinutes: nextStep,
    })
    if (item) selectedScenarioItemId.value = item.id
  }

  const updateScenarioItem = async ({ id, ...fields }) => {
    const patch = {}
    if (fields.deliveryChannel !== undefined) patch.delivery_channel = fields.deliveryChannel
    if (fields.templateId !== undefined) patch.template_id = fields.templateId || null
    if (fields.delayMinutes !== undefined) patch.delay_minutes = fields.delayMinutes
    await supabase.from('step_scenario_items').update(patch).eq('id', id)
    const item = scenarioItems.value.find(i => i.id === id)
    if (item) Object.assign(item, patch)
  }

  const deleteScenarioItem = async (id) => {
    await supabase.from('step_scenario_items').delete().eq('id', id)
    scenarioItems.value = scenarioItems.value.filter(i => i.id !== id)
    if (selectedScenarioItemId.value === id) selectedScenarioItemId.value = null
  }

  const toggleScenarioActive = async (id) => {
    await supabase.from('step_scenario_defs').update({ is_active: false }).neq('id', id).eq('tenant_id', currentTenantId.value)
    await supabase.from('step_scenario_defs').update({ is_active: true }).eq('id', id)
    scenarioDefs.value.forEach(s => { s.is_active = s.id === id })
  }

  // --- タグ・セグメント ---
  const savedSegments = ref([])
  const fetchSavedSegments = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('saved_segments')
      .select('*')
      .eq('tenant_id', currentTenantId.value)
      .order('created_at', { ascending: false })
    savedSegments.value = data || []
  }
  const createSavedSegment = async ({ name, segmentFilter, tagFilter }) => {
    if (!name?.trim() || !currentTenantId.value) return
    await supabase.from('saved_segments').insert([{
      tenant_id: currentTenantId.value,
      name,
      segment_filter: segmentFilter || null,
      tag_filter: tagFilter || [],
    }])
    await fetchSavedSegments()
  }
  const deleteSavedSegment = async (id) => {
    await supabase.from('saved_segments').delete().eq('id', id)
    savedSegments.value = savedSegments.value.filter(s => s.id !== id)
  }

  // --- タググループ（親子関係） ---
  const tagGroups = ref([])
  const tagDefinitions = ref([])

  const fetchTagGroups = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('tag_groups')
      .select('*')
      .eq('tenant_id', currentTenantId.value)
      .order('sort_order', { ascending: true })
    tagGroups.value = data || []
  }

  const fetchTagDefinitions = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('tag_definitions')
      .select('*')
      .eq('tenant_id', currentTenantId.value)
      .order('sort_order', { ascending: true })
    tagDefinitions.value = data || []
  }

  const createTagGroup = async (name) => {
    if (!name?.trim() || !currentTenantId.value) return
    const { data } = await supabase.from('tag_groups').insert([{
      tenant_id: currentTenantId.value,
      name,
      sort_order: tagGroups.value.length,
    }]).select().single()
    if (data) tagGroups.value.push(data)
  }

  const deleteTagGroup = async (id) => {
    await supabase.from('tag_groups').delete().eq('id', id)
    tagGroups.value = tagGroups.value.filter(g => g.id !== id)
    tagDefinitions.value.forEach(t => { if (t.group_id === id) t.group_id = null })
  }

  const createTagDefinition = async ({ name, groupId }) => {
    if (!name?.trim() || !currentTenantId.value) return
    const { data, error } = await supabase.from('tag_definitions').insert([{
      tenant_id: currentTenantId.value,
      name,
      group_id: groupId || null,
      sort_order: tagDefinitions.value.filter(t => t.group_id === (groupId || null)).length,
    }]).select().single()
    if (data) tagDefinitions.value.push(data)
    if (error && error.code === '23505') alert('同名のタグが既に存在します')
  }

  const assignTagToGroup = async ({ id, groupId }) => {
    await supabase.from('tag_definitions').update({ group_id: groupId || null }).eq('id', id)
    const t = tagDefinitions.value.find(t => t.id === id)
    if (t) t.group_id = groupId || null
  }

  const deleteTagDefinition = async (id) => {
    await supabase.from('tag_definitions').delete().eq('id', id)
    tagDefinitions.value = tagDefinitions.value.filter(t => t.id !== id)
  }

  // --- カレンダー ---
  const calendarEvents = ref([])
  const calendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const fetchCalendarEvents = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('tenant_id', currentTenantId.value)
      .order('event_date', { ascending: true })
    calendarEvents.value = data || []
  }
  const createCalendarEvent = async ({ title, eventDate, eventType }) => {
    if (!title?.trim() || !eventDate || !currentTenantId.value) return
    await supabase.from('calendar_events').insert([{
      tenant_id: currentTenantId.value,
      title,
      event_date: eventDate,
      event_type: eventType || '予約',
    }])
    await fetchCalendarEvents()
  }
  const deleteCalendarEvent = async (id) => {
    await supabase.from('calendar_events').delete().eq('id', id)
    calendarEvents.value = calendarEvents.value.filter(e => e.id !== id)
  }

  // --- 自動応答 ---
  const autoreplyRules = ref([])
  const fetchAutoreplyRules = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('autoreply_rules')
      .select('*')
      .eq('tenant_id', currentTenantId.value)
      .order('created_at', { ascending: false })
    autoreplyRules.value = data || []
  }
  const createAutoreplyRule = async ({ keyword, matchType, replyContent, channel }) => {
    if (!keyword?.trim() || !currentTenantId.value) return
    await supabase.from('autoreply_rules').insert([{
      tenant_id: currentTenantId.value,
      keyword,
      match_type: matchType || '部分一致',
      reply_content: replyContent || '',
      channel: channel || 'LINE',
    }])
    await fetchAutoreplyRules()
  }
  const toggleAutoreplyRule = async ({ id, enabled }) => {
    await supabase.from('autoreply_rules').update({ enabled }).eq('id', id)
    const r = autoreplyRules.value.find(r => r.id === id)
    if (r) r.enabled = enabled
  }
  const deleteAutoreplyRule = async (id) => {
    await supabase.from('autoreply_rules').delete().eq('id', id)
    autoreplyRules.value = autoreplyRules.value.filter(r => r.id !== id)
  }

  // --- 受信トレイ ---
  const conversations = ref([])
  const selectedConversationId = ref(null)
  const inboxMessages = ref([])
  const inboxDraft = ref('')
  const isSendingInbox = ref(false)

  const selectedConversation = computed(() =>
    conversations.value.find(c => c.id === selectedConversationId.value) || null
  )

  const fetchConversations = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('conversations')
      .select('*, customers(name, line_uid, email, phone, segment, tags)')
      .eq('tenant_id', currentTenantId.value)
      .order('last_message_at', { ascending: false })
    conversations.value = data || []
    if (!selectedConversationId.value && conversations.value.length > 0) {
      await selectConversation(conversations.value[0].id)
    }
  }

  const fetchInboxMessages = async (conversationId) => {
    if (!conversationId) return
    const { data } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    inboxMessages.value = data || []
  }

  const selectConversation = async (conversationId) => {
    selectedConversationId.value = conversationId
    await fetchInboxMessages(conversationId)
    const conv = conversations.value.find(c => c.id === conversationId)
    if (conv?.unread) {
      await supabase.from('conversations').update({ unread: false }).eq('id', conversationId)
      conv.unread = false
    }
  }

  const toggleConversationStatus = async ({ id, status }) => {
    await supabase.from('conversations').update({ status }).eq('id', id)
    const conv = conversations.value.find(c => c.id === id)
    if (conv) conv.status = status
  }

  const sendInboxMessage = async () => {
    const conv = selectedConversation.value
    if (!conv || !inboxDraft.value.trim() || !currentTenantId.value) return
    isSendingInbox.value = true
    try {
      const text = inboxDraft.value
      if (conv.channel === 'LINE' && conv.customers?.line_uid && conv.customers.line_uid !== '未連携') {
        await sendLineMessage(supabase, { lineUid: conv.customers.line_uid, textContent: text })
      }
      await supabase.from('inbox_messages').insert([{
        tenant_id: currentTenantId.value,
        conversation_id: conv.id,
        direction: 'outbound',
        channel: conv.channel,
        content: text,
      }])
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conv.id)
      inboxDraft.value = ''
      await fetchInboxMessages(conv.id)
      await fetchConversations()
    } catch (e) {
      alert(e.message)
    } finally {
      isSendingInbox.value = false
    }
  }

  const generateStepContent = async ({ channel, segment, prompt }) => {
    stepAiLoading.value = true
    stepAiResult.value = ''
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: { prompt, channel, segment },
      })
      if (error) throw error
      stepAiResult.value = data.content || ''
    } catch (e) {
      stepAiResult.value = `エラー: ${e.message}`
    } finally {
      stepAiLoading.value = false
    }
  }

  const totalStats = computed(() => {
    if (!broadcastTasks.value || broadcastTasks.value.length === 0) {
      return { sent: 0, delivered: 0, opened: 0, clicked: 0 }
    }
    const completedTasks = broadcastTasks.value.filter((t) => t?.status === '完了' || t?.status === '一部失敗')
    let sent = 0
    let delivered = 0
    let opened = 0
    let clicked = 0
    completedTasks.forEach((t) => {
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
    broadcastTasks.value.forEach((t) => {
      const ch = t?.delivery_channel || t?.broadcast_templates?.delivery_channel
      if (stats[ch] !== undefined) {
        stats[ch] += t?.sent_count || 0
      }
    })
    return stats
  })

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('broadcast_templates')
      .select('*')
      .eq('tenant_id', currentTenantId.value)
      .order('created_at', { ascending: false })
    savedTemplates.value = data || []
  }

  const fetchBroadcastTasks = async () => {
    const { data } = await supabase
      .from('broadcast_tasks')
      .select('*, broadcast_templates(title, target_segment, delivery_channel), broadcast_queues(id, status)')
      .eq('tenant_id', currentTenantId.value)
      .order('created_at', { ascending: false })
    broadcastTasks.value = data || []
  }

  const fetchCustomers = async () => {
    let query = supabase.from('customers').select('*').eq('tenant_id', currentTenantId.value)
    if (selectedSegment.value !== 'ALL') query = query.eq('segment', selectedSegment.value)
    const { data } = await query.order('created_at', { ascending: false })
    customers.value = data || []
    if (customers.value.length > 0) selectedCustomer.value = customers.value[0]
  }

  // --- 人材業界: 選考パイプライン・担当者アサイン ---
  const pipelineStages = ['会員登録', '面談予約', '面談実施', '内定', '就業']
  const teamMembers = ref([])

  const fetchTeamMembers = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('tenant_id', currentTenantId.value)
    teamMembers.value = data || []
  }

  const currentUserId = ref(null)

  const updateMyDisplayName = async (name) => {
    if (!currentUserId.value) return
    await supabase.from('profiles').update({ display_name: name }).eq('id', currentUserId.value)
    const m = teamMembers.value.find(m => m.id === currentUserId.value)
    if (m) m.display_name = name
  }

  // --- 外部CRM/ATS連携（接続先未定のため汎用スキーマ） ---
  const integrationConfigs = ref([])

  const fetchIntegrationConfigs = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('tenant_id', currentTenantId.value)
      .order('created_at', { ascending: true })
    integrationConfigs.value = data || []
  }

  const saveIntegrationConfig = async ({ provider, webhookUrl }) => {
    if (!currentTenantId.value) return
    const { data } = await supabase.from('integration_configs').insert([{
      tenant_id: currentTenantId.value,
      provider: provider || 'custom',
      webhook_url: webhookUrl || null,
      enabled: false,
    }]).select().single()
    if (data) integrationConfigs.value.push(data)
  }

  const toggleIntegrationConfig = async ({ id, enabled }) => {
    await supabase.from('integration_configs').update({ enabled }).eq('id', id)
    const c = integrationConfigs.value.find(c => c.id === id)
    if (c) c.enabled = enabled
  }

  const deleteIntegrationConfig = async (id) => {
    await supabase.from('integration_configs').delete().eq('id', id)
    integrationConfigs.value = integrationConfigs.value.filter(c => c.id !== id)
  }

  const updateCustomerStage = async ({ id, stage }) => {
    await supabase.from('customers').update({ pipeline_stage: stage, last_contacted_at: new Date().toISOString() }).eq('id', id)
    const c = customers.value.find(c => c.id === id)
    if (c) c.pipeline_stage = stage
    if (selectedCustomer.value?.id === id) selectedCustomer.value = { ...selectedCustomer.value, pipeline_stage: stage }
  }

  const assignRecruiter = async ({ id, recruiterId }) => {
    await supabase.from('customers').update({ assigned_to: recruiterId || null }).eq('id', id)
    const c = customers.value.find(c => c.id === id)
    if (c) c.assigned_to = recruiterId || null
    if (selectedCustomer.value?.id === id) selectedCustomer.value = { ...selectedCustomer.value, assigned_to: recruiterId || null }
  }

  // 開封・クリックの多さと最終接触からの経過日数からスコアを算出（0-100）
  const engagementScore = (customer) => {
    if (!customer) return 0
    let score = 0
    const stageWeight = { '会員登録': 10, '面談予約': 30, '面談実施': 55, '内定': 80, '就業': 100 }
    score = stageWeight[customer.pipeline_stage] || 0
    if (customer.last_contacted_at) {
      const days = (Date.now() - new Date(customer.last_contacted_at).getTime()) / 86400000
      if (days > 14) score -= 20
      else if (days > 7) score -= 10
    } else {
      score -= 15
    }
    return Math.max(0, Math.min(100, score))
  }

  const fetchStepQueues = async () => {
    if (!currentTenantId.value) return
    const { data } = await supabase
      .from('step_broadcast_queues')
      .select('*, customers(name, segment)')
      .eq('tenant_id', currentTenantId.value)
      .order('scheduled_at', { ascending: false })
    stepQueues.value = data || []
  }

  const fetchCampaigns = async () => {
    if (!currentTenantId.value) return
    try {
      const { data } = await supabase
        .from('survey_campaigns')
        .select('*')
        .eq('tenant_id', currentTenantId.value)
        .order('created_at', { ascending: false })
      surveyCampaigns.value = data || []
      if (data?.length > 0 && !selectedCampaignId.value) {
        const active = data.find((c) => c.is_active)
        const first = active || data[0]
        selectedCampaignId.value = first.id
        flowJson.value = first.flow_json || null
        await fetchQuestionsByCampaign()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const fetchQuestionsByCampaign = async () => {
    if (!selectedCampaignId.value) return
    try {
      const { data } = await supabase
        .from('survey_questions')
        .select('*, survey_choices(*)')
        .eq('campaign_id', selectedCampaignId.value)
        .order('sort_order', { ascending: true })
      surveyQuestions.value = data || []
    } catch (error) {
      console.error(error)
    }
  }

  const fetchUserTenant = async (userId) => {
    currentUserId.value = userId
    const { data } = await supabase.from('profiles').select('tenant_id').eq('id', userId).single()
    if (data) {
      currentTenantId.value = data.tenant_id
      await Promise.all([
        fetchTemplates(),
        fetchBroadcastTasks(),
        fetchCampaigns(),
        fetchCustomers(),
        fetchStepQueues(),
        fetchSavedSegments(),
        fetchCalendarEvents(),
        fetchAutoreplyRules(),
        fetchConversations(),
        fetchIntegrationConfigs(),
        fetchTagGroups(),
        fetchTagDefinitions(),
      ])
      await fetchScenarioDefs()
      await fetchTeamMembers()
      // Realtime: step_broadcast_queues の変化を購読
      supabase
        .channel('step-queues-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'step_broadcast_queues',
          filter: `tenant_id=eq.${data.tenant_id}`,
        }, () => { fetchStepQueues() })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'broadcast_tasks',
          filter: `tenant_id=eq.${data.tenant_id}`,
        }, () => { fetchBroadcastTasks() })
        .subscribe()

      // Realtime: 受信トレイの会話・メッセージ
      supabase
        .channel('inbox-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `tenant_id=eq.${data.tenant_id}`,
        }, () => { fetchConversations() })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'inbox_messages',
          filter: `tenant_id=eq.${data.tenant_id}`,
        }, (payload) => {
          if (payload.new?.conversation_id === selectedConversationId.value) {
            fetchInboxMessages(selectedConversationId.value)
          }
        })
        .subscribe()
    }
  }

  const updateCustomerSegment = async ({ id, segment }) => {
    await supabase.from('customers').update({ segment }).eq('id', id)
    const c = customers.value.find(c => c.id === id)
    if (c) c.segment = segment
    if (selectedCustomer.value?.id === id) selectedCustomer.value = { ...selectedCustomer.value, segment }
  }

  const addCustomerTag = async ({ id, tag }) => {
    if (!tag?.trim()) return
    const c = customers.value.find(c => c.id === id)
    const current = c?.tags || []
    if (current.includes(tag)) return
    const tags = [...current, tag]
    await supabase.from('customers').update({ tags }).eq('id', id)
    if (c) c.tags = tags
    if (selectedCustomer.value?.id === id) selectedCustomer.value = { ...selectedCustomer.value, tags }
  }

  const removeCustomerTag = async ({ id, tag }) => {
    const c = customers.value.find(c => c.id === id)
    const tags = (c?.tags || []).filter(t => t !== tag)
    await supabase.from('customers').update({ tags }).eq('id', id)
    if (c) c.tags = tags
    if (selectedCustomer.value?.id === id) selectedCustomer.value = { ...selectedCustomer.value, tags }
  }

  const handleCreateCustomer = async () => {
    if (!newCustomer.value.name || !currentTenantId.value) return
    isSaving.value = true
    try {
      const { error } = await supabase.from('customers').insert([
        {
          tenant_id: currentTenantId.value,
          name: newCustomer.value.name,
          line_uid: newCustomer.value.line_uid || '未連携',
          segment: newCustomer.value.segment,
        },
      ])
      if (error) throw error
      newCustomer.value = { name: '', email: '', phone: '', line_uid: '', segment: '集客最大化タイプ' }
      isModalOpen.value = false
      await fetchCustomers()
    } catch (error) {
      alert(error.message)
    } finally {
      isSaving.value = false
    }
  }

  const handleSelectCampaign = async (id) => {
    selectedCampaignId.value = id
    await fetchQuestionsByCampaign()
    const camp = surveyCampaigns.value.find(c => c.id === id)
    flowJson.value = camp?.flow_json || null
  }

  const handleSaveFlow = async ({ nodes, connections }) => {
    if (!selectedCampaignId.value) return
    const json = { nodes, connections }
    await supabase
      .from('survey_campaigns')
      .update({ flow_json: json })
      .eq('id', selectedCampaignId.value)
    const idx = surveyCampaigns.value.findIndex(c => c.id === selectedCampaignId.value)
    if (idx >= 0) surveyCampaigns.value[idx].flow_json = json
  }

  const handleCreateCampaign = async () => {
    if (!newCampaignTitle.value) return
    await supabase
      .from('survey_campaigns')
      .insert([{ tenant_id: currentTenantId.value, title: newCampaignTitle.value, is_active: false }])
    newCampaignTitle.value = ''
    await fetchCampaigns()
  }

  const handleToggleActiveCampaign = async (id) => {
    await supabase.from('survey_campaigns').update({ is_active: false }).eq('tenant_id', currentTenantId.value)
    await supabase.from('survey_campaigns').update({ is_active: true }).eq('id', id)
    await fetchCampaigns()
    alert('🎯 LINE流入時診断を切り替えました！')
  }

  const handleCreateQuestion = async () => {
    if (!newQuestionText.value || !selectedCampaignId.value) return
    isCreatingQuestion.value = true
    await supabase.from('survey_questions').insert([
      {
        tenant_id: currentTenantId.value,
        campaign_id: selectedCampaignId.value,
        question_text: newQuestionText.value,
        sort_order: surveyQuestions.value.length + 1,
      },
    ])
    newQuestionText.value = ''
    await fetchQuestionsByCampaign()
    isCreatingQuestion.value = false
  }

  const handleAddChoice = async (questionId) => {
    const choiceText = prompt('選択肢を入力してください')
    if (!choiceText) return
    const assignedSegment = prompt('紐付けるセグメント名を入力してください', '集客最大化タイプ')
    if (!assignedSegment) return
    await supabase
      .from('survey_choices')
      .insert([{ question_id: questionId, choice_text: choiceText, assigned_segment: assignedSegment }])
    await fetchQuestionsByCampaign()
  }

  const addScenarioStep = () => {
    const nextStep = stepScenarios.value.length + 1
    stepScenarios.value.push({
      step_number: nextStep,
      delay_minutes: nextStep,
      delivery_channel: 'LINE',
      template_id: '',
      description: `自動追客ステップ #${nextStep}`,
    })
  }

  const handleLiffSubmit = async () => {
    if (!liffSelectedCustomerId.value) {
      alert('顧客を選択してください')
      return
    }
    let finalSegment = '未診断'
    if (surveyQuestions.value && surveyQuestions.value.length > 0) {
      for (const q of surveyQuestions.value) {
        const selectedChoiceId = liffAnswers.value[q.id]
        if (selectedChoiceId) {
          const choice = q.survey_choices?.find((c) => c.id === selectedChoiceId)
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
      const insertData = stepScenarios.value.map((scenario) => {
        const scheduledTime = new Date(now.getTime() + scenario.delay_minutes * 60 * 1000).toISOString()
        return {
          tenant_id: currentTenantId.value,
          customer_id: liffSelectedCustomerId.value,
          step_number: scenario.step_number,
          delivery_channel: scenario.delivery_channel,
          template_id: scenario.template_id || null,
          scheduled_at: scheduledTime,
          status: '未送信',
        }
      })

      if (insertData.length > 0) {
        const { error: insertError } = await supabase.from('step_broadcast_queues').insert(insertData)
        if (insertError) throw insertError
      }

      alert(
        `🎯 診断完了！セグメント【${finalSegment}】になりました。\n🚀 設計された ${insertData.length} 個の自動追客ステップが予約されました！`
      )
      liffAnswers.value = {}
      activeTab.value = 'customers'
      await Promise.all([fetchCustomers(), fetchStepQueues()])
    } catch (e) {
      alert(e.message)
    } finally {
      isLiffSubmitting.value = false
    }
  }

  const simulateAIGeneration = () => {
    if (!aiPurpose.value) return
    isGenerating.value = true
    generatedContent.value = ''
    generatedImageUrl.value = ''
    generatedFlexJson.value = null
    emailSubject.value = ''

    setTimeout(() => {
      isGenerating.value = false
      const isGrowth = aiTargetSegment.value === '集客最大化タイプ'
      generatedImageUrl.value = isGrowth
        ? 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600'
        : 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600'

      if (selectedChannel.value === 'LINE') {
        generatedContent.value = `【診断結果: ${aiTargetSegment.value}】\n\nあなたに最適なマーケティング戦略をAIが分析しました。詳細は下記の限定カードをご確認ください！`
        generatedFlexJson.value = {
          type: 'bubble',
          hero: {
            type: 'image',
            url: generatedImageUrl.value,
            size: 'full',
            aspectRatio: '20:13',
            aspectMode: 'cover',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: aiTargetSegment.value, weight: 'bold', size: 'xl' }],
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: { type: 'uri', label: '🔒 セミナー枠を確定する', uri: 'https://example.com' },
                style: 'primary',
                color: '#4f46e5',
              },
            ],
          },
        }
      } else if (selectedChannel.value === 'Email') {
        emailSubject.value = `【診断フィードバック】${aiTargetSegment.value}向け限定レポート`
        generatedContent.value = `AI Omni CRM 診断フィードバック\n\n診断結果に基づき、あなたのビジネスを加速させる【${aiTargetSegment.value}】のための具体策をご提案します。\n\n詳細はこちら： https://example.com/report`
      } else if (selectedChannel.value === 'SMS') {
        generatedContent.value = `【AI CRM】診断完了。${aiTargetSegment.value}のあなたへ限定最適化計画！詳細： https://example.com/c`
      }
      templateTitle.value = `${aiTargetSegment.value}向け-${selectedChannel.value}配信アセット`
    }, 300)
  }

  const deleteTemplate = async (id) => {
    if (!id) return
    await supabase.from('broadcast_templates').delete().eq('id', id)
    await fetchTemplates()
  }

  const saveTemplate = async () => {
    if (!generatedContent.value || !currentTenantId.value) return
    await supabase.from('broadcast_templates').insert([
      {
        tenant_id: currentTenantId.value,
        title: templateTitle.value,
        content: generatedContent.value,
        html_content: generatedEmailHtml.value || null,
        image_url: generatedImageUrl.value || null,
        flex_json: generatedFlexJson.value || null,
        messages_json: generatedMessagesJson.value || null,
        email_subject: emailSubject.value || null,
        delivery_channel: selectedChannel.value,
        target_segment: aiTargetSegment.value,
      },
    ])
    alert('🎉 保存しました！')
    await fetchTemplates()
    generatedContent.value = ''
    generatedImageUrl.value = ''
    generatedFlexJson.value = null
    generatedMessagesJson.value = null
    generatedEmailHtml.value = ''
    emailSubject.value = ''
  }

  const handleReserveBroadcast = async () => {
    if (!selectedTemplateId.value || !broadcastTitle.value || !scheduledAt.value) return
    isReserving.value = true
    const targetTemplate = savedTemplates.value.find((t) => t.id === selectedTemplateId.value)
    const { data: taskData } = await supabase
      .from('broadcast_tasks')
      .insert([
        {
          tenant_id: currentTenantId.value,
          template_id: selectedTemplateId.value,
          title: broadcastTitle.value,
          scheduled_at: new Date(scheduledAt.value).toISOString(),
          status: '予約中',
          delivery_channel: targetTemplate.delivery_channel,
          sent_count: 0,
          delivered_count: 0,
          opened_count: 0,
          clicked_count: 0,
        },
      ])
      .select()
      .single()
    let customerQuery = supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', currentTenantId.value)

    const savedSegment = broadcastTargetSavedSegmentId.value
      ? savedSegments.value.find((s) => s.id === broadcastTargetSavedSegmentId.value)
      : null

    if (savedSegment) {
      if (savedSegment.segment_filter) customerQuery = customerQuery.eq('segment', savedSegment.segment_filter)
      if (savedSegment.tag_filter?.length) customerQuery = customerQuery.overlaps('tags', savedSegment.tag_filter)
    } else {
      const seg = broadcastTargetSegment.value !== 'ALL'
        ? broadcastTargetSegment.value
        : targetTemplate.target_segment
      if (seg) customerQuery = customerQuery.eq('segment', seg)
    }
    const { data: targetCustomers } = await customerQuery
    if (targetCustomers?.length > 0) {
      await supabase
        .from('broadcast_queues')
        .insert(targetCustomers.map((c) => ({ task_id: taskData.id, customer_id: c.id, status: '未送信' })))
      alert(`予約完了（対象: ${targetCustomers.length}名）`)
    }
    await fetchBroadcastTasks()
    isReserving.value = false
  }

  const handleExecuteBroadcast = async (taskId) => {
    processingTaskId.value = taskId
    try {
      await supabase.from('broadcast_tasks').update({ status: '配信中' }).eq('id', taskId)

      const { data: queues, error: queuesError } = await supabase
        .from('broadcast_queues')
        .select('*, customers(line_uid)')
        .eq('task_id', taskId)
        .eq('status', '未送信')
      if (queuesError) throw queuesError

      const { data: taskData, error: taskError } = await supabase
        .from('broadcast_tasks')
        .select('*, broadcast_templates(*)')
        .eq('id', taskId)
        .single()
      if (taskError) throw taskError

      const template = taskData.broadcast_templates
      const channel = taskData.delivery_channel || template.delivery_channel

      let successCount = 0
      let failureCount = 0

      if (queues && queues.length > 0) {
        for (const q of queues) {
          try {
            const trackingParams = {
              tenantId: currentTenantId.value,
              customerId: q.customer_id,
              taskId: taskId,
              queueId: q.id,
              channel,
            }

            const emailSource = template.html_content || template.content
            let trackedContent = template.content
            if (channel === 'Email') {
              trackedContent = injectEmailTracking(emailSource, trackingParams)
            } else if (channel === 'SMS') {
              trackedContent = buildSmsContent(template.content, trackingParams)
            } else if (channel === 'LINE') {
              trackedContent = rewriteUrls(template.content, trackingParams)
            }

            if (channel === 'LINE' && q.customers?.line_uid && q.customers.line_uid !== '未連携') {
              await sendLineMessage(supabase, {
                lineUid: q.customers.line_uid,
                flexJson: template.flex_json,
                textContent: trackedContent,
                messages: template.messages_json?.length ? template.messages_json : undefined,
              })
            } else {
              await simulateChannelDelivery(channel)
            }
            await supabase
              .from('broadcast_queues')
              .update({ status: '送信成功', sent_at: new Date().toISOString() })
              .eq('id', q.id)
            successCount++
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            await supabase
              .from('broadcast_queues')
              .update({ status: '送信失敗', sent_at: new Date().toISOString() })
              .eq('id', q.id)
            failureCount++
            console.error(`[broadcast] queue ${q.id} failed:`, message)
          }
        }
      }

      let taskStatus = '完了'
      if (failureCount > 0 && successCount === 0) taskStatus = '失敗'
      else if (failureCount > 0) taskStatus = '一部失敗'

      await supabase
        .from('broadcast_tasks')
        .update({
          status: taskStatus,
          sent_count: successCount,
          delivered_count: successCount,
          opened_count: 0,
          clicked_count: 0,
        })
        .eq('id', taskId)

      if (failureCount > 0) {
        alert(`配信終了: 成功 ${successCount}件 / 失敗 ${failureCount}件`)
      } else {
        alert('🚀 配信完了！')
      }
      await fetchBroadcastTasks()
      await fetchCustomers()
    } catch (error) {
      await supabase.from('broadcast_tasks').update({ status: '失敗' }).eq('id', taskId)
      alert(error.message)
      await fetchBroadcastTasks()
    } finally {
      processingTaskId.value = null
    }
  }

  const handleLogin = async () => {
    loading.value = true
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) {
      alert(`ログイン失敗: ${error.message}`)
    } else {
      isLoggedIn.value = true
      userEmail.value = data.user.email
      await fetchUserTenant(data.user.id)
    }
    loading.value = false
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    isLoggedIn.value = false
  }

  onMounted(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      isLoggedIn.value = true
      userEmail.value = session.user.email
      await fetchUserTenant(session.user.id)
    }
  })

  return {
    activeTab,
    isLoggedIn,
    loading,
    userEmail,
    email,
    password,
    currentTenantId,
    customers,
    selectedSegment,
    selectedCustomer,
    isModalOpen,
    isSaving,
    newCustomer,
    stepScenarios,
    stepQueues,
    selectedChannel,
    aiTargetSegment,
    isGenerating,
    generatedContent,
    generatedImageUrl,
    generatedMessagesJson,
    generatedEmailHtml,
    aiPurpose,
    templateTitle,
    savedTemplates,
    selectedTemplateId,
    broadcastTitle,
    scheduledAt,
    broadcastTargetSegment,
    broadcastTargetSavedSegmentId,
    isReserving,
    broadcastTasks,
    processingTaskId,
    surveyCampaigns,
    selectedCampaignId,
    surveyQuestions,
    flowJson,
    newCampaignTitle,
    newQuestionText,
    isCreatingQuestion,
    liffSelectedCustomerId,
    liffAnswers,
    isLiffSubmitting,
    totalStats,
    channelStats,
    fetchCustomers,
    handleCreateCustomer,
    updateCustomerSegment,
    addCustomerTag,
    removeCustomerTag,
    handleSelectCampaign,
    handleSaveFlow,
    handleCreateCampaign,
    handleToggleActiveCampaign,
    handleCreateQuestion,
    handleAddChoice,
    addScenarioStep,
    handleLiffSubmit,
    simulateAIGeneration,
    deleteTemplate,
    saveTemplate,
    handleReserveBroadcast,
    handleExecuteBroadcast,
    handleLogin,
    handleLogout,
    stepAiPrompt,
    stepAiResult,
    stepAiLoading,
    generateStepContent,
    savedSegments,
    createSavedSegment,
    deleteSavedSegment,
    tagGroups,
    tagDefinitions,
    createTagGroup,
    deleteTagGroup,
    createTagDefinition,
    assignTagToGroup,
    deleteTagDefinition,
    calendarEvents,
    calendarMonth,
    createCalendarEvent,
    deleteCalendarEvent,
    autoreplyRules,
    createAutoreplyRule,
    toggleAutoreplyRule,
    deleteAutoreplyRule,
    conversations,
    selectedConversationId,
    selectedConversation,
    inboxMessages,
    inboxDraft,
    isSendingInbox,
    selectConversation,
    sendInboxMessage,
    toggleConversationStatus,
    scenarioDefs,
    selectedScenarioDefId,
    selectedScenarioDef,
    scenarioItems,
    selectedScenarioItemId,
    selectedScenarioItem,
    selectScenarioDef,
    createScenarioDef,
    deleteScenarioDef,
    addScenarioItemToSelected,
    updateScenarioItem,
    deleteScenarioItem,
    toggleScenarioActive,
    updateScenarioTrigger,
    pipelineStages,
    teamMembers,
    updateCustomerStage,
    assignRecruiter,
    engagementScore,
    currentUserId,
    updateMyDisplayName,
    integrationConfigs,
    saveIntegrationConfig,
    toggleIntegrationConfig,
    deleteIntegrationConfig,
  }
}
