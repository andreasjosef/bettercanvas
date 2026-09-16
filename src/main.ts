import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import './style.css'
import App from './App.vue'
import { createAppRouter } from './router'
import { createAppQueryClient } from './api/queryClient'

createApp(App)
  .use(createAppRouter())
  .use(VueQueryPlugin, { queryClient: createAppQueryClient() })
  .mount('#app')
