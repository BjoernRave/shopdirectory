import {
  main,
  openDataset,
  openRequestList,
  openRequestQueue,
  PuppeteerCrawler,
  utils,
} from 'apify'
import chalk from 'chalk'
import { logger } from './lib/logger'
import { getBasePath } from './lib/utils'
import { extractData, identifyContainer } from './webshopScraper'

const websites = [
  'https://www.boohoo.com/',
  'https://www.friendorfaux.com/',
  'https://www.harempants.com/',
]

main(async () => {
  const requestQueue = await openRequestQueue()
  const requestList = await openRequestList('baseUrls', websites)

  const dataset = await openDataset('scraped-products')

  const crawler = new PuppeteerCrawler({
    requestList,
    requestQueue,
    maxRequestsPerCrawl: 100,
    maxConcurrency: 10,
    handlePageFunction: async ({ page, request }) => {
      console.log(' ')

      logger('info', 'init', `Scraping: ${chalk.magenta(request.url)}`)

      const container = await identifyContainer(page)

      if (container) {
        const extractedData = await extractData(
          getBasePath(request.url),
          container
        )

        await dataset.pushData(extractedData)
      }

      await utils.enqueueLinks({
        page,
        selector: 'a',
        requestQueue,
      })
    },
  })

  await crawler.run()
})
