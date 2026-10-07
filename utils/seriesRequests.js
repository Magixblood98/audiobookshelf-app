import { CapacitorHttp } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

/**
 * Series completion + requests.
 * Full series lists come from the Audible catalog (same source the ABS server uses for metadata).
 * Requests go through Prowlarr: search -> grab sends the release to Prowlarr's download client.
 * A book counts as "requested" when it shows up in Prowlarr's grab history or was requested from this app.
 * CapacitorHttp is used directly so requests are made natively (no CORS issues with Prowlarr/Audible).
 */

const CONFIG_KEY = 'seriesRequestsConfig'
const LOCAL_REQUESTS_KEY = 'seriesRequestsLocal'

export const AUDIBLE_REGIONS = {
  us: 'com',
  ca: 'ca',
  uk: 'co.uk',
  au: 'com.au',
  in: 'in',
  de: 'de',
  fr: 'fr',
  it: 'it',
  es: 'es',
  jp: 'co.jp'
}

// Newznab categories: 3000 Audio, 3030 Audio/Audiobook
const PROWLARR_CATEGORIES = [3000, 3030]

const DEFAULT_CONFIG = {
  prowlarrUrl: '',
  prowlarrApiKey: '',
  audibleRegion: 'us'
}

export async function getConfig() {
  try {
    const obj = (await Preferences.get({ key: CONFIG_KEY })) || {}
    return { ...DEFAULT_CONFIG, ...(obj.value ? JSON.parse(obj.value) : {}) }
  } catch (error) {
    console.error('[SeriesRequests] Failed to get config', error)
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveConfig(config) {
  await Preferences.set({ key: CONFIG_KEY, value: JSON.stringify({ ...DEFAULT_CONFIG, ...config }) })
}

export function isProwlarrConfigured(config) {
  return !!(config && config.prowlarrUrl && config.prowlarrApiKey)
}

async function getLocalRequests() {
  try {
    const obj = (await Preferences.get({ key: LOCAL_REQUESTS_KEY })) || {}
    return obj.value ? JSON.parse(obj.value) : {}
  } catch (error) {
    console.error('[SeriesRequests] Failed to get local requests', error)
    return {}
  }
}

async function addLocalRequest(book, release) {
  const requests = await getLocalRequests()
  requests[book.asin] = {
    title: book.title,
    releaseTitle: release.title,
    date: new Date().toISOString()
  }
  await Preferences.set({ key: LOCAL_REQUESTS_KEY, value: JSON.stringify(requests) })
}

async function request(method, url, { headers = {}, data, params } = {}) {
  const res = await CapacitorHttp.request({ method, url, headers, data, params, connectTimeout: 15000, readTimeout: 60000 })
  let body = res.data
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      // leave as string
    }
  }
  if (res.status >= 400 || res.status === 0) {
    let message = `HTTP ${res.status}`
    if (Array.isArray(body) && body[0]?.errorMessage) message = body[0].errorMessage
    else if (body?.message) message = body.message
    else if (typeof body === 'string' && body.length < 200) message = body
    const error = new Error(message)
    error.status = res.status
    throw error
  }
  return body
}

/* ---------------- Title matching ---------------- */

export function normalizeTitle(title, keepBrackets = false) {
  let t = (title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!keepBrackets) t = t.replace(/\(.*?\)|\[.*?\]/g, ' ')
  return t
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Drop series noise Audible adds to titles: ", Book 2", "(Full-Cast Edition)", ": A Novel" */
export function cleanTitle(title) {
  return (title || '')
    .replace(/\s*\((?:[^)]*\b(?:edition|unabridged|dramatized|dramatised|book \d+)\b[^)]*)\)/gi, '')
    .replace(/[,:]?\s*(?:book|volume|vol\.?|part)\s*\d+(?:\.\d+)?\s*$/i, '')
    .replace(/:\s*a novel\s*$/i, '')
    .trim()
}

function titleWords(title) {
  return normalizeTitle(title).split(' ').filter(Boolean)
}

