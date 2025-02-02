import axios from 'axios'
import type { OllamaResponse, StreamResponse, ErrorResponse } from '@/types/chat'

const BASE_URL = '/api'

export const chatAPI = {
  // 发送消息到Ollama
  sendMessage: async (model: string, prompt: string) => {
    try {
      const response = await axios.post(`${BASE_URL}/chat`, {
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
      return response.data as OllamaResponse
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  },

  // 获取可用模型列表
  getModels: async () => {
    try {
      const response = await axios.get('/api/tags')
      return response.data
    } catch (error) {
      console.error('Error getting models:', error)
      // 如果获取失败，返回默认值
      return { models: [{ name: 'llama2' }] }
    }
  },

  // 流式发送消息
  sendMessageStream: async (
    model: string, 
    messages: { role: string; content: string }[],
    onProgress: (content: string) => void,
    onError: (error: string) => void,
    onFinish: () => void,
    abortController?: AbortController
  ) => {
    try {
      console.log('API: Sending message', {
        model,
        messages,
        url: '/api/chat'
      })

      console.log('Sending request with model:', model)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: true
        }),
        signal: abortController?.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No reader available')
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          onFinish()
          break
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line) as StreamResponse | ErrorResponse
            
            if ('error' in data) {
              onError(data.error)
              return
            }

            if ('message' in data) {
              onProgress(data.message.content)
            }
          } catch (e) {
            console.error('Error parsing JSON:', e)
          }
        }
      }
    } catch (error) {
      console.error('API Error:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        onError('生成已停止')
      } else {
        console.error('Error in stream:', error)
        onError(error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }
} 