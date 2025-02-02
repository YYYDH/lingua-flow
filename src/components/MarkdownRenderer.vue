<template>
  <div class="markdown-body" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import 'github-markdown-css'

const props = defineProps<{
  content: string
}>()

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return '' // 使用默认的转义
  }
})

// 使用 ref 而不是 computed
const renderedContent = ref('')

// 使用 watch 来更新渲染内容
watch(() => props.content, (newContent) => {
  // 使用 nextTick 确保 DOM 更新
  renderedContent.value = md.render(newContent)
}, { immediate: true })
</script>

<style>
.markdown-body {
  background-color: transparent !important;
}

.markdown-body pre {
  background-color: #f6f8fa !important;
  border-radius: 6px;
  padding: 16px;
  overflow: auto;
}

.markdown-body code {
  background-color: rgba(175, 184, 193, 0.2);
  border-radius: 6px;
  padding: 0.2em 0.4em;
  font-size: 85%;
}

.markdown-body pre code {
  background-color: transparent;
  padding: 0;
}
</style> 