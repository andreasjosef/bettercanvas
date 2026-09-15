<!--
  PROTOTYPE wiring for issue #5 (connect-to-reading flow + token set). The
  real app has no pages yet, so this mounts the prototype directly.
  Once a variant is picked, replace this with the real routed app and
  delete src/prototypes/reading-flow.
-->
<script setup lang="ts">
import PrototypeReadingFlow from './prototypes/reading-flow/PrototypeReadingFlow.vue'
</script>

<template>
  <PrototypeReadingFlow />
</template>
