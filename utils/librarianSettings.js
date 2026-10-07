// Pocket Librarian settings sections, ported field-for-field from its web app.
// Field format: [configPath, label, type, help, options]; a plain string is a heading.

export const CLIENT_NAMES = { realdebrid: 'Real-Debrid', qbittorrent: 'qBittorrent', transmission: 'Transmission', sabnzbd: 'SABnzbd', nzbget: 'NZBGet', blackhole: 'Blackhole folder' }

const PATH_HELP = 'Only when the client runs on another machine and its download folder is shared with this device. Leave both empty and books are marked done when the client finishes.'

export const CLIENT_FIELDS = {
  realdebrid: [
    ['token', 'API token', 'password', 'Copy it from real-debrid.com/apitoken.'],
    ['download_local', 'Also download a copy to this device', 'toggle', 'Files land in your library folders, ready to play offline. Turn off to leave books in Real-Debrid only.'],
    ['keep_in_rd', 'Keep the torrent in Real-Debrid afterwards', 'toggle', 'Leave on if another device streams your Real-Debrid library, for example through zurg.'],
    ['wifi_only', 'Only copy to this device on Wi-Fi', 'toggle', 'Needs the Termux:API app.'],
    ['try_cached', 'Try releases nobody is seeding', 'toggle', 'Real-Debrid often has them cached. Each one is checked first and dropped at once if it isn’t.']
  ],
  qbittorrent: [
    ['url', 'Address', 'url', 'Like http://100.101.102.103:8080', { placeholder: 'http://' }],
    ['username', 'Username'],
    ['password', 'Password', 'password'],
    ['category', 'Category'],
    ['remote_path', 'Download folder as qBittorrent sees it', 'text', PATH_HELP],
    ['local_path', 'The same folder as this device sees it']
  ],
  transmission: [
    ['url', 'Address', 'url', 'Like http://100.101.102.103:9091', { placeholder: 'http://' }],
    ['username', 'Username'],
    ['password', 'Password', 'password'],
    ['download_dir', 'Download folder (optional)'],
    ['remote_path', 'Download folder as Transmission sees it', 'text', PATH_HELP],
    ['local_path', 'The same folder as this device sees it']
  ],
  sabnzbd: [
    ['url', 'Address', 'url', 'Like http://100.101.102.103:8080', { placeholder: 'http://' }],
    ['api_key', 'API key', 'password'],
    ['category', 'Category'],
    ['remote_path', 'Download folder as SABnzbd sees it', 'text', PATH_HELP],
    ['local_path', 'The same folder as this device sees it']
  ],
  nzbget: [
    ['url', 'Address', 'url', 'Like http://100.101.102.103:6789', { placeholder: 'http://' }],
    ['username', 'Username'],
    ['password', 'Password', 'password'],
    ['category', 'Category'],
    ['remote_path', 'Download folder as NZBGet sees it', 'text', PATH_HELP],
    ['local_path', 'The same folder as this device sees it']
  ]
}

export const CHANNELS = [
  ['android', 'Phone notifications', [], 'Uses the Termux:API app. Install it from the same place as Termux, then run pkg install termux-api.'],
  ['ntfy', 'ntfy', [['server', 'Server'], ['topic', 'Topic'], ['token', 'Access token', 'password', 'Only for protected topics.']]],
  ['pushover', 'Pushover', [['user', 'User key'], ['token', 'App token', 'password']]],
  ['telegram', 'Telegram', [['bot_token', 'Bot token', 'password'], ['chat_id', 'Chat ID']]],
  ['discord', 'Discord', [['webhook', 'Webhook address', 'url']]],
  ['teams', 'Microsoft Teams', [['webhook', 'Workflow webhook address', 'url', 'Make one in Teams with the workflow that posts to a channel when a webhook request arrives.']]],
  ['webhook', 'Webhook', [['url', 'Address', 'url', 'Gets a JSON POST with a title and a message.']]]
]

