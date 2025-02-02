<template>
  <div class="chat-container">
    <!-- 侧边栏 -->
    <div class="sidebar">
      <div class="top-actions">
        <el-button type="primary" @click="createNewChat" class="new-chat-btn" :icon="Plus">
          新建对话
        </el-button>
        <el-button type="default" @click="importChat" class="import-btn" :icon="Upload">
          导入对话
        </el-button>
        <!-- 隐藏的文件输入框 -->
        <input
          type="file"
          ref="fileInput"
          style="display: none"
          accept=".json"
          @change="handleFileUpload"
        >
      </div>
      
      <div class="session-list">
        <div
          v-for="session in chatStore.sortedSessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === chatStore.currentSessionId }"
          @click="selectSession(session.id)"
        >
          <div class="session-title-wrapper">
            <el-icon><ChatRound /></el-icon>
            <span class="session-title">{{ session.title }}</span>
          </div>
          <div class="session-actions">
            <el-button
              type="text"
              @click.stop="exportSession(session.id)"
              class="action-btn"
            >
              <el-icon><Download /></el-icon>
            </el-button>
            <el-button
              type="text"
              @click.stop="deleteSession(session.id)"
              class="action-btn"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="main-content">
      <!-- 模型选择 -->
      <div class="model-selector">
        <el-select 
          v-model="chatStore.currentModel" 
          placeholder="选择模型"
          @change="handleModelChange"
          :disabled="availableModels.length === 0"
        >
          <el-option
            v-for="model in availableModels"
            :key="model.name"
            :label="model.name"
            :value="model.name"
          />
        </el-select>
        <div v-if="availableModels.length === 0" class="model-warning">
          请先使用终端运行 ollama pull llama2 下载模型
        </div>
      </div>

      <!-- 消息列表 -->
      <div class="message-list" ref="messageListRef">
        <template v-if="currentSession">
          <div
            v-for="(message, index) in currentSession.messages"
            :key="index"
            class="message"
            :class="message.role"
          >
            <div class="message-avatar">
              <el-icon v-if="message.role === 'user'"><User /></el-icon>
              <el-icon v-else><Service /></el-icon>
            </div>
            <div class="message-content">
              <MarkdownRenderer v-if="message.role === 'assistant'" :content="message.content" />
              <span v-else>{{ message.content }}</span>
            </div>
          </div>
        </template>
        <div v-else class="empty-state">
          开始一个新对话吧！
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <el-input
          v-model="inputMessage"
          type="textarea"
          :rows="3"
          placeholder="输入消息... (Ctrl + Enter 发送)"
          @keydown.ctrl.enter.prevent="handleKeydown"
          :disabled="isLoading"
        />
        <div class="button-group">
          <el-button 
            type="primary" 
            @click="sendMessage(false)" 
            :loading="isLoading"
            :disabled="!inputMessage.trim() || !currentSession"
          >
            发送
          </el-button>
          <el-button 
            v-if="isLoading"
            type="danger" 
            @click="stopGeneration"
          >
            停止
          </el-button>
          <el-button 
            v-if="currentSession?.messages.length"
            type="default" 
            @click="regenerateResponse"
            :disabled="isLoading"
          >
            重新生成
          </el-button>
        </div>
        <div class="debug-info" style="font-size: 12px; color: #666;">
          <div>Input empty: {{ !inputMessage.trim() }}</div>
          <div>No session: {{ !currentSession }}</div>
          <div>Is loading: {{ isLoading }}</div>
          <div>Current model: {{ chatStore.currentModel }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, ChatRound, Plus, User, Service, Download, Upload } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat'
import { chatAPI } from '@/api/chat'
import type { Message } from '@/types/chat'
import MarkdownRenderer from './MarkdownRenderer.vue'

