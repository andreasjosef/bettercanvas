import { createRouter, createWebHistory } from 'vue-router'
import ConnectView from '../views/ConnectView.vue'
import PickerView from '../views/PickerView.vue'
import HomeView from '../views/HomeView.vue'
import ProgramModulesView from '../views/ProgramModulesView.vue'
import ProgramAssignmentsView from '../views/ProgramAssignmentsView.vue'
import ReadingView from '../views/ReadingView.vue'

export const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/connect', name: 'connect', component: ConnectView },
  { path: '/picker', name: 'picker', component: PickerView },
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

export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
  return createRouter({ history, routes })
}
