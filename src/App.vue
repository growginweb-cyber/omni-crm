<script setup>
import { useCrm } from './composables/useCrm'
import AppNav from './components/AppNav.vue'
import LoginForm from './components/LoginForm.vue'
import CustomerModal from './components/CustomerModal.vue'
import DashboardTab from './components/tabs/DashboardTab.vue'
import CustomersTab from './components/tabs/CustomersTab.vue'
import ScenariosTab from './components/tabs/ScenariosTab.vue'
import SurveyTab from './components/tabs/SurveyTab.vue'
import AiContentTab from './components/tabs/AiContentTab.vue'
import BroadcastTab from './components/tabs/BroadcastTab.vue'
import UserLiffTab from './components/tabs/UserLiffTab.vue'
import AnalyticsTab from './components/tabs/AnalyticsTab.vue'
import InboxTab from './components/tabs/InboxTab.vue'
import CalendarTab from './components/tabs/CalendarTab.vue'
import AutoReplyTab from './components/tabs/AutoReplyTab.vue'
import TagsSegmentsTab from './components/tabs/TagsSegmentsTab.vue'
import SettingsTab from './components/tabs/SettingsTab.vue'

const crm = useCrm()
</script>

<template>
  <div class="h-screen bg-[#fbfbfc] flex text-slate-800 antialiased">
    <AppNav
      v-if="crm.isLoggedIn.value"
      :activeTab="crm.activeTab.value"
      :currentTenantId="crm.currentTenantId.value"
      :userEmail="crm.userEmail.value"
      :selectedChannel="crm.selectedChannel.value"
      @update:activeTab="crm.activeTab.value = $event"
      @selectChannel="crm.selectedChannel.value = $event"
      @logout="crm.handleLogout"
    />

    <LoginForm
      v-if="!crm.isLoggedIn.value"
      v-model:email="crm.email.value"
      v-model:password="crm.password.value"
      :loading="crm.loading.value"
      @login="crm.handleLogin"
    />

    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <DashboardTab
        v-if="crm.activeTab.value === 'dashboard'"
        :totalStats="crm.totalStats.value"
        :channelStats="crm.channelStats.value"
        :broadcastTasks="crm.broadcastTasks.value"
        :customers="crm.customers.value"
      />

      <InboxTab
        v-else-if="crm.activeTab.value === 'inbox'"
        :conversations="crm.conversations.value"
        :selectedConversationId="crm.selectedConversationId.value"
        :selectedConversation="crm.selectedConversation.value"
        :inboxMessages="crm.inboxMessages.value"
        :inboxDraft="crm.inboxDraft.value"
        :isSendingInbox="crm.isSendingInbox.value"
        @selectConversation="crm.selectConversation"
        @update:inboxDraft="crm.inboxDraft.value = $event"
        @send="crm.sendInboxMessage"
        @toggleStatus="crm.toggleConversationStatus"
      />

      <AnalyticsTab
        v-else-if="crm.activeTab.value === 'analytics'"
        :broadcastTasks="crm.broadcastTasks.value"
        :customers="crm.customers.value"
        :currentTenantId="crm.currentTenantId.value"
      />

      <CalendarTab
        v-else-if="crm.activeTab.value === 'calendar'"
        :calendarEvents="crm.calendarEvents.value"
        :broadcastTasks="crm.broadcastTasks.value"
        @createEvent="crm.createCalendarEvent"
        @deleteEvent="crm.deleteCalendarEvent"
      />

      <AutoReplyTab
        v-else-if="crm.activeTab.value === 'autoreply'"
        :autoreplyRules="crm.autoreplyRules.value"
        @createRule="crm.createAutoreplyRule"
        @toggleRule="crm.toggleAutoreplyRule"
        @deleteRule="crm.deleteAutoreplyRule"
      />

      <TagsSegmentsTab
        v-else-if="crm.activeTab.value === 'tags'"
        :customers="crm.customers.value"
        :savedSegments="crm.savedSegments.value"
        @createSegment="crm.createSavedSegment"
        @deleteSegment="crm.deleteSavedSegment"
      />

      <CustomersTab
        v-else-if="crm.activeTab.value === 'customers'"
        :customers="crm.customers.value"
        :selectedSegment="crm.selectedSegment.value"
        :selectedCustomer="crm.selectedCustomer.value"
        :stepQueues="crm.stepQueues.value"
        :pipelineStages="crm.pipelineStages"
        :teamMembers="crm.teamMembers.value"
        @update:selectedSegment="crm.selectedSegment.value = $event"
        @update:selectedCustomer="crm.selectedCustomer.value = $event"
        @openModal="crm.isModalOpen.value = true"
        @fetchCustomers="crm.fetchCustomers"
        @updateSegment="crm.updateCustomerSegment"
        @addTag="crm.addCustomerTag"
        @removeTag="crm.removeCustomerTag"
        @updateStage="crm.updateCustomerStage"
        @assignRecruiter="crm.assignRecruiter"
      />

      <ScenariosTab
        v-else-if="crm.activeTab.value === 'scenarios'"
        :scenarioDefs="crm.scenarioDefs.value"
        :selectedScenarioDefId="crm.selectedScenarioDefId.value"
        :selectedScenarioDef="crm.selectedScenarioDef.value"
        :scenarioItems="crm.scenarioItems.value"
        :selectedScenarioItemId="crm.selectedScenarioItemId.value"
        :selectedScenarioItem="crm.selectedScenarioItem.value"
        :savedTemplates="crm.savedTemplates.value"
        :stepQueues="crm.stepQueues.value"
        :stepAiPrompt="crm.stepAiPrompt.value"
        :stepAiResult="crm.stepAiResult.value"
        :stepAiLoading="crm.stepAiLoading.value"
        :pipelineStages="crm.pipelineStages"
        @selectScenarioDef="crm.selectScenarioDef"
        @createScenarioDef="crm.createScenarioDef"
        @deleteScenarioDef="crm.deleteScenarioDef"
        @selectScenarioItem="crm.selectedScenarioItemId.value = $event"
        @addScenarioItem="crm.addScenarioItemToSelected"
        @updateScenarioItem="crm.updateScenarioItem"
        @deleteScenarioItem="crm.deleteScenarioItem"
        @toggleScenarioActive="crm.toggleScenarioActive"
        @updateScenarioTrigger="crm.updateScenarioTrigger"
        @update:stepAiPrompt="crm.stepAiPrompt.value = $event"
        @generateStepContent="crm.generateStepContent"
      />

      <SurveyTab
        v-else-if="crm.activeTab.value === 'survey'"
        :surveyCampaigns="crm.surveyCampaigns.value"
        :selectedCampaignId="crm.selectedCampaignId.value"
        :surveyQuestions="crm.surveyQuestions.value"
        :savedTemplates="crm.savedTemplates.value"
        :flowJson="crm.flowJson.value"
        v-model:newCampaignTitle="crm.newCampaignTitle.value"
        v-model:newQuestionText="crm.newQuestionText.value"
        :isCreatingQuestion="crm.isCreatingQuestion.value"
        @selectCampaign="crm.handleSelectCampaign"
        @saveFlow="crm.handleSaveFlow"
        @createCampaign="crm.handleCreateCampaign"
        @toggleActiveCampaign="crm.handleToggleActiveCampaign"
        @createQuestion="crm.handleCreateQuestion"
        @addChoice="crm.handleAddChoice"
      />

      <AiContentTab
        v-else-if="crm.activeTab.value === 'ai-content'"
        :selectedChannel="crm.selectedChannel.value"
        :aiTargetSegment="crm.aiTargetSegment.value"
        :generatedContent="crm.generatedContent.value"
        :generatedImageUrl="crm.generatedImageUrl.value"
        :templateTitle="crm.templateTitle.value"
        :savedTemplates="crm.savedTemplates.value"
        @update:selectedChannel="crm.selectedChannel.value = $event"
        @update:aiTargetSegment="crm.aiTargetSegment.value = $event"
        @update:generatedContent="crm.generatedContent.value = $event"
        @update:generatedEmailHtml="crm.generatedEmailHtml.value = $event"
        @update:generatedMessagesJson="crm.generatedMessagesJson.value = $event"
        @update:templateTitle="crm.templateTitle.value = $event"
        @generate="crm.simulateAIGeneration"
        @save="crm.saveTemplate"
        @deleteTemplate="crm.deleteTemplate"
      />

      <BroadcastTab
        v-else-if="crm.activeTab.value === 'broadcast'"
        :savedTemplates="crm.savedTemplates.value"
        :selectedTemplateId="crm.selectedTemplateId.value"
        :broadcastTitle="crm.broadcastTitle.value"
        :scheduledAt="crm.scheduledAt.value"
        :broadcastTargetSegment="crm.broadcastTargetSegment.value"
        :broadcastTargetSavedSegmentId="crm.broadcastTargetSavedSegmentId.value"
        :savedSegments="crm.savedSegments.value"
        :customers="crm.customers.value"
        :broadcastTasks="crm.broadcastTasks.value"
        :processingTaskId="crm.processingTaskId.value"
        @update:selectedTemplateId="crm.selectedTemplateId.value = $event"
        @update:broadcastTitle="crm.broadcastTitle.value = $event"
        @update:scheduledAt="crm.scheduledAt.value = $event"
        @update:broadcastTargetSegment="crm.broadcastTargetSegment.value = $event"
        @update:broadcastTargetSavedSegmentId="crm.broadcastTargetSavedSegmentId.value = $event"
        @reserve="crm.handleReserveBroadcast"
        @execute="crm.handleExecuteBroadcast"
      />

      <UserLiffTab
        v-else-if="crm.activeTab.value === 'user-liff'"
        :customers="crm.customers.value"
        :surveyQuestions="crm.surveyQuestions.value"
        :liffSelectedCustomerId="crm.liffSelectedCustomerId.value"
        :liffAnswers="crm.liffAnswers.value"
        :isLiffSubmitting="crm.isLiffSubmitting.value"
        @update:liffSelectedCustomerId="crm.liffSelectedCustomerId.value = $event"
        @update:liffAnswers="crm.liffAnswers.value = $event"
        @submit="crm.handleLiffSubmit"
      />

      <SettingsTab
        v-else-if="crm.activeTab.value === 'settings'"
        :userEmail="crm.userEmail.value"
        :teamMembers="crm.teamMembers.value"
        :currentUserId="crm.currentUserId.value"
        :integrationConfigs="crm.integrationConfigs.value"
        @updateDisplayName="crm.updateMyDisplayName"
        @saveIntegration="crm.saveIntegrationConfig"
        @toggleIntegration="crm.toggleIntegrationConfig"
        @deleteIntegration="crm.deleteIntegrationConfig"
      />
    </div>

    <CustomerModal
      v-if="crm.isModalOpen.value"
      :newCustomer="crm.newCustomer.value"
      :isSaving="crm.isSaving.value"
      @update:newCustomer="crm.newCustomer.value = $event"
      @close="crm.isModalOpen.value = false"
      @save="crm.handleCreateCustomer"
    />
  </div>
</template>
