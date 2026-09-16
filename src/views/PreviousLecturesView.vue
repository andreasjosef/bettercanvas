<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { loadPrograms } from '../programs'
import { loadToken } from '../token'

const router = useRouter()
const archivedPrograms = ref(
  loadPrograms().filter((program) => program.archived),
)
const hasArchivedPrograms = computed(() => archivedPrograms.value.length > 0)

onMounted(async () => {
  if (!loadToken()) {
    await router.replace({ name: 'connect' })
  }
})
</script>

<template>
  <main class="flex min-h-screen flex-col items-center p-4 gap-4">
    <h1 class="m-0 font-heading text-heading text-2xl">Previous Lectures</h1>
    <RouterLink
      :to="{ name: 'home' }"
      class="no-underline text-sm text-accent hover:opacity-90"
    >
      Home
    </RouterLink>
    <p v-if="!hasArchivedPrograms" class="m-0 text-text-muted">
      No Archived Programs.
    </p>
    <ul v-else class="m-0 w-full max-w-2xl list-none p-0 flex flex-col">
      <li v-for="program in archivedPrograms" :key="program.courseId">
        <RouterLink
          :to="{ name: 'program', params: { programId: String(program.courseId) } }"
          class="block py-2 border-b border-border no-underline text-inherit text-left font-heading text-heading text-lg"
        >
          {{ program.name }}
        </RouterLink>
      </li>
    </ul>
  </main>
</template>