const chatStore = useChatStore()
const inputMessage = ref('')
const isLoading = ref(false)
const messageListRef = ref<HTMLElement | null>(null)
const availableModels = ref<string[]>([])
const abortController = ref<AbortController | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const currentSession = computed(() => chatStore.currentSession)

// 获取可用模型列表
const fetchModels = async () => {
  try {
    const response = await chatAPI.getModels()
    if (response.models && response.models.length > 0) {
      availableModels.value = response.models
      // 设置当前模型为可用模型中的第一个的名称
      chatStore.currentModel = response.models[0].name
    } else {
      ElMessage.warning('没有可用的模型，请先使用 ollama pull 下载模型')
      availableModels.value = []
    }
  } catch (error) {
    console.error('Error fetching models:', error)
    ElMessage.warning('获取模型列表失败，请确保 Ollama 服务正在运行')
    availableModels.value = []
  }
}

// 滚动到最新消息
const scrollToBottom = async () => {
  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

// 监听消息变化，自动滚动
watch(() => currentSession.value?.messages.length, () => {
  scrollToBottom()
})

const createNewChat = () => {
  console.log('Creating new chat')
  chatStore.createNewSession()
}

const selectSession = (sessionId: string) => {
  chatStore.currentSessionId = sessionId
}

const deleteSession = (sessionId: string) => {
  ElMessageBox.confirm('确定要删除这个对话吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    chatStore.deleteSession(sessionId)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

const exportSession = (sessionId: string) => {
  chatStore.exportSession(sessionId)
}

// 添加键盘事件处理函数
const handleKeydown = (e: KeyboardEvent) => {
  // 防止默认行为（换行）
  e.preventDefault()
  // 确保不是在按住 Ctrl 的情况下粘贴
  if (e.ctrlKey && e.key === 'Enter' && !e.altKey && !e.shiftKey && !e.metaKey) {
    sendMessage(false)
  }
}

// 修改发送消息函数，添加更多日志
const sendMessage = async (reuseLastMessage = false) => {
  console.log('Send message triggered', {
    method: reuseLastMessage ? 'regenerate' : 'new message',
    inputContent: inputMessage.value,
    currentSession: currentSession.value?.id
  })
  
  if ((!inputMessage.value.trim() && !reuseLastMessage) || !currentSession.value || isLoading.value) {
    console.log('Early return condition met', {
      inputEmpty: !inputMessage.value.trim(),
      reuseLastMessage,
      noCurrentSession: !currentSession.value,
      isLoading: isLoading.value
    })
    return
  }

  if (!chatStore.currentModel) {
    ElMessage.warning('请先选择一个模型')
    return
  }

  let messageToSend: string
  if (reuseLastMessage) {
    const lastUserMessage = currentSession.value.messages
      .filter(m => m.role === 'user')
      .pop()
    if (!lastUserMessage) return
    messageToSend = lastUserMessage.content
  } else {
    messageToSend = inputMessage.value
  }

  const userMessage: Message = {
    role: 'user',
    content: messageToSend,
    timestamp: Date.now()
  }

  const assistantMessage: Message = {
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  }

  if (!reuseLastMessage) {
    chatStore.addMessage(currentSession.value.id, userMessage)
  }
  chatStore.addMessage(currentSession.value.id, assistantMessage)
  
  if (!reuseLastMessage) {
    inputMessage.value = ''
  }
  isLoading.value = true

  // 创建新的 AbortController
  abortController.value = new AbortController()

  try {
    let accumulatedContent = ''
    const messageHistory = currentSession.value.messages
      .slice(-10)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }))

    console.log('Sending message with history:', messageHistory)

    await chatAPI.sendMessageStream(
      chatStore.currentModel,
      messageHistory,
      (content) => {
        console.log('Received content:', content)
        nextTick(() => {
          accumulatedContent += content
          assistantMessage.content = accumulatedContent
          chatStore.sessions = [...chatStore.sessions]
        })
      },
      (error) => {
        console.error('Stream error:', error)
        ElMessage.error(error || '发送消息失败，请重试')
        const index = currentSession.value!.messages.findIndex(m => m === assistantMessage)
        if (index !== -1) {
          currentSession.value!.messages.splice(index, 1)
          chatStore.saveToStorage()
        }
      },
      () => {
        console.log('Stream finished')
        isLoading.value = false
        chatStore.saveToStorage()
        abortController.value = null
      },
      abortController.value
    )
  } catch (error) {
    console.error('Error in sendMessage:', error)
    ElMessage.error('发送消息失败，请重试')
    isLoading.value = false
    abortController.value = null
  }
}

