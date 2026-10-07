<template>
  <div class="w-full h-full relative">
    <div class="w-full h-full overflow-y-auto px-3 py-5">
      <div class="flex items-center">
        <span class="material-symbols text-2xl pr-2" @click="$router.back()">arrow_back</span>
        <h1 class="text-xl font-sans truncate flex-grow">{{ series.name }}</h1>
        <span class="material-symbols text-2xl px-2" :class="loading ? 'opacity-50' : ''" @click="load">refresh</span>
        <span class="material-symbols text-2xl pl-2" @click="openSettings">settings</span>
      </div>
      <p v-if="authorName" class="text-sm text-fg-muted pl-8">{{ authorName }}</p>

      <!-- Where requests go -->
      <p v-if="librarianOnline" class="mt-3 text-xs text-fg-muted flex items-center"><span class="material-symbols text-base mr-1 lib-text-want">local_library</span>Requests go to Librarian, which downloads them for you.</p>
      <div v-else-if="!loadingConfig && !canRequest" class="mt-4 p-3 rounded-md border border-warning bg-warning bg-opacity-10 text-sm">
        Start Librarian (Pocket Librarian) to request books, or connect Prowlarr directly.
        <div class="flex gap-2 mt-2">
          <ui-btn small color="primary" @click="$router.push('/librarian')">Open Librarian</ui-btn>
          <ui-btn small color="bg" @click="openSettings">Set up Prowlarr</ui-btn>
        </div>
      </div>
      <p v-if="historyError" class="mt-3 text-xs text-error">Couldn't read Prowlarr history: {{ historyError }}</p>

      <div v-if="loading" class="py-16 flex flex-col items-center">
        <ui-loading-indicator />
        <p class="text-sm text-fg-muted mt-4">{{ loadingText }}</p>
      </div>

      <div v-else-if="errorText" class="py-10 text-center">
        <p class="text-error">{{ errorText }}</p>
      </div>

      <template v-else-if="books.length">
        <!-- Summary -->
        <div class="mt-5 grid grid-cols-4 gap-2 text-center">
          <div class="rounded-md bg-bg-hover py-2">
            <p class="text-xl font-semibold">{{ counts.total }}</p>
            <p class="text-xxs uppercase text-fg-muted">In series</p>
          </div>
          <div class="rounded-md bg-bg-hover py-2">
            <p class="text-xl font-semibold text-success">{{ counts.owned }}</p>
            <p class="text-xxs uppercase text-fg-muted">In library</p>
          </div>
          <div class="rounded-md bg-bg-hover py-2">
            <p class="text-xl font-semibold text-error">{{ counts.missing }}</p>
            <p class="text-xxs uppercase text-fg-muted">Missing</p>
          </div>
          <div class="rounded-md bg-bg-hover py-2">
            <p class="text-xl font-semibold text-info">{{ counts.requested }}</p>
            <p class="text-xxs uppercase text-fg-muted">Requested</p>
          </div>
        </div>
        <p class="text-sm text-fg-muted mt-3 text-center">
          <template v-if="counts.missing + counts.requested === 0">You have the whole series.</template>
          <template v-else>Missing {{ counts.missing + counts.requested }} of {{ counts.total }} books ({{ counts.requested }} requested, {{ counts.missing }} not requested)</template>
          <template v-if="counts.upcoming"> · {{ counts.upcoming }} upcoming</template>
        </p>

        <ui-btn v-if="counts.missing && canRequest" color="success" class="w-full mt-4 flex items-center justify-center" :loading="requestingAll" @click="requestAllMissing">
          <span class="material-symbols text-xl pr-2">playlist_add</span>
          Request rest of series ({{ counts.missing }})
        </ui-btn>

        <!-- Book list -->
        <div class="mt-5">
          <div v-for="book in books" :key="book.asin" class="flex items-center py-2 border-b border-border">
            <div class="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-bg-hover" @click="openBook(book)">
              <img v-if="book.cover" :src="book.cover" class="w-full h-full object-cover" loading="lazy" />
            </div>
            <div class="flex-grow min-w-0 px-3" @click="openBook(book)">
              <p class="text-sm truncate">
                <span v-if="book.sequence" class="text-fg-muted">#{{ book.sequence }}</span>
                {{ book.title }}
              </p>
              <p class="text-xs" :class="statusColor(book.status)">
                {{ statusText(book) }}
              </p>
            </div>
            <ui-btn v-if="book.status === 'missing' && canRequest" small color="primary" class="flex-shrink-0" :loading="requestingAsin === book.asin" @click="requestOne(book)">Request</ui-btn>
            <span v-else-if="book.status === 'requested' && book.librarianBookId" class="material-symbols text-xl text-fg-muted px-2" @click="openBook(book)">chevron_right</span>
            <span v-else-if="book.status === 'requested' && prowlarrConfigured && !librarianOnline" class="material-symbols text-xl text-fg-muted px-2" @click="openReleasePicker(book)">refresh</span>
            <span v-else-if="book.status === 'owned'" class="material-symbols text-xl text-success px-2 fill" @click="openBook(book)">check_circle</span>
          </div>
        </div>
        <p class="text-xxs text-fg-muted mt-4 text-center">Series list from Audible ({{ config.audibleRegion.toUpperCase() }}). "Requested" = wanted or downloading in Librarian, grabbed in Prowlarr, or requested from this app.</p>
      </template>
    </div>

    <!-- Release picker -->
    <div v-if="picker.book" class="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-end" @click.self="closePicker">
      <div class="w-full bg-bg rounded-t-xl flex flex-col" style="max-height: 80vh">
        <div class="flex items-center p-3 border-b border-border">
          <p class="flex-grow font-semibold truncate">{{ picker.book.title }}</p>
          <span class="material-symbols text-2xl" @click="closePicker">close</span>
        </div>
        <div class="overflow-y-auto flex-grow">
          <div v-if="picker.loading" class="py-10 flex justify-center"><ui-loading-indicator /></div>
          <p v-else-if="picker.error" class="p-4 text-error text-sm">{{ picker.error }}</p>
          <p v-else-if="!picker.releases.length" class="p-4 text-sm text-fg-muted">No releases found on your indexers.</p>
          <template v-else>
            <div v-for="release in visibleReleases" :key="release.indexerId + release.guid" class="px-3 py-2 border-b border-border" :class="release.score < 0 ? 'opacity-60' : ''" @click="confirmGrab(release)">
              <p class="text-sm break-words">{{ release.title }}</p>
              <p class="text-xs text-fg-muted mt-0.5">
                {{ release.indexer }} · {{ $bytesPretty(release.size || 0) }}
                <template v-if="release.protocol === 'torrent'"> · {{ release.seeders || 0 }} seeders</template>
                <template v-else> · usenet</template>
                <span v-if="release.score < 0" class="text-warning"> · title doesn't match</span>
              </p>
            </div>
            <p v-if="hiddenReleaseCount" class="p-3 text-xs text-center text-info" @click="picker.showAll = true">Show {{ hiddenReleaseCount }} non-matching results</p>
          </template>
        </div>
      </div>
    </div>

    <!-- Settings -->
    <div v-if="showSettings" class="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center px-4" @click.self="showSettings = false">
      <div class="w-full bg-bg rounded-xl p-4">
        <p class="font-semibold mb-3">Series requests</p>
        <ui-text-input-with-label v-model="settingsForm.prowlarrUrl" label="Prowlarr address" placeholder="http://100.x.y.z:9696" :autofocus="false" />
        <ui-text-input-with-label v-model="settingsForm.prowlarrApiKey" label="Prowlarr API key" class="mt-3" :autofocus="false" />
        <p class="text-xxs text-fg-muted mt-1">Prowlarr → Settings → General → API Key. Requests are sent to the download client set up in Prowlarr → Settings → Download Clients.</p>
        <div class="mt-3">
          <p class="pb-0.5 text-sm font-semibold">Audible store (for series lists)</p>
          <select v-model="settingsForm.audibleRegion" class="w-full bg-bg-hover border border-border rounded px-2 py-2">
            <option v-for="region in audibleRegions" :key="region" :value="region">{{ region.toUpperCase() }}</option>
          </select>
        </div>
        <p v-if="testResult" class="text-xs mt-3" :class="testResult.ok ? 'text-success' : 'text-error'">{{ testResult.text }}</p>
        <div class="flex mt-4 gap-2">
          <ui-btn small color="primary" :loading="testing" :disabled="!settingsForm.prowlarrUrl || !settingsForm.prowlarrApiKey" @click="testSettings">Test</ui-btn>
          <div class="flex-grow" />
          <ui-btn small color="bg" @click="showSettings = false">Cancel</ui-btn>
          <ui-btn small color="success" @click="saveSettings">Save</ui-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Dialog } from '@capacitor/dialog'