/** True when titles are equal or one is the other plus a subtitle ("Edgedancer" vs "Edgedancer: Stormlight 2.5") */
export function titlesMatch(a, b) {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const [shorter, longer] = na.length < nb.length ? [na, nb] : [nb, na]
  return shorter.length >= 4 && longer.startsWith(shorter + ' ')
}

function authorSurname(authorName) {
  const first = (authorName || '').split(/,|&| and /)[0]
  const words = normalizeTitle(first).split(' ').filter(Boolean)
  return words[words.length - 1] || ''
}

/** Does a release / history title look like it is this book? */
function releaseMatchesBook(releaseTitle, book, authorName) {
  const haystack = ` ${normalizeTitle(releaseTitle, true)} `
  const words = titleWords(book.title)
  if (!words.length) return false
  if (!words.every((w) => haystack.includes(` ${w} `))) return false
  // Short titles ("Oathbringer", "Dune") need the author too, to avoid false positives
  if (words.length <= 2) {
    const surname = authorSurname(authorName)
    if (surname && !haystack.includes(` ${surname} `)) return false
  }
  return true
}

/* ---------------- Audible ---------------- */

function audibleBase(region) {
  return `https://api.audible.${AUDIBLE_REGIONS[region] || 'com'}/1.0/catalog/products`
}

async function audibleProductsByAsin(region, asins) {
  const products = []
  for (let i = 0; i < asins.length; i += 40) {
    const chunk = asins.slice(i, i + 40)
    const res = await request('GET', audibleBase(region), {
      params: {
        asins: chunk.join(','),
        response_groups: 'product_desc,contributors,series,media,product_attrs',
        image_sizes: '500'
      }
    })
    products.push(...(res.products || []))
  }
  return products.filter((p) => p.title)
}

function findMatchingSeries(products, seriesName) {
  const allSeries = products.flatMap((p) => p.series || [])
  const target = normalizeTitle(seriesName)
  const tiers = [
    // Exact, including parentheticals, so "Harry Potter" doesn't pick "Harry Potter (Full-Cast Editions)"
    (s) => normalizeTitle(s.title, true) === normalizeTitle(seriesName, true),
    (s) => titlesMatch(s.title, seriesName),
    // Looser: one name contains the other ("Stormlight Archive" vs "The Stormlight Archive Series")
    (s) => {
      const n = normalizeTitle(s.title)
      return n && target && (n.includes(target) || target.includes(n))
    }
  ]
  for (const tier of tiers) {
    const match = allSeries.find(tier)
    if (match) return match.asin
  }
  return null
}

/**
 * Find the Audible series ASIN for an ABS series
 * @param {string} region
 * @param {string} seriesName
 * @param {{title:string, asin:string, authorName:string}[]} ownedBooks
 */
export async function findAudibleSeriesAsin(region, seriesName, ownedBooks) {
  const asins = ownedBooks.map((b) => b.asin).filter(Boolean).slice(0, 10)
  if (asins.length) {
    const products = await audibleProductsByAsin(region, asins)
    const seriesAsin = findMatchingSeries(products, seriesName)
    if (seriesAsin) return seriesAsin
  }

  const authorName = ownedBooks.find((b) => b.authorName)?.authorName || ''
  const searches = ownedBooks.slice(0, 3).map((b) => ({ title: b.title, author: authorName }))
  searches.push({ keywords: seriesName, author: authorName })
  for (const search of searches) {
    const params = { num_results: '20', response_groups: 'series', products_sort_by: 'Relevance' }
    if (search.title) params.title = search.title
    if (search.keywords) params.keywords = search.keywords
    if (search.author) params.author = search.author
    const res = await request('GET', audibleBase(region), { params }).catch((error) => {
      console.error('[SeriesRequests] Audible search failed', error)
      return null
    })
    const seriesAsin = res && findMatchingSeries(res.products || [], seriesName)
    if (seriesAsin) return seriesAsin
  }
  return null
}

/**
 * Get every book in an Audible series, one entry per title (duplicate editions removed), in series order
 */
