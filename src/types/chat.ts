// 消息类型
export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// 聊天会话类型
export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  modelName: string
  createTime: number
  lastUpdateTime: number
}

// Ollama API响应类型
export interface OllamaResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
}

// 添加流式响应类型
export interface StreamResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
}

// 添加错误响应类型
export interface ErrorResponse {
  error: string
} 