import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import './style.css'
import App from './App.vue'
import { createAppRouter } from './router'
import { createAppQueryClient } from './api/queryClient'
import { wireLoadingSignals } from './stores/loading'

const queryClient = createAppQueryClient()
const router = createAppRouter()
const pinia = createPinia()
const app = createApp(App)
  .use(pinia)
  .use(router)
  .use(VueQueryPlugin, { queryClient })

wireLoadingSignals(pinia, router, queryClient)

app.mount('#app')