export async function getAudibleSeriesBooks(region, seriesAsin) {
  const res = await request('GET', `${audibleBase(region)}/${seriesAsin}`, {
    params: { response_groups: 'relationships,product_desc' }
  })
  const children = (res.product?.relationships || []).filter((r) => r.relationship_type === 'series' && r.relationship_to_product === 'child')
  if (!children.length) return []

  const relByAsin = {}
  children.forEach((r) => (relByAsin[r.asin] = r))
  const products = await audibleProductsByAsin(
    region,
    children.map((r) => r.asin)
  )

  // Keep the most common language so foreign editions don't show up as separate books
  const langCounts = {}
  products.forEach((p) => (langCounts[p.language || ''] = (langCounts[p.language || ''] || 0) + 1))
  const mainLanguage = Object.keys(langCounts).sort((a, b) => langCounts[b] - langCounts[a])[0]

  // One entry per series position; editions with a different title (US/UK) become altTitles
  const byKey = {}
  for (const p of products) {
    if (mainLanguage && p.language && p.language !== mainLanguage) continue
    const rel = relByAsin[p.asin] || {}
    const book = {
      asin: p.asin,
      title: cleanTitle(p.title),
      subtitle: p.subtitle || '',
      sequence: rel.sequence || '',
      sort: Number(rel.sort) || 0,
      authorName: (p.authors || []).map((a) => a.name).join(', '),
      releaseDate: p.release_date || p.issue_date || null,
      cover: p.product_images?.['500'] || null,
      altTitles: []
    }
    const key = book.sequence ? `#${book.sequence}` : normalizeTitle(book.title)
    const existing = byKey[key]
    if (!existing) {
      byKey[key] = book
      continue
    }
    // Prefer the edition that is already released, then the earliest one (usually the original title)
    const replace = (isUpcoming(existing) && !isUpcoming(book)) || (!isUpcoming(book) && (book.releaseDate || '') < (existing.releaseDate || ''))
    const [keep, other] = replace ? [book, existing] : [existing, book]
    keep.altTitles = [...new Set([...existing.altTitles, other.title].filter((t) => normalizeTitle(t) !== normalizeTitle(keep.title)))]
    if (!keep.cover) keep.cover = other.cover
    byKey[key] = keep
  }

  return Object.values(byKey).sort((a, b) => {
    const sa = parseFloat(a.sequence)
    const sb = parseFloat(b.sequence)
    if (!isNaN(sa) && !isNaN(sb) && sa !== sb) return sa - sb
    if (a.sort !== b.sort) return a.sort - b.sort
    return (a.releaseDate || '').localeCompare(b.releaseDate || '')
  })
}

export function isUpcoming(book) {
  return !!book.releaseDate && new Date(book.releaseDate) > new Date()
}

/* ---------------- Prowlarr ---------------- */

function prowlarrUrl(config, path) {
  return config.prowlarrUrl.trim().replace(/\/+$/, '') + path
}

function prowlarrHeaders(config) {
  return { 'X-Api-Key': config.prowlarrApiKey.trim(), 'Content-Type': 'application/json' }
}

export async function testProwlarr(config) {
  const status = await request('GET', prowlarrUrl(config, '/api/v1/system/status'), { headers: prowlarrHeaders(config) })
  const clients = await request('GET', prowlarrUrl(config, '/api/v1/downloadclient'), { headers: prowlarrHeaders(config) }).catch(() => [])
  return {
    version: status?.version || 'unknown',
    downloadClients: (clients || []).filter((c) => c.enable).map((c) => c.name)
  }
}

/** Titles of releases Prowlarr has grabbed (sent to a download client) */
export async function getProwlarrGrabHistory(config) {
  const res = await request('GET', prowlarrUrl(config, '/api/v1/history'), {
    headers: prowlarrHeaders(config),
    params: { page: '1', pageSize: '1000', sortKey: 'date', sortDirection: 'descending', eventType: '1' }
  })
  const records = res?.records || []
  return records
    .filter((r) => r.eventType === 'releaseGrabbed' || r.eventType === 1)
    .map((r) => {
      const data = r.data || {}
      const titles = Object.keys(data)
        .filter((k) => /title/i.test(k) && typeof data[k] === 'string')
        .map((k) => data[k])
      return { titles, date: r.date, successful: r.successful !== false }
    })
    .filter((r) => r.titles.length)
}

