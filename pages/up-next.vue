<template>
  <div class="w-full h-full overflow-y-auto px-4 py-5">
    <div class="flex items-center">
      <h1 class="text-xl font-semibold flex-grow">Up next</h1>
      <button v-if="queue.length" type="button" class="text-sm text-fg-muted px-2 py-1" @click="clear">Clear</button>
    </div>
    <p class="text-sm text-fg-muted mt-1">Plays in this order when the current book ends. Add books from a book’s ⋮ menu.</p>

    <div v-if="!queue.length" class="py-12 text-center">
      <span class="material-symbols text-5xl text-fg-muted">queue_music</span>
      <p class="mt-3">Nothing queued.</p>
      <p v-if="settings.continueSeries" class="text-sm text-fg-muted mt-1">When a book ends, the next book in its series plays.</p>
    </div>

    <div v-else class="mt-4">
      <div v-for="(e, i) in queue" :key="e.id" class="flex items-center gap-3 py-2 border-b border-border">
        <span class="w-5 text-center text-sm text-fg-muted">{{ i + 1 }}</span>
        <div class="w-12 h-12 flex-none rounded overflow-hidden bg-bg-hover" @click="open(e)">
          <img v-if="coverOf(e)" :src="coverOf(e)" class="w-full h-full object-cover" loading="lazy" />
        </div>
        <div class="flex-grow min-w-0" @click="open(e)">
          <p class="text-sm truncate">{{ e.title }}</p>
          <p class="text-xs text-fg-muted truncate">{{ e.author }}</p>
        </div>
        <button type="button" class="material-symbols text-2xl px-1" :aria-label="'Play ' + e.title" @click="playNow(e)">play_arrow</button>
        <div class="flex flex-col">
          <button type="button" class="material-symbols text-lg leading-none" :class="i ? '' : 'opacity-20'" :disabled="!i" aria-label="Move up" @click="$listening.moveInQueue(e.id, -1)">expand_less</button>
          <button type="button" class="material-symbols text-lg leading-none" :class="i < queue.length - 1 ? '' : 'opacity-20'" :disabled="i === queue.length - 1" aria-label="Move down" @click="$listening.moveInQueue(e.id, 1)">expand_more</button>
        </div>
        <button type="button" class="material-symbols text-xl text-fg-muted px-1" aria-label="Remove" @click="$listening.removeFromQueue(e.id)">close</button>
      </div>
    </div>

    <h2 class="text-sm uppercase font-semibold text-fg-muted mt-8 mb-1">When a book ends</h2>
    <div class="flex items-center py-3" @click="toggle('continueSeries')">
      <div class="w-10 flex justify-center pointer-events-none"><ui-toggle-switch :value="settings.continueSeries" /></div>
      <p class="pl-4">Play the next book in the series if nothing is queued</p>
    </div>
    <div class="flex items-center py-3" @click="toggle('deleteFinished')">
      <div class="w-10 flex justify-center pointer-events-none"><ui-toggle-switch :value="settings.deleteFinished" /></div>
      <p class="pl-4">Remove its download from this phone</p>
    </div>
  </div>
</template>

<script>
export default {
  computed: {
    queue() {
      return this.$store.state.listening.queue
    },
    settings() {
      return this.$store.state.listening.settings
    }
  },
  methods: {
    coverOf(e) {
      if (!e.id || e.id.startsWith('local')) return null
      return this.$store.getters['globals/getLibraryItemCoverSrcById'](e.id)
    },
    open(e) {
      this.$router.push(`/item/${e.localId || e.id}`)
    },
    async playNow(e) {
      await this.$listening.removeFromQueue(e.id)
      await this.$listening.playEntry(e)
    },
    async clear() {
      await this.$listening.clearQueue()
    },
    toggle(key) {
      this.$listening.updateSettings({ [key]: !this.settings[key] })
    }
  }
}
</script>
