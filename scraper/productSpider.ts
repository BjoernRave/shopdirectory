import { PrismaClient } from '@prisma/client'
import chalk from 'chalk'
import { ScrapedProduct } from 'lib/types'
import { logger } from './lib/logger'
import { getAllLinks, getBasePath, setupScraper } from './lib/utils'
import { extractData, identifyContainer } from './webshopScraper'

const prisma = new PrismaClient()

export const spider = async () => {
  const { page, browser } = await setupScraper({})

  const websites = [
    'https://www.boohoo.com/womens/new-in',
    'https://www.friendorfaux.com/collections/new-arrivals',
    'https://www.harempants.com/collections/mens',
  ]

  for (let websiteUrl of websites) {
    const website = await prisma.website.create({
      data: { url: websiteUrl, scraped: false },
    })
    let links = [{ url: websiteUrl, scraped: false }]

    while (links.filter((link) => !link.scraped).length > 0) {
      const newURl = links.filter((link) => !link.scraped)[0].url

      await page.goto(newURl)
      console.log(' ')

      logger('info', 'init', `Scraping: ${chalk.magenta(newURl)}`)

      const container = await identifyContainer(page)

      let extractedData: ScrapedProduct[]

      if (container) {
        extractedData = await extractData(getBasePath(websiteUrl), container)

        extractedData.forEach((entry) =>
          links.push({ url: entry.url, scraped: true })
        )
      }

      links[links.findIndex((link) => link.url === newURl)].scraped = true

      const newLinks = await getAllLinks(page)

      newLinks
        .filter(
          (link) => !links.map((innerLink) => innerLink.url).includes(link)
        )
        .forEach((link) => links.push({ url: link, scraped: false }))

      await prisma.page.create({
        data: {
          website: { connect: { id: website.id } },
          scraped: true,
          url: newURl,
        },
      })
    }
  }

  browser.close()
}

spider()
