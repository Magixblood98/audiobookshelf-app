<template>
  <div class="w-full h-full"></div>
</template>

<script>
import { START_PAGES } from '@/plugins/listening'

export default {
  async asyncData({ redirect, app }) {
    // Settings → Listening → Open the app on
    let page = '/bookshelf'
    try {
      await app.$listening.loaded
      page = app.store.state.listening.settings.startPage || page
    } catch (error) {
      console.error('[index] No start page setting', error)
    }
    if (!START_PAGES.some((p) => p[0] === page)) page = '/bookshelf'
    return redirect(page)
  },
  data() {
    return {}
  },
  computed: {},
  methods: {}
}
</script>
