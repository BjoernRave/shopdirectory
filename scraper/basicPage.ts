import { PrismaClient } from '@prisma/client'
import { classifyImageFromUrl } from './lib/classify'
import {
  currenyRegex,
  getHref,
  getSrc,
  getText,
  priceExtractionRegex,
  setupScraper,
} from './lib/utils'

export const scrapeFriendsorFaux = async () => {
  const { page, browser } = await setupScraper({})

  await page.goto('https://www.friendorfaux.com/collections/t-shirts')

  const container = '[id*="products"] > *'

  await page.waitForSelector(container)

  const products = await page.$$(container)

  const scrapedProducts = []

  for (let [index, product] of products.entries()) {
    const title = await getText(product, '[class*="title"]')

    const priceString = await getText(product, '[class*="price"]')
    const price = parseFloat(priceString?.match(priceExtractionRegex)[0])
    const currency = priceString?.match(currenyRegex)[0]

    const imageUrl = await getSrc(product, '[class*="image"] img')

    const url = await getHref(product, 'a')

    scrapedProducts.push({ index, price, title, imageUrl, url, currency })
  }
  await browser.close()

  const prisma = new PrismaClient()

  for (let product of scrapedProducts) {
    console.log(`Classifying ${product.title}`)

    if (product.imageUrl) {
      console.log(product.imageUrl)
      let probabilites

      try {
        probabilites = await classifyImageFromUrl(product.imageUrl)
      } catch (error) {
        console.log(error)
      }

      product = { ...product, ...(probabilites && { probabilites }) }
    }
    try {
      await prisma.product.create({
        data: {
          ...(product.probabilites &&
            product.probabilites.length > 0 && {
              probabilities: {
                create: product.probabilites.map(
                  ({ className, probability }) => ({
                    className,
                    value: probability,
                  })
                ),
              },
            }),
          ...(product.currency && { currency: product.currency }),
          name: product.title,
          price: product.price,
          url: product.url,
          ...(product.imageUrl && { images: { set: [product.imageUrl] } }),
        },
      })
    } catch (error) {
      console.log(error)
    }
  }
}