function scoreRelease(release, book, authorName) {
  if (!releaseMatchesBook(release.title, book, authorName)) return -1
  const t = ` ${normalizeTitle(release.title, true)} `
  // Ebooks are never what we want here
  if (/ (epub|mobi|azw3?|pdf|ebook|cbz|cbr) /.test(t)) return -1
  let score = 100
  const surname = authorSurname(authorName)
  if (surname && t.includes(` ${surname} `)) score += 50
  if ((release.categories || []).some((c) => c.id === 3030)) score += 20
  if (/ (m4b|mp3|audiobook|unabridged|audio) /.test(t)) score += 15
  if (/ abridged /.test(t)) score -= 40
  if (release.protocol === 'torrent') {
    if (!release.seeders) score -= 100
    else score += Math.min(release.seeders, 50)
  }
  return score
}

/**
 * Search Prowlarr for a book; returns matching releases best first (non-matching releases at the end with score -1)
 */
export async function searchProwlarr(config, book, authorName) {
  const query = `${authorSurname(authorName) ? authorName.split(/,|&| and /)[0].trim() + ' ' : ''}${cleanTitle(book.title).replace(/[()[\]:]/g, ' ').replace(/\s+/g, ' ').trim()}`
  const params = new URLSearchParams({ query, type: 'search', limit: '100' })
  PROWLARR_CATEGORIES.forEach((c) => params.append('categories', String(c)))
  const results = await request('GET', prowlarrUrl(config, `/api/v1/search?${params.toString()}`), { headers: prowlarrHeaders(config) })
  return (results || [])
    .map((r) => ({ ...r, score: scoreRelease(r, book, authorName) }))
    .sort((a, b) => b.score - a.score || (b.seeders || 0) - (a.seeders || 0))
}

/** Send a release to Prowlarr's download client and remember the request locally */
export async function grabRelease(config, release, book) {
  const { score, ...releaseResource } = release
  await request('POST', prowlarrUrl(config, '/api/v1/search'), {
    headers: prowlarrHeaders(config),
    data: releaseResource
  })
  await addLocalRequest(book, release)
}

/* ---------------- Series status ---------------- */

/**
 * Compare a full series against the books in the library.
 * @returns {Promise<{books: object[], counts: {total:number, owned:number, missing:number, requested:number, upcoming:number}, historyError: string|null}>}
 */
export async function buildSeriesStatus(config, seriesBooks, ownedBooks, authorName, { librarianBooks = null } = {}) {
  let history = []
  let historyError = null
  if (isProwlarrConfigured(config)) {
    try {
      history = await getProwlarrGrabHistory(config)
    } catch (error) {
      console.error('[SeriesRequests] Failed to load Prowlarr history', error)
      historyError = error.message || 'Failed to load Prowlarr history'
    }
  }
  const localRequests = await getLocalRequests()

  const ownedAsins = new Set(ownedBooks.map((b) => b.asin).filter(Boolean))
  const ownedSequences = new Set(ownedBooks.map((b) => (b.sequence || '').trim()).filter(Boolean))

  const books = seriesBooks.map((book) => {
    const allTitles = [book.title, ...(book.altTitles || [])]
    const ownedMatch = ownedBooks.find((o) => (o.asin && o.asin === book.asin) || allTitles.some((t) => titlesMatch(o.title, t)))
    const owned = !!ownedMatch || ownedAsins.has(book.asin) || (!!book.sequence && ownedSequences.has(book.sequence))
    let status = 'missing'
    let requestedInfo = null
    if (owned) {
      status = 'owned'
    } else if (isUpcoming(book)) {
      status = 'upcoming'
    } else {
      const lib = librarianBooks && findLibrarianBook(librarianBooks, allTitles)
      if (lib && lib.audio_status === 'have') {
        // Downloaded by Librarian; Audiobookshelf just hasn't scanned it in yet
        status = 'owned'
        requestedInfo = { source: 'Librarian', state: 'have', bookId: lib.id }
      } else if (lib && ['wanted', 'snatched'].includes(lib.audio_status)) {
        status = 'requested'
        requestedInfo = { source: 'Librarian', state: lib.audio_status, bookId: lib.id }
      }
    }
    if (status === 'missing') {
      const grab = history.find((h) => h.titles.some((t) => allTitles.some((title) => releaseMatchesBook(t, { title }, authorName))))
      if (grab) {
        status = 'requested'
        requestedInfo = { source: 'Prowlarr', date: grab.date, title: grab.titles[0] }
      } else if (localRequests[book.asin]) {
        status = 'requested'
        requestedInfo = { source: 'This app', date: localRequests[book.asin].date, title: localRequests[book.asin].releaseTitle }
      }
    }
    const librarianBook = librarianBooks && findLibrarianBook(librarianBooks, allTitles)
    return { ...book, status, requestedInfo, libraryItemId: ownedMatch?.id || null, librarianBookId: librarianBook?.id || null }
  })

  const counts = { total: 0, owned: 0, missing: 0, requested: 0, upcoming: 0 }
  books.forEach((b) => {
    counts[b.status]++
    if (b.status !== 'upcoming') counts.total++
  })
  return { books, counts, historyError }
}

