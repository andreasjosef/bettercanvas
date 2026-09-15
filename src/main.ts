import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createAppRouter } from './router'

createApp(App).use(createAppRouter()).mount('#app')
