<script setup lang="ts"></script>

<template>
  <main class="placeholder">
    <h1>Better Canvas</h1>
    <p>Connect-to-reading flow and token set decided (issue #5). Screens not yet implemented.</p>
  </main>
</template>

<style scoped>
.placeholder {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-2);
  padding: var(--space-4);
}
h1 {
  font-family: var(--font-heading);
  color: var(--color-heading);
  font-size: var(--text-2xl);
  margin: 0;
}
p {
  color: var(--color-text-muted);
  margin: 0;
}
</style>
