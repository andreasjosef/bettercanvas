<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'

const route = useRoute()
// Routes opting out of the shell (Connect, Picker) set `meta.bare`.
const showShell = computed(() => route.meta.bare !== true)
</script>

<template>
  <AppShell v-if="showShell">
    <RouterView />
  </AppShell>
  <RouterView v-else />
</template>
