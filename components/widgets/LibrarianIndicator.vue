<template>
  <nuxt-link v-if="active" to="/librarian/activity" class="relative mx-1.5 flex items-center h-10" :aria-label="`Librarian: ${active} downloading`">
    <span class="material-symbols text-2xl leading-none lib-text-get">local_library</span>
    <span class="absolute top-0.5 -right-1.5 min-w-4 h-4 px-1 rounded-full text-xxs leading-4 text-center font-semibold" style="background: var(--lib-get); color: var(--lib-get-ink)">{{ active }}</span>
  </nuxt-link>
</template>

<script>
/** Shows in the app bar while Librarian (Pocket Librarian) is downloading something */
export default {
  data() {
    return { timer: null }
  },
  computed: {
    active() {
      return this.$store.getters['librarian/activeCount']
    }
  },
  methods: {
    check() {
      if (document.hidden) return
      // Librarian pages poll on their own; elsewhere check quietly every 30 seconds
      if (this.$route.path.startsWith('/librarian')) return
      this.$librarian.loadStatus().catch(() => {})
    }
  },
  mounted() {
    this.check()
    this.timer = setInterval(this.check, 30000)
  },
  beforeDestroy() {
    clearInterval(this.timer)
  }
}
</script>
