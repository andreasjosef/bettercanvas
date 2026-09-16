<script setup lang="ts">
import { RouterView } from 'vue-router'
import ProgramSidebar from './ProgramSidebar.vue'

defineProps<{ programId: string }>()
</script>

<template>
  <div class="flex w-full">
    <ProgramSidebar :program-id="programId" />
    <div class="flex-1 min-w-0">
      <RouterView />
    </div>
  </div>
</template>