export const SECTIONS = [
  { id: 'connection', title: 'Connection', sum: (c, app) => `${app.url}${app.apiKey ? ', with API key' : ''}` },
  {
    id: 'indexers',
    title: 'Indexers',
    sum: (c) => {
      const n = (c.providers || []).filter((p) => p.enabled !== false).length
      return n ? `${n} in use: ${(c.providers || []).map((p) => p.name).join(', ')}` : 'Where releases are searched for'
    }
  },
  {
    id: 'downloads',
    title: 'Downloads',
    sum: (c) =>
      c.clients.torrent !== 'none' || c.clients.usenet !== 'none'
        ? [c.clients.torrent, c.clients.usenet]
            .filter((x) => x !== 'none')
            .map((x) => CLIENT_NAMES[x])
            .join(' and ')
        : 'Real-Debrid, torrent and Usenet clients'
  },
  {
    id: 'library',
    title: 'Library',
    sum: () => 'Folders, file names and formats',
    fields: [
      ['library.audio_dir', 'Audiobook folder', 'text', 'Audiobookshelf or your audiobook player can watch this folder.'],
      ['library.ebook_dir', 'Ebook folder'],
      ['library.audio_folder', 'Audiobook folder names', 'text', 'Use {Author} {Title} {Series} {SeriesNum} {Year}. Parts in [ ] drop out when a field is empty.'],
      ['library.ebook_folder', 'Ebook folder names'],
      ['library.ebook_file', 'Ebook file names'],
      ['library.audio_formats', 'Audiobook formats, best first'],
      ['library.ebook_formats', 'Ebook formats, best first'],
      ['library.keep_all_formats', 'Keep every ebook format a download includes', 'toggle'],
      ['library.write_opf', 'Write a metadata.opf file with each book', 'toggle', 'Audiobookshelf and Calibre read it for the title, author and series.'],
      ['library.save_cover', 'Save a cover image with each book', 'toggle'],
      ['library.scan_add_unknown', 'Add books a folder scan finds that aren’t listed yet', 'toggle']
    ],
    actions: [{ label: 'Scan folders now', icon: 'refresh', path: '/api/library/scan', msg: (r) => (r.started ? 'Scanning. The result shows under Activity, Jobs.' : 'A scan is already running') }]
  },
  {
    id: 'search',
    title: 'Search rules',
    sum: () => 'Matching, rejected words and sizes',
    fields: [
      ['search.match_ratio', 'How closely the title must match (%)', 'number'],
      ['search.require_author', 'The release must name the author', 'toggle'],
      ['search.prefer_single', 'Avoid collections and box sets', 'toggle'],
      ['search.audio_reject', 'Skip audiobook releases containing', 'text', 'Comma separated. Whole words only, so abridged doesn’t match unabridged.'],
      ['search.ebook_reject', 'Skip ebook releases containing'],
      ['search.must_words', 'Releases must contain'],
      ['search.audio_min_mb', 'Smallest audiobook (MB)', 'number'],
      ['search.audio_max_mb', 'Largest audiobook (MB)', 'number'],
      ['search.ebook_min_mb', 'Smallest ebook (MB)', 'number'],
      ['search.ebook_max_mb', 'Largest ebook (MB)', 'number'],
      ['search.min_seeders', 'Fewest seeders', 'number'],
      ['search.audio_categories', 'Audiobook categories', 'text', 'Newznab numbers. 3030 is audiobooks.'],
      ['search.ebook_categories', 'Ebook categories', 'text', '7000 is books, 7020 ebooks.'],
      ['search.search_on_want', 'Search as soon as a book is wanted', 'toggle'],
      ['search.wide_search', 'Look in every category when nothing turns up', 'toggle', 'Many audiobooks are filed under Other or Books. Movies, TV and games are still left out.'],
      ['search.retry_failed', 'Search again when a download fails', 'toggle']
    ]
  },
  {
    id: 'schedule',
    title: 'Schedule',
    sum: (c) => (+c.automation.search_hours ? `Searches every ${c.automation.search_hours} hours` : 'Automatic searching is off'),
    fields: [
      ['automation.search_hours', 'Search for wanted books every (hours)', 'number', '0 turns it off.'],
      ['search.max_per_run', 'Books per scheduled search', 'number'],
      ['search.delay_seconds', 'Pause between searches (seconds)', 'number', 'Keeps indexers happy.'],
      ['automation.refresh_hours', 'Check followed authors every (hours)', 'number'],
      ['automation.wishlist_hours', 'Sync wishlists every (hours)', 'number'],
      ['automation.scan_hours', 'Scan library folders every (hours)', 'number'],
      ['automation.poll_seconds', 'Check downloads every (seconds)', 'number'],
      ['clients.stall_hours', 'Give up on a stalled download after (hours)', 'number']
    ]
  },
  {
    id: 'audiobookshelf',
    title: 'Audiobookshelf',
    sum: (c) => (c.audiobookshelf.enabled ? 'Scans after each download' : 'Scan Audiobookshelf when a book is ready'),
    fields: [
      ['audiobookshelf.enabled', 'Scan Audiobookshelf when a book is ready', 'toggle'],
      ['audiobookshelf.url', 'Address', 'url', 'Like http://100.101.102.103:13378', { placeholder: 'http://' }],
      ['audiobookshelf.token', 'API token', 'password', 'In Audiobookshelf: Settings, then Users, then your user, then API Token.'],
      ['audiobookshelf.libraries', 'Libraries to scan', 'text', 'Names, comma separated. Leave empty to scan every book library.'],
      ['audiobookshelf.kinds', 'Scan after', 'select', null, [['both', 'Ebooks and audiobooks'], ['audio', 'Audiobooks only'], ['ebook', 'Ebooks only']]],
      ['audiobookshelf.delay_seconds', 'Wait before scanning (seconds)', 'number', 'Gives zurg time to show the new torrent. Downloads that finish during the wait share one scan.'],
      ['audiobookshelf.set_metadata', 'Give new books this app’s title, author, series and cover', 'toggle', 'After the scan, finds the new download in Audiobookshelf and replaces whatever the file tags said.'],
      'Library sync',
      ['audiobookshelf.sync_have', 'Mark books Audiobookshelf already has as owned', 'toggle', 'Stops wanted books you already have from being downloaded again, including every book in a series pack.'],
      ['audiobookshelf.import_unknown', 'Add Audiobookshelf books that aren’t listed here', 'toggle', 'Looked up on Open Library. Items it can’t identify are left alone.'],
      ['audiobookshelf.sync_hours', 'Sync every (hours)', 'number', 'It also runs after each scan. 0 turns the schedule off.']
    ],
    actions: [
      { label: 'Test connection', path: '/api/test/audiobookshelf', withConfig: 'audiobookshelf', msg: (r) => r.message },
      { label: 'Scan now', icon: 'refresh', path: '/api/audiobookshelf/scan', withConfig: 'audiobookshelf', msg: (r) => r.message },
      { label: 'Sync library now', path: '/api/audiobookshelf/sync', msg: (r) => r.message }
    ],
    fillFromApp: true
  },
  {
    id: 'notifications',
    title: 'Notifications',
    sum: (c) => {
      const on = CHANNELS.filter(([id]) => (c.notifications[id] || {}).enabled).map(([, t]) => t)
      return on.length ? on.join(', ') : 'Phone alerts, ntfy, Discord and more'
    }
  },
  { id: 'lists', title: 'Wishlists & import', sum: (c) => ((c.wishlists || []).length ? `${c.wishlists.length} wishlist${c.wishlists.length === 1 ? '' : 's'}` : 'Goodreads shelves and CSV files') },
  {
    id: 'kindle',
    title: 'Send to Kindle',
    sum: (c) => c.email.kindle_addr || 'Email ebooks to a Kindle',
    fields: [
      ['email.kindle_addr', 'Your Kindle address', 'email', 'On Amazon: Manage Your Content and Devices, then Preferences, then Personal Document Settings. Add the From address below to the approved list there.'],
      ['email.from_addr', 'From address', 'email'],
      ['email.smtp_host', 'Email server', 'text', 'For Gmail: smtp.gmail.com, with an app password.'],
      ['email.smtp_port', 'Port', 'number'],
      ['email.security', 'Security', 'select', null, [['starttls', 'STARTTLS (usually port 587)'], ['ssl', 'SSL (usually port 465)'], ['none', 'None']]],
      ['email.username', 'Username'],
      ['email.password', 'Password', 'password']
    ],
    actions: [{ label: 'Send a test email', path: '/api/test/email', withConfig: 'email', msg: (r) => r.message }]
  },
  {
    id: 'metadata',
    title: 'Book info',
    sum: (c) => (c.metadata.language ? `Language: ${c.metadata.language}` : 'All languages'),
    fields: [
      ['metadata.language', 'Language', 'text', 'Three-letter code from Open Library, like eng, spa or ger. Leave empty for every language.'],
      ['metadata.skip_words', 'Leave out titles containing', 'textarea', 'Keeps study guides and summaries off your shelves.'],
      ['metadata.google_api_key', 'Google Books API key', 'password', 'Optional. Raises the limit on Google Books lookups, used when Open Library has nothing.']
    ]
  },
  { id: 'security', title: 'Security & server', sum: (c) => (c.server.password ? 'Password set' : 'No password') + (c.server.host === '0.0.0.0' ? ', open to other devices' : ', this phone only') },
  { id: 'about', title: 'About', sum: (c) => 'Version ' + c.meta.version }
]