/* ---------------- Pocket Librarian ---------------- */

const AUDIO_RANK = { have: 4, snatched: 3, wanted: 2, skipped: 1, ignored: 0 }

/** Librarian can hold several records for one book (editions); use the one furthest along */
function findLibrarianBook(librarianBooks, titles) {
  const matches = librarianBooks.filter((b) => titles.some((t) => titlesMatch(b.title, t) || (b.subtitle && titlesMatch(`${b.title} ${b.subtitle}`, t))))
  return matches.sort((a, b) => (AUDIO_RANK[b.audio_status] || 0) - (AUDIO_RANK[a.audio_status] || 0))[0]
}

/** Every book Pocket Librarian tracks for this author (its search matches title, author and series) */
export async function getLibrarianBooks(librarian, authorName) {
  const surname = authorSurname(authorName)
  if (!surname) return []
  const d = await librarian.get(`/api/books?status=all&q=${encodeURIComponent(surname)}&limit=500`)
  return (d.books || []).filter((b) => !b.author_name || normalizeTitle(b.author_name).split(' ').includes(surname))
}

/**
 * Want the audiobook in Pocket Librarian, which searches for it and downloads it (through Real-Debrid
 * on this setup). Open Library metadata is used when it can be found so folders and series are named well.
 */
export async function requestViaLibrarian(librarian, book, authorName, seriesName) {
  const firstAuthor = (authorName || book.authorName || '').split(/,|&| and /)[0].trim()
  let olBook = null
  try {
    const d = await librarian.get('/api/lookup/books?q=' + encodeURIComponent(`${cleanTitle(book.title)} ${firstAuthor}`))
    const surname = authorSurname(firstAuthor)
    olBook = (d.results || []).find((r) => titlesMatch(r.title, book.title) && (!surname || normalizeTitle(r.author_name).split(' ').includes(surname)))
  } catch (error) {
    console.warn('[SeriesRequests] Open Library lookup through Librarian failed', error)
  }
  if (olBook?.book_id) {
    // Never move a book that's already wanted, downloading or in the library back to wanted
    const existing = await librarian.get(`/api/books/${olBook.book_id}`)
    if (['skipped', 'ignored'].includes(existing.audio_status)) await librarian.patch(`/api/books/${olBook.book_id}`, { audio_status: 'wanted' })
    return olBook.book_id
  }
  const payload = olBook
    ? { ...olBook, series: olBook.series || seriesName, series_num: olBook.series_num || book.sequence }
    : { title: cleanTitle(book.title), author_name: firstAuthor, series: seriesName, series_num: book.sequence, year: book.releaseDate ? Number(book.releaseDate.slice(0, 4)) : null, cover_url: book.cover || '' }
  const r = await librarian.post('/api/books', { book: payload, want: ['audio'] })
  return r.id
}
