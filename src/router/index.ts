import { createRouter, createWebHistory } from 'vue-router'
import { setAuthFailureHandler } from '../api/canvas'
import ConnectView from '../views/ConnectView.vue'
import PickerView from '../views/PickerView.vue'
import HomeView from '../views/HomeView.vue'
import ProgramModulesView from '../views/ProgramModulesView.vue'
import ProgramAssignmentsView from '../views/ProgramAssignmentsView.vue'
import ReadingView from '../views/ReadingView.vue'
import SettingsView from '../views/SettingsView.vue'
import PreviousLecturesView from '../views/PreviousLecturesView.vue'

export const routes = [
  { path: '/', name: 'home', component: HomeView },
  {
    path: '/connect',
    name: 'connect',
    component: ConnectView,
    meta: { bare: true },
  },
  {
    path: '/picker',
    name: 'picker',
    component: PickerView,
    meta: { bare: true },
  },
  { path: '/settings', name: 'settings', component: SettingsView },
  {
    path: '/previous-lectures',
    name: 'previous-lectures',
    component: PreviousLecturesView,
  },
  {
    path: '/programs/:programId/modules',
    name: 'program-modules',
    component: ProgramModulesView,
    props: true,
  },
  {
    path: '/programs/:programId/assignments',
    name: 'program-assignments',
    component: ProgramAssignmentsView,
    props: true,
  },
  {
    path: '/programs/:programId/read/:itemId',
    name: 'reading',
    component: ReadingView,
    props: true,
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
]

export const RECONNECT_REASON = 'token-invalid'

export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
  const router = createRouter({ history, routes })
  setAuthFailureHandler(() => {
    if (router.currentRoute.value.name === 'connect') return
    void router.replace({
      name: 'connect',
      query: { reason: RECONNECT_REASON },
    })
  })
  return router
}
