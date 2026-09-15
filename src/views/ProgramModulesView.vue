<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  fetchModules,
  type CourseModule,
  type ModuleItem,
} from '../api/canvas'
import { loadToken } from '../token'
import ProgramTabs from '../components/ProgramTabs.vue'

const props = defineProps<{ programId: string }>()

const router = useRouter()
const loading = ref(true)
const failed = ref(false)
const modules = ref<CourseModule[]>([])

function canvasItemHref(item: ModuleItem): string {
  return item.html_url ?? item.external_url ?? ''
}

onMounted(async () => {
  const token = loadToken()
  if (!token) {
    await router.replace({ name: 'connect' })
    return
  }
  try {
    modules.value = await fetchModules(token, Number(props.programId))
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="flex min-h-screen flex-col items-center p-4 gap-4">
    <ProgramTabs :program-id="programId" active="modules" />
    <p v-if="loading" class="m-0 text-text-muted">Loading…</p>
    <p v-else-if="failed" class="m-0 text-danger">
      Could not load modules.
    </p>
    <div v-else class="w-full max-w-2xl flex flex-col gap-6">
      <section
        v-for="module_ in modules"
        :key="module_.id"
        class="flex flex-col gap-2"
      >
        <h2 class="m-0 font-heading text-heading text-lg">
          {{ module_.name }}
        </h2>
        <ol class="m-0 list-none p-0 flex flex-col">
          <li
            v-for="mod in module_.items ?? []"
            :key="mod.id"
          >
            <template v-if="mod.type === 'SubHeader'">
              <span
                data-testid="subheader-divider"
                class="block border-b border-border pb-1 mt-4 font-heading text-heading text-sm uppercase tracking-wide"
              >
                {{ mod.title }}
              </span>
            </template>
            <template v-else-if="mod.type === 'Page' || mod.type === 'Assignment'">
              <RouterLink
                :to="{
                  name: 'reading',
                  params: { programId, itemId: String(mod.id) },
                }"
                class="block py-2 border-b border-border text-accent hover:opacity-90"
              >
                {{ mod.title }}
              </RouterLink>
            </template>
            <template v-else-if="canvasItemHref(mod)">
              <a
                :href="canvasItemHref(mod)"
                target="_blank"
                rel="noopener noreferrer"
                class="block py-2 border-b border-border text-text-muted hover:opacity-90"
              >
                {{ mod.title }} ↗
              </a>
            </template>
            <template v-else>
              <span class="block py-2 border-b border-border text-text-muted">
                {{ mod.title }}
              </span>
            </template>
          </li>
        </ol>
      </section>
    </div>
  </main>
</template>
