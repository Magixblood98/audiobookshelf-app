<template>
  <div class="lib-seg" :class="{ wide }" role="group">
    <button v-for="o in options" :key="o[0]" type="button" :class="{ on: o[0] === value }" :aria-pressed="String(o[0] === value)" @click="o[0] !== value && $emit('input', o[0])">
      {{ o[1] }}<span v-if="o[2] !== undefined" class="ml-1.5 opacity-60">{{ o[2] }}</span>
    </button>
  </div>
</template>

<script>
export default {
  props: {
    options: { type: Array, required: true },
    value: [String, Number],
    wide: Boolean
  }
}
</script>