import { AUDIBLE_REGIONS, getConfig, saveConfig, isProwlarrConfigured, testProwlarr, findAudibleSeriesAsin, getAudibleSeriesBooks, buildSeriesStatus, searchProwlarr, grabRelease, getLibrarianBooks, requestViaLibrarian } from '@/utils/seriesRequests'

export default {
  async asyncData({ params, app, store, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/connect?redirect=${route.path}`)
    }
    const series = await app.$nativeHttp.get(`/api/series/${params.id}`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!series) {
      return redirect('/oops?message=Series not found')
    }
    return { series }
  },
  data() {
    return {
      config: { prowlarrUrl: '', prowlarrApiKey: '', audibleRegion: 'us' },
      loadingConfig: true,
      librarianOnline: false,
      loading: false,
      loadingText: '',
      errorText: '',
      historyError: null,
      authorName: '',
      ownedBooks: [],
      books: [],
      counts: { total: 0, owned: 0, missing: 0, requested: 0, upcoming: 0 },
      requestingAll: false,
      requestingAsin: null,
      picker: { book: null, loading: false, error: '', releases: [], showAll: false },
      showSettings: false,
      settingsForm: {},
      testing: false,
      testResult: null
    }
  },
  computed: {
    prowlarrConfigured() {
      return isProwlarrConfigured(this.config)
    },
    canRequest() {
      return this.librarianOnline || this.prowlarrConfigured
    },
    audibleRegions() {
      return Object.keys(AUDIBLE_REGIONS)
    },
    visibleReleases() {
      if (this.picker.showAll) return this.picker.releases
      const matching = this.picker.releases.filter((r) => r.score >= 0)
      return matching.length ? matching : this.picker.releases
    },
    hiddenReleaseCount() {
      return this.picker.releases.length - this.visibleReleases.length
    }
  },
  methods: {
    statusText(book) {
      if (book.status === 'owned') return book.libraryItemId || book.requestedInfo?.source !== 'Librarian' ? 'In your library' : 'Downloaded by Librarian, Audiobookshelf will pick it up'
      if (book.status === 'upcoming') return `Coming ${new Date(book.releaseDate).toLocaleDateString()}`
      if (book.status === 'requested' && book.requestedInfo?.source === 'Librarian') {
        return { wanted: 'Wanted in Librarian, searching', snatched: 'Downloading (Librarian)' }[book.requestedInfo.state]
      }
      if (book.status === 'requested') {
        const date = book.requestedInfo?.date ? new Date(book.requestedInfo.date).toLocaleDateString() : ''
        return `Requested${date ? ' ' + date : ''} (${book.requestedInfo?.source})`
      }
      return 'Missing · not requested'
    },
    statusColor(status) {
      return { owned: 'text-success', requested: 'text-info', upcoming: 'text-fg-muted', missing: 'text-error' }[status]
    },
    async fetchOwnedBooks() {
      const owned = []
      const filter = `series.${this.$encode(this.series.id)}`
      let page = 0
      while (true) {
        const payload = await this.$nativeHttp.get(`/api/libraries/${this.series.libraryId}/items?filter=${filter}&limit=100&page=${page}&minified=1`)
        const results = payload?.results || []
        results.forEach((item) => {
          const metadata = item.media?.metadata || {}
          owned.push({
            id: item.id,
            title: metadata.title,
            asin: metadata.asin || null,
            sequence: metadata.series?.sequence || '',
            authorName: metadata.authorName || ''
          })
        })
        page++
        if (!results.length || owned.length >= (payload.total || 0)) break
      }
      return owned
    },
    async load() {
      if (this.loading) return
      this.loading = true
      this.errorText = ''
      this.historyError = null
      try {
        this.loadingText = 'Loading your books...'
        this.ownedBooks = await this.fetchOwnedBooks()
        this.authorName = this.ownedBooks.find((b) => b.authorName)?.authorName || ''

        this.loadingText = 'Finding the series on Audible...'
        const seriesAsin = await findAudibleSeriesAsin(this.config.audibleRegion, this.series.name, this.ownedBooks)
        if (!seriesAsin) {
          this.errorText = `Couldn't find "${this.series.name}" on Audible ${this.config.audibleRegion.toUpperCase()}. Try another Audible store in settings, or match the books in Audiobookshelf so they have an ASIN.`
          return
        }
        const seriesBooks = await getAudibleSeriesBooks(this.config.audibleRegion, seriesAsin)
        if (!seriesBooks.length) {
          this.errorText = 'Audible returned no books for this series.'
          return
        }

        this.loadingText = 'Checking Librarian...'
        // Starts Pocket Librarian if it's off (and auto-start is on), so requests go through it
        if (this.$librarian.isLocal && this.$store.state.librarian.config.autoStart !== false && !(await this.$librarian.ping()).online) this.loadingText = 'Starting Librarian...'
        await this.$librarian.ensureRunning()
        const ping = await this.$librarian.ping()
        this.librarianOnline = ping.online && !(ping.auth && !ping.authed)
        let librarianBooks = null
        if (this.librarianOnline) {
          librarianBooks = await getLibrarianBooks(this.$librarian, this.authorName || seriesBooks[0].authorName).catch((error) => {
            console.error('[SeriesMissing] Failed to read Librarian books', error)
            return null
          })
        }
        if (this.prowlarrConfigured) this.loadingText = 'Checking Prowlarr...'
        const result = await buildSeriesStatus(this.config, seriesBooks, this.ownedBooks, this.authorName, { librarianBooks })
        this.books = result.books
        this.counts = result.counts
        this.historyError = result.historyError
      } catch (error) {
        console.error('[SeriesMissing] Failed to load', error)
        this.errorText = `Failed to load series: ${error.message || error}`
      } finally {
        this.loading = false
      }
    },
    openBook(book) {
      if (book.libraryItemId) this.$router.push(`/item/${book.libraryItemId}`)
      else if (book.librarianBookId && this.librarianOnline) this.$librarian.openBook(book.librarianBookId)
    },
    requestOne(book) {
      if (this.librarianOnline) return this.requestLibrarian(book)
      this.openReleasePicker(book)
    },
    async requestLibrarian(book, quiet = false) {
      this.requestingAsin = book.asin
      try {
        const id = await requestViaLibrarian(this.$librarian, book, this.authorName, this.series.name)
        this.markRequestedLibrarian(book, id)
        if (!quiet) this.$toast.success(`Wanted ${book.title}. Librarian is searching for it.`)
        this.$librarian.changed({ bookId: id })
        return true
      } catch (error) {
        if (quiet) throw error
        this.$toast.error(`Request failed: ${error.message || error}`)
        return false
      } finally {
        this.requestingAsin = null
      }
    },
    markRequestedLibrarian(book, id) {
      const target = this.books.find((b) => b.asin === book.asin)
      if (!target) return
      if (target.status === 'missing') {
        this.counts.missing--
        this.counts.requested++
      }
      target.status = 'requested'
      target.librarianBookId = id
      target.requestedInfo = { source: 'Librarian', state: 'wanted', bookId: id }
    },
    async openReleasePicker(book) {
      this.picker = { book, loading: true, error: '', releases: [], showAll: false }
      try {
        this.picker.releases = await searchProwlarr(this.config, book, this.authorName || book.authorName)
      } catch (error) {
        this.picker.error = `Search failed: ${error.message || error}`
      } finally {
        this.picker.loading = false
      }
    },
    closePicker() {
      this.picker = { book: null, loading: false, error: '', releases: [], showAll: false }
    },
    async confirmGrab(release) {
      const book = this.picker.book
      const { value } = await Dialog.confirm({
        title: 'Request book',
        message: `Send "${release.title}" (${this.$bytesPretty(release.size || 0)}) to your download client?`
      })
      if (!value) return
      this.closePicker()
      this.requestingAsin = book.asin
      try {
        await grabRelease(this.config, release, book)
        this.$toast.success(`Requested ${book.title}`)
        this.markRequested(book, release)
      } catch (error) {
        this.$toast.error(`Request failed: ${error.message || error}`)
      } finally {
        this.requestingAsin = null
      }
    },
    markRequested(book, release) {
      const target = this.books.find((b) => b.asin === book.asin)
      if (!target) return
      if (target.status === 'missing') {
        this.counts.missing--
        this.counts.requested++
      }
      target.status = 'requested'
      target.requestedInfo = { source: 'This app', date: new Date().toISOString(), title: release.title }
    },
    async requestAllMissing() {
      const missing = this.books.filter((b) => b.status === 'missing')
      if (!missing.length) return
      const { value } = await Dialog.confirm({
        title: 'Request rest of series',
        message: `${this.librarianOnline ? 'Want these in Librarian, which searches and downloads them' : 'Search Prowlarr and request the best release'} for ${missing.length} missing book${missing.length > 1 ? 's' : ''}?\n\n${missing.map((b) => `${b.sequence ? '#' + b.sequence + ' ' : ''}${b.title}`).join('\n')}`
      })
      if (!value) return

      this.requestingAll = true
      const failed = []
      let requested = 0
      for (const book of missing) {
        if (this.librarianOnline) {
          try {
            await this.requestLibrarian(book, true)
            requested++
          } catch (error) {
            failed.push(`${book.title} (${error.message || error})`)
          }
          continue
        }
        this.requestingAsin = book.asin
        try {
          const releases = await searchProwlarr(this.config, book, this.authorName || book.authorName)
          const best = releases.find((r) => r.score >= 0)
          if (!best) {
            failed.push(`${book.title} (no matching release)`)
            continue
          }
          await grabRelease(this.config, best, book)
          this.markRequested(book, best)
          requested++
        } catch (error) {
          failed.push(`${book.title} (${error.message || error})`)
        }
      }
      this.requestingAsin = null
      this.requestingAll = false

      if (requested) this.$toast.success(`Requested ${requested} book${requested > 1 ? 's' : ''}`)
      if (failed.length) {
        await Dialog.alert({
          title: `${failed.length} not requested`,
          message: `${failed.join('\n')}\n\nTap Request on a book to try again.`
        })
      }
    },
    openSettings() {
      this.settingsForm = { ...this.config }
      this.testResult = null
      this.showSettings = true
    },
    async testSettings() {
      this.testing = true
      this.testResult = null
      try {
        const { version, downloadClients } = await testProwlarr(this.settingsForm)
        if (!downloadClients.length) {
          this.testResult = { ok: false, text: `Connected to Prowlarr ${version}, but it has no enabled download client. Add one under Settings → Download Clients so requests have somewhere to go.` }
        } else {
          this.testResult = { ok: true, text: `Connected to Prowlarr ${version}. Requests go to: ${downloadClients.join(', ')}` }
        }
      } catch (error) {
        this.testResult = { ok: false, text: `Couldn't connect: ${error.message || error}` }
      } finally {
        this.testing = false
      }
    },
    async saveSettings() {
      const regionChanged = this.settingsForm.audibleRegion !== this.config.audibleRegion
      const prowlarrChanged = this.settingsForm.prowlarrUrl !== this.config.prowlarrUrl || this.settingsForm.prowlarrApiKey !== this.config.prowlarrApiKey
      await saveConfig(this.settingsForm)
      this.config = await getConfig()
      this.showSettings = false
      if (regionChanged || prowlarrChanged) this.load()
    }
  },
  async mounted() {
    this.config = await getConfig()
    this.loadingConfig = false
    this.load()
  }
}
</script>
