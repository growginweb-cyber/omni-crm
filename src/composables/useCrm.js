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
  const emailSubject = ref('')
  const templateTitle = ref('')
  const savedTemplates = ref([])

  const selectedTemplateId = ref('')
  const broadcastTitle = ref('')
  const scheduledAt = ref('')
  const broadcastTargetSegment = ref('ALL')
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
    const { data } = await supabase.from('profiles').select('tenant_id').eq('id', userId).single()
    if (data) {
      currentTenantId.value = data.tenant_id
      await Promise.all([
        fetchTemplates(),
        fetchBroadcastTasks(),
        fetchCampaigns(),
        fetchCustomers(),
        fetchStepQueues(),
      ])
    }
  }

  const updateCustomerSegment = async ({ id, segment }) => {
    await supabase.from('customers').update({ segment }).eq('id', id)
    const c = customers.value.find(c => c.id === id)
    if (c) c.segment = segment
    if (selectedCustomer.value?.id === id) selectedCustomer.value = { ...selectedCustomer.value, segment }
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
        image_url: generatedImageUrl.value || null,
        flex_json: generatedFlexJson.value || null,
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
    const seg = broadcastTargetSegment.value !== 'ALL'
      ? broadcastTargetSegment.value
      : targetTemplate.target_segment
    if (seg) customerQuery = customerQuery.eq('segment', seg)
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

            let trackedContent = template.content
            if (channel === 'Email') {
              trackedContent = injectEmailTracking(template.content, trackingParams)
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
    aiPurpose,
    templateTitle,
    savedTemplates,
    selectedTemplateId,
    broadcastTitle,
    scheduledAt,
    broadcastTargetSegment,
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
  }
}
