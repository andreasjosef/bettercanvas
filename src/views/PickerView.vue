<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchCourses, type Course } from '../api/canvas'
import { loadToken } from '../token'
import { savePrograms } from '../programs'

const router = useRouter()
const loading = ref(true)
const error = ref<string | null>(null)
const courses = ref<Course[]>([])
const selectedCourseIds = ref<ReadonlySet<number>>(new Set())

onMounted(async () => {
  const token = loadToken()
  if (!token) {
    await router.replace({ name: 'connect' })
    return
  }
  try {
    courses.value = await fetchCourses(token)
  } catch {
    error.value =
      'Could not load your Courses from Canvas. Check your connection and reload the page.'
  } finally {
    loading.value = false
  }
})

function toggle(courseId: number, checked: boolean): void {
  const next = new Set(selectedCourseIds.value)
  if (checked) {
    next.add(courseId)
  } else {
    next.delete(courseId)
  }
  selectedCourseIds.value = next
}

function confirm(): void {
  savePrograms(
    courses.value
      .filter((course) => selectedCourseIds.value.has(course.id))
      .map((course) => ({ courseId: course.id, name: course.name, archived: false })),
  )
  void router.push({ name: 'home' })
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center p-4 text-center gap-2">
    <h1 class="m-0 font-heading text-heading text-2xl">Pick your Programs</h1>
    <p class="m-0 text-text-muted">
      Pick which Canvas courses to show as Programs. Selecting none is fine — you can revisit
      this later.
    </p>
    <p v-if="error" role="alert" class="m-0 text-sm text-danger">
      {{ error }}
    </p>
    <p v-else-if="loading" class="m-0 text-text-muted">Loading…</p>
    <form v-else class="flex flex-col items-center gap-2 max-w-sm w-full" @submit.prevent="confirm">
      <p v-if="courses.length === 0" class="m-0 text-text-muted">
        No Courses found on your Canvas account.
      </p>
      <ul v-else class="m-0 w-full list-none p-0 flex flex-col gap-1">
        <li v-for="course in courses" :key="course.id">
          <label class="flex items-center gap-2 text-left p-1 cursor-pointer">
            <input
              type="checkbox"
              :checked="selectedCourseIds.has(course.id)"
              @change="toggle(course.id, ($event.target as HTMLInputElement).checked)"
              class="accent-accent"
            />
            <span>{{ course.name }}</span>
          </label>
        </li>
      </ul>
      <button
        type="submit"
        class="rounded-md bg-accent px-4 py-2 font-heading text-accent-text hover:opacity-90"
      >
        Confirm
      </button>
    </form>
  </main>
</template>