// 停止生成
const stopGeneration = () => {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
    isLoading.value = false
  }
}

// 重新生成回复
const regenerateResponse = async () => {
  if (!currentSession.value?.messages.length) return
  
  // 移除最后一条助手消息
  if (currentSession.value.messages[currentSession.value.messages.length - 1].role === 'assistant') {
    currentSession.value.messages.pop()
  }
  
  // 重新发送最后一条用户消息
  await sendMessage(true)
}

// 修改模型选择处理函数
const handleModelChange = (modelName: string) => {
  console.log('Model changed to:', modelName)
  chatStore.currentModel = modelName
  // 同时更新当前会话的模型名称
  if (currentSession.value) {
    chatStore.updateSessionModel(currentSession.value.id, modelName)
  }
  chatStore.saveToStorage()
}

// 点击导入按钮
const importChat = () => {
  fileInput.value?.click()
}

// 处理文件上传
const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) return
  
  try {
    const content = await file.text()
    const data = JSON.parse(content)
    
    // 验证导入的数据格式
    if (!data.title || !data.messages || !Array.isArray(data.messages)) {
      throw new Error('无效的对话文件格式')
    }
    
    // 导入对话
    chatStore.importSession(data)
    ElMessage.success('导入成功')
  } catch (error) {
    console.error('Error importing chat:', error)
    ElMessage.error('导入失败：' + (error instanceof Error ? error.message : '未知错误'))
  } finally {
    // 清除文件选择，这样同一个文件可以再次选择
    input.value = ''
  }
}

onMounted(() => {
  console.log('Component mounted')
  fetchModels()
  chatStore.initializeFromStorage() // 确保从存储中加载数据
  if (!currentSession.value) {
    console.log('No current session, creating new one')
    createNewChat()
  }
})
</script>

<style scoped>
.chat-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: #f5f7fa;
  position: fixed;
  left: 0;
  top: 0;
}

.sidebar {
  width: 260px;
  background-color: #fff;
  border-right: 1px solid #dcdfe6;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.top-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.new-chat-btn,
.import-btn {
  flex: 1;
}

.new-chat-btn {
  margin-bottom: 0;
}

.session-list {
  flex: 1;
  overflow-y: auto;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.session-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}

.session-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item:hover {
  background-color: #f5f7fa;
}

.session-item.active {
  background-color: #ecf5ff;
}

.session-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.session-item:hover .session-actions {
  opacity: 1;
}

.action-btn {
  padding: 4px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
}

.model-selector {
  padding: 20px;
  border-bottom: 1px solid #dcdfe6;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  max-width: 80%;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f4f4f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message.user {
  margin-left: auto;
  flex-direction: row-reverse;
}

.message.assistant {
  margin-right: auto;
}

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  background-color: #f4f4f5;
  word-break: break-word;
}

.message.user .message-content {
  background-color: #ecf5ff;
}

.empty-state {
  text-align: center;
  color: #909399;
  padding: 40px;
}

.input-area {
  padding: 20px;
  border-top: 1px solid #dcdfe6;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.button-group .el-button {
  flex: 1;
}

:deep(.el-textarea__inner) {
  resize: none;
}

.model-warning {
  margin-top: 8px;
  color: #e6a23c;
  font-size: 12px;
}

.el-select {
  width: 100%;
}
</style> 