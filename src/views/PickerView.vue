<script setup lang="ts">
import { useRouter } from 'vue-router'
import ProgramPicker from '../components/ProgramPicker.vue'
import { purgeDoneEntries } from '../done'
import { savePrograms, type Program } from '../programs'

const router = useRouter()

function onConfirm(programs: Program[]): void {
  savePrograms(programs)
  purgeDoneEntries(programs)
  void router.push({ name: 'home' })
}
</script>

<template>
  <ProgramPicker
    heading="Pick your Programs"
    description="Pick which Canvas courses to show as Programs. Selecting none is fine — you can revisit this later."
    @confirm="onConfirm"
  />
</template>
