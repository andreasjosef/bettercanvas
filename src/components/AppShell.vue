<script setup lang="ts">
import { RouterLink } from 'vue-router'

const navLinkClass =
  'no-underline text-sm text-text-muted p-2 rounded-sm hover:opacity-90'
</script>

<template>
  <div class="flex min-h-screen">
    <aside
      class="w-drawer flex-none bg-surface-alt border-r border-border py-5 px-3 flex flex-col gap-1"
    >
      <RouterLink
        :to="{ name: 'home' }"
        class="no-underline font-heading font-semibold text-heading px-2 pb-4"
      >
        Better Canvas
      </RouterLink>
      <div class="flex-1" />
      <nav class="flex flex-col gap-1">
        <RouterLink
          :to="{ name: 'previous-lectures' }"
          :class="navLinkClass"
        >
          Previous Lectures
        </RouterLink>
        <RouterLink :to="{ name: 'settings' }" :class="navLinkClass">
          Settings
        </RouterLink>
      </nav>
    </aside>
    <div class="flex-1 min-w-0">
      <slot />
    </div>
  </div>
</template>
