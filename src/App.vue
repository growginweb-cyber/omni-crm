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

      <AnalyticsTab
        v-else-if="crm.activeTab.value === 'analytics'"
        :broadcastTasks="crm.broadcastTasks.value"
        :customers="crm.customers.value"
        :currentTenantId="crm.currentTenantId.value"
      />

      <CustomersTab
        v-else-if="crm.activeTab.value === 'customers'"
        :customers="crm.customers.value"
        :selectedSegment="crm.selectedSegment.value"
        :selectedCustomer="crm.selectedCustomer.value"
        :stepQueues="crm.stepQueues.value"
        @update:selectedSegment="crm.selectedSegment.value = $event"
        @update:selectedCustomer="crm.selectedCustomer.value = $event"
        @openModal="crm.isModalOpen.value = true"
        @fetchCustomers="crm.fetchCustomers"
        @updateSegment="crm.updateCustomerSegment"
      />

      <ScenariosTab
        v-else-if="crm.activeTab.value === 'scenarios'"
        :stepScenarios="crm.stepScenarios.value"
        :savedTemplates="crm.savedTemplates.value"
        @addStep="crm.addScenarioStep"
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
        :broadcastTasks="crm.broadcastTasks.value"
        :processingTaskId="crm.processingTaskId.value"
        @update:selectedTemplateId="crm.selectedTemplateId.value = $event"
        @update:broadcastTitle="crm.broadcastTitle.value = $event"
        @update:scheduledAt="crm.scheduledAt.value = $event"
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
