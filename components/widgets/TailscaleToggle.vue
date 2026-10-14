<template>
  <button v-if="installed" type="button" class="relative mx-1 h-10 w-9 flex items-center justify-center" :aria-label="connected ? 'Tailscale is on. Tap to turn it off.' : 'Tailscale is off. Tap to turn it on.'" :disabled="busy" @click="toggle">
    <span class="material-symbols text-2xl leading-none" :class="[connected ? 'fill' : '', busy ? 'animate-pulse' : '']" :style="{ color: connected ? '#4CAF50' : null, opacity: connected || busy ? 1 : 0.55 }">{{ connected ? 'vpn_lock' : 'vpn_key_off' }}</span>
  </button>
</template>

<script>
/** App-bar button that turns Tailscale on or off, so the Pi can be reached only while it's needed */
export default {
  data() {
    return { timer: null, toggling: false }
  },
  watch: {
    // Switched on in the Tailscale app or its notification: sync too
    connected(now, before) {
      if (now && !before && !this.toggling) this.$eventBus.$emit('tailscale-connected')
    }
  },
  computed: {
    installed() {
      return this.$store.state.tailscale.installed
    },
    connected() {
      return this.$store.state.tailscale.connected
    },
    busy() {
      return this.$store.state.tailscale.busy
    }
  },
  methods: {
    async toggle() {
      await this.$hapticsImpact()
      const turningOn = !this.connected
      this.toggling = true
      const ok = await this.$tailscale.toggle().finally(() => (this.toggling = false))
      if (!ok) {
        this.$toast.error(turningOn ? 'Tailscale didn’t connect. Open the Tailscale app to check it’s signed in.' : 'Tailscale didn’t turn off. Try again from the Tailscale app.')
        return
      }
      this.$toast.info(turningOn ? 'Tailscale is on' : 'Tailscale is off')
      if (turningOn) this.$eventBus.$emit('tailscale-connected')
    },
    check() {
      if (!document.hidden && !this.busy) this.$tailscale.refresh()
    }
  },
  mounted() {
    this.$tailscale.refresh()
    // Also catches Tailscale being switched in its own app or notification
    this.timer = setInterval(this.check, 5000)
    document.addEventListener('visibilitychange', this.check)
  },
  beforeDestroy() {
    clearInterval(this.timer)
    document.removeEventListener('visibilitychange', this.check)
  }
}
</script>
