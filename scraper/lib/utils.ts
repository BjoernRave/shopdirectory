import moment from 'moment'
import puppeteer, { Browser, ElementHandle, Page, SetCookie } from 'puppeteer'
import regexgen from 'regexgen'
import { logger } from './logger'

export const noNumberRegex = /\D/
export const numberRegex = /[0-9]/
export const currenyRegex = /[\$\xA2-\xA5\u058F\u060B\u09F2\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BD\uA838\uFDFC\uFE69\uFF04\uFFE0\uFFE1\uFFE5\uFFE6]/
export const priceExtractionRegex = /[+-]?\d+(\.\d+)?/g
export const isImageRegex = /\.(jpg|gif|png)$/

export const priceRegex = regexgen(['£15.40', '£25.00', '€10,00'])

export const formatDate = (date: string) => {
  let formattedDate
  // date = "Present", "2018", "Dec 2018"
  if (date === 'Present') {
    formattedDate = moment().format()
  } else {
    formattedDate = moment(date, 'MMMY').format()
  }

  return formattedDate
}

export const getDurationInDays = (
  formattedStartDate: string,
  formattedEndDate: string
) => {
  if (!formattedStartDate || !formattedEndDate) return null
  // +1 to include the start date
  return moment(formattedEndDate).diff(moment(formattedStartDate), 'days') + 1
}

export const getLocationFromText = async (text: string) => {
  // Text is something like: Amsterdam Oud-West, North Holland Province, Netherlands

  if (!text) return null

  const cleanText = text.replace(' Area', '').trim()

  const parts = cleanText.split(', ')

  let city = null
  let province = null
  let country = null

  if (parts.length === 3) {
    city = parts[0]
    province = parts[1]
    country = parts[2]
  }

  if (parts.length === 2) {
    city = parts[0]
    country = parts[1]
  }

  if (parts.length === 1) {
    city = parts[0]
  }

  return {
    city,
    province,
    country,
  }
}

export const getCleanText = async (text: string) => {
  const regexRemoveMultipleSpaces = / +/g
  const regexRemoveLineBreaks = /(\r\n\t|\n|\r\t)/gm

  if (!text) return null

  const cleanText = text
    .replace(regexRemoveLineBreaks, '')
    .replace(regexRemoveMultipleSpaces, ' ')
    .replace('...', '')
    .replace('See more', '')
    .replace('See less', '')
    .trim()

  return cleanText
}

export const getTextFromEl = async (
  page: Page,
  element: ElementHandle<any>
): Promise<string> => {
  return page.evaluate((el) => el.innerText, element)
}

export const getSrcFromEl = async (
  page: Page,
  element: ElementHandle<any>
): Promise<string> => {
  return page.evaluate((el) => el.src, element)
}

export const getHrefFromEl = async (
  page: Page,
  element: ElementHandle<any>
): Promise<string> => {
  return page.evaluate((el) => el.href, element)
}

export const getText = async (
  page: Page | ElementHandle<any>,
  selectors: string[] | string
) => {
  let el: ElementHandle<Element> | null = null

  if (typeof selectors === 'string') {
    el = await page.$(selectors)
  } else {
    for (const selector of selectors) {
      const found = await page.$(selector)
      if (found) {
        el = found
      }
    }
  }

  return el ? el?.evaluate((el) => el.textContent) : null
}

export const getSrc = async (
  page: ElementHandle<any>,
  selector: string
): Promise<string> => {
  const el = await page.$(selector)

  const url = await el?.evaluate((el) => el.getAttribute('src'))

  if (url?.indexOf('http') !== 0) {
    return `https:${url}`
  }
  return url
}

export const getHref = async (
  page: Page | ElementHandle<Element>,
  selector: string
) => {
  const el = await page.$(selector)

  if (el === null) {
    throw new Error(`Could not extract href from ${selector}`)
  }

  return el?.evaluate((el) => el.getAttribute('href'))
}

export const getImageUrl = async (
  page: ElementHandle<Element>,
  selector: string
) => {
  const el = await page.$(selector)

  let url: string | null

  const src = await el?.evaluate((el) => (el as any).src)

  url = src

  if (!src || src?.indexOf('data:image') !== -1) {
    const srcsets = await el?.evaluate((el) => (el as any).srcset?.split(', '))

    if (srcsets) {
      url = srcsets[srcsets.length - 1]
    } else {
      const dataSrcSets = await el?.evaluate((el) =>
        el?.getAttribute('data-srcset')?.split(', ')
      )

      if (dataSrcSets) {
        url = dataSrcSets[dataSrcSets.length - 1]
      } else {
        url = null
      }
    }
  }

  if (url === null) return url

  if (url?.indexOf('http') !== 0) {
    return `https:${url}`
  }
  return url
}

export const setupScraper = async ({
  cookie,
  headless = true,
}: {
  cookie?: SetCookie
  headless?: boolean
}) => {
  let page: Page
  let browser: Browser
  try {
    const blockedResources = [
      'image',
      'stylesheet',
      'media',
      'font',
      'texttrack',
      'object',
      'beacon',
      'csp_report',
      'imageset',
    ]

    // const ext = global.appRoot + '/ublock-chromium'
    // const datadir = global.appRoot + '/ublock-data'

    browser = await puppeteer.launch({
      headless,
      // userDataDir: datadir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        "--proxy-server='direct://",
        '--proxy-bypass-list=*',
        // `--load-extension=${ext}`,
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
      // '--no-sandbox', '--disable-setuid-sandbox' -> For the Heroku Buildpack: https://github.com/nguyenkaos/puppeteer-heroku-buildpack . More info: https://github.com/jontewks/puppeteer-heroku-buildpack/issues/24#issuecomment-421789066
      // "--proxy-server='direct://'", '--proxy-bypass-list=*' -> For speed improvements: https://github.com/GoogleChrome/puppeteer/issues/1718#issuecomment-424357709
    })

    page = await browser.newPage()

    // Block loading of resources, like images and css, we dont need that
    await page.setRequestInterception(true)

    page.on('request', (req) => {
      if (blockedResources.includes(req.resourceType())) {
        req.abort()
      } else {
        req.continue()
      }
    })

    // Speed improvement: https://github.com/GoogleChrome/puppeteer/issues/1718#issuecomment-425618798
    await page.setUserAgent(
      'Mozilla/5.0 ((Window as any)s NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
    )

    await page.setViewport({
      width: 1200,
      height: 720,
    })

    if (cookie) {
      await page.setCookie(cookie)
      logger('info', 'setup', `${cookie.name} Cookie Set`)
    }
  } catch (err) {
    throw new Error(err)
  }

  logger('info', 'setup', 'Done')

  return { page, browser }
}

export const autoScroll = async (page: Page) => {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0
      const distance = 500
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 100)
    })
  })
}

export const waitRndm = async (page: Page) => {
  const randomTime = Math.random() * 5

  await page.waitFor(randomTime)
}

export const getAllLinks = async (page: Page) => {
  const linkElements = await page.$$('*')

  let links: string[] = []

  for (const linkElement of linkElements) {
    const link = await linkElement.evaluate((el) => {
      const url = (el as any).href

      if (!(el.localName === 'a' && url)) {
        return null
      }

      if (!(url !== location.href)) {
        return null
      }

      if (!(new URL(location.toString())?.origin === new URL(url)?.origin)) {
        return null
      }

      return url
    })

    if (link) {
      links.push(link)
    }
  }

  return Array.from(new Set(links))
}

export const getBasePath = (url: string) => {
  const pathArray = url.split('/')
  return pathArray[0] + '//' + pathArray[2]
}
