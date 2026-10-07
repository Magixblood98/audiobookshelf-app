<template>
  <librarian-page title="Settings" tab="settings" @retry="load">
    <p v-if="!cfg" class="py-8 text-center text-fg-muted">Loading…</p>
    <div v-else class="border-t border-border mt-3">
      <nuxt-link v-for="s in sections" :key="s.id" :to="'/librarian/settings/' + s.id" class="flex items-center gap-3 px-4 py-3.5 border-b border-border">
        <div class="flex-grow min-w-0">
          <p class="lib-serif">{{ s.title }}</p>
          <p class="text-sm text-fg-muted truncate">{{ s.sum(cfg, appConfig) }}</p>
        </div>
        <span class="material-symbols text-fg-muted">chevron_right</span>
      </nuxt-link>
    </div>
  </librarian-page>
</template>

<script>
import { SECTIONS } from '@/utils/librarianSettings'

export default {
  data() {
    return { cfg: null, sections: SECTIONS }
  },
  computed: {
    appConfig() {
      return this.$store.state.librarian.config
    }
  },
  methods: {
    async load() {
      try {
        this.cfg = await this.$librarian.get('/api/config')
      } catch (error) {
        if (!error.offline && !error.login) this.$toast.error(error.message)
      }
    }
  },
  mounted() {
    this.load()
  }
}
</script>
