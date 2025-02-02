import { defineStore } from 'pinia'
import type { ChatSession, Message } from '@/types/chat'
import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEY = 'ollama-chat-history'

export const useChatStore = defineStore('chat', {
  state: () => ({
    sessions: [] as ChatSession[],
    currentSessionId: '',
    currentModel: ''
  }),

  getters: {
    currentSession: (state) => 
      state.sessions.find(session => session.id === state.currentSessionId),
    
    sortedSessions: (state) => 
      [...state.sessions].sort((a, b) => b.lastUpdateTime - a.lastUpdateTime)
  },

  actions: {
    // 初始化状态
    initializeFromStorage() {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const { sessions, currentSessionId, currentModel } = JSON.parse(stored)
        this.sessions = sessions
        this.currentSessionId = currentSessionId
        this.currentModel = currentModel
      }
    },

    // 保存到本地存储
    saveToStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sessions: this.sessions,
        currentSessionId: this.currentSessionId,
        currentModel: this.currentModel
      }))
    },

    createNewSession() {
      console.log('Store: Creating new session')
      const newSession: ChatSession = {
        id: uuidv4(),
        title: '新对话',
        messages: [],
        modelName: this.currentModel,
        createTime: Date.now(),
        lastUpdateTime: Date.now()
      }
      console.log('New session created:', newSession)
      this.sessions.push(newSession)
      this.currentSessionId = newSession.id
      this.saveToStorage()
    },

    addMessage(sessionId: string, message: Message) {
      const session = this.sessions.find(s => s.id === sessionId)
      if (session) {
        session.messages.push(message)
        session.lastUpdateTime = Date.now()
        // 更新会话标题（使用用户的第一条消息）
        if (session.title === '新对话' && message.role === 'user') {
          session.title = message.content.slice(0, 20) + (message.content.length > 20 ? '...' : '')
        }
        this.saveToStorage()
      }
    },

    deleteSession(sessionId: string) {
      const index = this.sessions.findIndex(s => s.id === sessionId)
      if (index !== -1) {
        this.sessions.splice(index, 1)
        if (this.currentSessionId === sessionId) {
          this.currentSessionId = this.sessions[0]?.id || ''
        }
        this.saveToStorage()
      }
    },

    // 导出对话
    exportSession(sessionId: string) {
      const session = this.sessions.find(s => s.id === sessionId)
      if (!session) return null

      const exportData = {
        title: session.title,
        model: session.modelName,
        messages: session.messages,
        exportTime: new Date().toISOString()
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${session.title}-${new Date().toISOString()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },

    // 更新会话的模型
    updateSessionModel(sessionId: string, modelName: string) {
      const session = this.sessions.find(s => s.id === sessionId)
      if (session) {
        session.modelName = modelName
        this.saveToStorage()
      }
    },

    // 添加新的方法用于更新消息内容
    updateMessageContent(sessionId: string, messageIndex: number, content: string) {
      const session = this.sessions.find(s => s.id === sessionId)
      if (session && session.messages[messageIndex]) {
        session.messages[messageIndex].content = content
        // 强制触发响应式更新
        this.sessions = [...this.sessions]
      }
    },

    // 导入对话
    importSession(data: { title: string; messages: Message[]; model?: string }) {
      const newSession: ChatSession = {
        id: uuidv4(),
        title: data.title,
        messages: data.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp || Date.now()
        })),
        modelName: data.model || this.currentModel,
        createTime: Date.now(),
        lastUpdateTime: Date.now()
      }

      this.sessions.push(newSession)
      this.currentSessionId = newSession.id
      this.saveToStorage()
    }
  }
}) 