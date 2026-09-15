<script setup lang="ts">
defineProps<{ programId: string }>()
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center p-4 text-center gap-2">
    <h1 class="m-0 font-heading text-heading text-2xl">Assignments</h1>
    <p class="m-0 text-text-muted">Assignments for program {{ programId }} will appear here.</p>
  </main>
</template>
