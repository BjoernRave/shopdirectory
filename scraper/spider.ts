import * as fs from 'fs'
import puppeteer, { Browser } from 'puppeteer'
import util from 'util'

const baseUrl = process.env.URL || 'https://www.macmedcompendium.ca'
const DEPTH = parseInt(process.env.DEPTH) || 2
const OUT_DIR = process.env.OUTDIR || `output/${slugify(baseUrl)}`

const crawledPages = new Map()
const maxDepth = DEPTH // Subpage depth to crawl site.

function slugify(str: string) {
  return str.replace(/[\/:]/g, '_')
}

function mkdirSync(dirPath: string) {
  try {
    dirPath.split('/').reduce((parentPath, dirName) => {
      const currentPath = parentPath + dirName
      if (!fs.existsSync(currentPath)) {
        fs.mkdirSync(currentPath)
      }
      return currentPath + '/'
    }, '')
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }
}

/**
 * Finds all anchors on the page, inclusive of those within shadow roots.
 * Note: Intended to be run in the context of the page.
 * @param {boolean=} sameOrigin When true, only considers links from the same origin as the app.
 * @return {!Array<string>} List of anchor hrefs.
 */
function collectAllSameOriginAnchorsDeep(sameOrigin = true) {
  const allElements = []

  const findAllElements = function (nodes: NodeListOf<Element>) {
    for (let i = 0, el; (el = nodes[i]); ++i) {
      allElements.push(el)
      // If the element has a shadow root, dig deeper.
      if (el.shadowRoot) {
        findAllElements(el.shadowRoot.querySelectorAll('*'))
      }
    }
  }

  findAllElements(document.querySelectorAll('*'))

  const filtered = allElements
    .filter((el) => el.localName === 'a' && el.href) // element is an anchor with an href.
    .filter((el) => el.href !== location.href) // link doesn't point to page's own URL.
    .filter((el) => {
      if (sameOrigin) {
        return new URL(location.toString()).origin === new URL(el.href).origin
      }
      return true
    })
    .map((a) => a.href)

  return Array.from(new Set(filtered))
}

/**
 * Crawls a URL by visiting an url, then recursively visiting any child subpages.
 * @param {!Browser} browser
 * @param {{url: string, title: string, img?: string, children: !Array<!Object>}} page Current page.
 * @param {number=} depth Current subtree depth of crawl.
 */
export const crawl = async (browser: Browser, page: Page, depth = 0) => {
  if (depth > maxDepth) {
    return
  }

  // If we've already crawled the URL, we know its children.
  if (crawledPages.has(page.url)) {
    console.log(`Reusing route: ${page.url}`)
    const item = crawledPages.get(page.url)
    page.title = item.title
    page.img = item.img
    page.children = item.children
    // Fill in the children with details (if they already exist).
    page.children.forEach((c) => {
      const item = crawledPages.get(c.url)
      c.title = item ? item.title : ''
      c.img = item ? item.img : null
    })
    return
  } else {
    console.log(`Loading: ${page.url}`)

    const newPage = await browser.newPage()
    await newPage.goto(page.url, { waitUntil: 'networkidle2' })

    let anchors = await newPage.evaluate(collectAllSameOriginAnchorsDeep)
    anchors = anchors.filter((a) => a !== URL) // link doesn't point to start url of crawl.

    page.title = (await newPage.evaluate('document.title')) as string
    page.children = anchors.map((url) => ({ url }))

    crawledPages.set(page.url, page) // cache it.

    await newPage.close()
  }

  // Crawl subpages.
  for (const childPage of page.children) {
    await crawl(browser, childPage, depth + 1)
  }
}
;(async () => {
  mkdirSync(OUT_DIR) // create output dir if it doesn't exist.

  const browser = await puppeteer.launch()

  const root = { url: baseUrl }
  await crawl(browser, root)

  console.log(root)

  await util.promisify(fs.writeFile)(
    `./${OUT_DIR}/crawl.json`,
    JSON.stringify(root, null, ' ')
  )

  await browser.close()
})()

interface Page {
  title?: string
  img?: string
  url: string
  children?: Page[]
}
