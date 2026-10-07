<template>
  <div class="w-full h-full flex flex-col">
    <div class="flex-none bg-bg border-b border-border">
      <div class="flex items-center px-4 pt-3 pb-2 min-h-12">
        <h1 class="lib-serif text-xl font-semibold truncate flex-grow">{{ title }}</h1>
        <slot name="actions" />
      </div>
      <nav class="flex px-1" aria-label="Librarian sections">
        <nuxt-link v-for="t in tabs" :key="t.id" :to="t.to" class="relative flex-1 flex flex-col items-center pt-1 pb-2 text-xs" :class="t.id === tab ? 'text-fg font-semibold' : 'text-fg-muted'">
          <span class="material-symbols text-xl" :class="t.id === tab ? 'fill lib-text-want' : ''">{{ t.icon }}</span>
          {{ t.label }}
          <span v-if="t.id === 'activity' && activeCount" class="absolute top-0 left-1/2 ml-2 min-w-4 h-4 px-1 rounded-full text-xxs leading-4 text-center font-semibold" style="background: var(--lib-get); color: var(--lib-get-ink)">{{ activeCount }}</span>
          <span v-if="t.id === tab" class="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded" style="background: var(--lib-want)" />
        </nuxt-link>
      </nav>
    </div>

    <div ref="scroller" class="flex-grow overflow-y-auto overflow-x-hidden pb-8">
      <!-- Can't reach Pocket Librarian -->
      <div v-if="gate && online === false" class="px-6 py-12 text-center">
        <span class="material-symbols text-6xl lib-text-want">shelves</span>
        <h2 class="lib-serif text-2xl font-semibold mt-3">Pocket Librarian isn’t running</h2>
        <template v-if="$librarian.isLocal">
          <p class="text-fg-muted mt-2">It runs in Termux on this phone and does the searching and downloading in the background.</p>
          <button type="button" class="lib-btn primary mt-6 w-56" :disabled="starting" @click="start">
            <span class="material-symbols">play_arrow</span>{{ starting ? 'Starting…' : 'Start it' }}
          </button>
          <p class="text-xs text-fg-muted mt-3">Or open Termux and run <code class="px-1.5 py-0.5 rounded bg-bg-hover">pl start</code></p>
        </template>
        <p v-else class="text-fg-muted mt-2">The app couldn’t reach {{ config.url }}. Check that it’s running and that Tailscale is connected.</p>
        <div class="mt-4 flex justify-center gap-2">
          <button type="button" class="lib-btn small" @click="retry(true)">Try again</button>
          <nuxt-link to="/librarian/settings/connection" class="lib-btn small quiet">Connection settings</nuxt-link>
        </div>
      </div>

      <!-- Needs the API key -->
      <div v-else-if="gate && needsKey" class="px-6 py-12 text-center">
        <span class="material-symbols text-6xl lib-text-want">key</span>
        <h2 class="lib-serif text-2xl font-semibold mt-3">Pocket Librarian has a password</h2>
        <p class="text-fg-muted mt-2">Paste its API key. It’s in Pocket Librarian under Settings → Security & server.</p>
        <input v-model="key" type="password" class="lib-input mt-5" placeholder="API key" autocomplete="off" />
        <button type="button" class="lib-btn primary mt-3 w-full" @click="saveKey">Connect</button>
      </div>

      <slot v-else />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    title: String,
    tab: String,
    // Off for screens that must work while the server is unreachable (connection settings)
    gate: { type: Boolean, default: true }
  },
  data() {
    return {
      starting: false,
      key: '',
      statusTimer: null,
      gateTimer: null,
      tabs: [
        { id: 'library', label: 'Library', icon: 'shelves', to: '/librarian' },
        { id: 'wanted', label: 'Wanted', icon: 'bookmark', to: '/librarian/wanted' },
        { id: 'discover', label: 'Discover', icon: 'explore', to: '/librarian/discover' },
        { id: 'activity', label: 'Activity', icon: 'download', to: '/librarian/activity' },
        { id: 'settings', label: 'Settings', icon: 'tune', to: '/librarian/settings' }
      ]
    }
  },
  computed: {
    online() {
      return this.$store.state.librarian.online
    },
    needsKey() {
      return this.$store.state.librarian.needsKey
    },
    config() {
      return this.$store.state.librarian.config
    },
    activeCount() {
      return this.$store.getters['librarian/activeCount']
    }
  },
  watch: {
    online(val, old) {
      clearInterval(this.gateTimer)
      if (val === false) this.gateTimer = setInterval(() => this.retry(false), 5000)
      if (val && old === false) this.$emit('retry')
    }
  },
  methods: {
    async retry(manual) {
      const p = await this.$librarian.ping()
      if (p.online) {
        this.$librarian.loadStatus().catch(() => {})
      } else if (manual) {
        this.$toast.error('Still not answering.')
      }
    },
    async start() {
      this.starting = true
      try {
        await this.$librarian.startServer()
        this.$toast.success('Pocket Librarian is running')
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.starting = false
      }
    },
    async saveKey() {
      await this.$librarian.saveConfig({ ...this.config, apiKey: this.key })
      this.$store.commit('librarian/setNeedsKey', false)
      this.$emit('retry')
    },
    scrollTop() {
      if (this.$refs.scroller) this.$refs.scroller.scrollTop = 0
    }
  },
  mounted() {
    this.$librarian.loadStatus().catch(() => {})
    this.statusTimer = setInterval(() => {
      if (!document.hidden && this.online !== false) this.$librarian.loadStatus().catch(() => {})
    }, 15000)
    if (this.online === false) this.gateTimer = setInterval(() => this.retry(false), 5000)
  },
  beforeDestroy() {
    clearInterval(this.statusTimer)
    clearInterval(this.gateTimer)
  }
}
</script>
