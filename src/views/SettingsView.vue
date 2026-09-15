<script setup lang="ts">
import { useRouter } from 'vue-router'
import ProgramPicker from '../components/ProgramPicker.vue'
import { loadPrograms, savePrograms, type Program } from '../programs'

const router = useRouter()

function onConfirm(programs: Program[]): void {
  savePrograms(programs)
  void router.push({ name: 'home' })
}
</script>

<template>
  <ProgramPicker
    heading="Manage Programs"
    description="Revisit which Canvas courses show as Programs, and archive the ones you're done with."
    :initial-programs="loadPrograms()"
    @confirm="onConfirm"
  />
</template>
