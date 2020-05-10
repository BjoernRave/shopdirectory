import chalk from 'chalk'
import { ElementHandle, Page } from 'puppeteer'
import { logger } from './lib/logger'
import { ScrapedProduct } from './lib/types'
import {
  currenyRegex,
  getHref,
  getImageUrl,
  getText,
  priceExtractionRegex,
} from './lib/utils'

const containerTypes = ['ul', 'div', 'ol']

const containerNames = [
  'list',
  'products',
  'items',
  'product-grid',
  'product-list',
  'product-grid-list',
  'products-grid',
  'search-result-items',
]

const itemNames = ['item', 'product_card', 'product', 'product_box', 'product']

const itemTypes = ['li', 'div']

const itemAttributes = ['data-product-id', 'data-product-tile']

export const checkContainers = async (
  containers: ElementHandle<Element>[],
  stage: string
) => {
  if (containers.length === 0) {
    logger('error', stage, 'Container not identified')

    return null
  }

  if (containers.length === 1) {
    logger('info', stage, chalk.green('Container identified'))

    return containers[0]
  } else {
    logger('info', stage, `${containers.length} containers`)
    return undefined
  }
}

const checkChildren = async (
  containers: ElementHandle<Element>[],
  evaluator: (el: ElementHandle<Element>) => Promise<boolean>
) => {
  let filteredContainer: ElementHandle<Element>[] = []

  for (let container of containers) {
    const isTrue = await evaluator(container)

    if (isTrue) {
      filteredContainer.push(container)
    }
  }
  return filteredContainer
}

export const identifyContainer = async (page: Page) => {
  const containers = await page.$$(
    containerTypes
      .map((type) =>
        containerNames.map((name) => [
          `${type}[class*="${name}"]`,
          `${type}[id*="${name}"]`,
        ])
      )
      .flat(2)
      .join(', ')
  )

  const container1 = await checkContainers(containers, 'init')

  if (container1) return container1

  if (container1 === null) return null

  const filteredForImage = await checkChildren(containers, (container) =>
    container.evaluate((el) => {
      const children = Array.from(el.querySelectorAll('*'))

      const hasImage = children.some(
        (node) => node.nodeName.toLowerCase() === 'img'
      )

      const hasPrice = children.some(
        (node) =>
          node?.textContent?.indexOf('€') !== -1 ||
          node?.textContent?.indexOf('£') !== -1 ||
          node?.textContent?.indexOf('$') !== -1
      )

      return hasPrice && hasImage
    })
  )

  const container2 = await checkContainers(
    filteredForImage,
    'after image/price filter'
  )

  if (container2) return container2

  if (container2 === null) return null

  const filteredForType = await checkChildren(filteredForImage, (container) =>
    container.evaluate((el) => {
      const children = Array.from(el.children)

      const itemTypes = ['li', 'div']

      return itemTypes.some((itemName) =>
        children.every((innerEl) => innerEl.nodeName.toLowerCase() === itemName)
      )
    })
  )

  const container3 = await checkContainers(
    filteredForType,
    'after childType filter'
  )

  if (container3) return container3

  if (container3 === null) return null

  const filteredForName = await checkChildren(filteredForType, (container) =>
    container.evaluate((el) => {
      const children = Array.from(el.children)

      const itemNames = [
        'item',
        'product_card',
        'product',
        'product_box',
        'product',
      ]

      return itemNames.some((itemName) => {
        return children.every((innerEl) => {
          return (
            innerEl.className.toLowerCase().indexOf(itemName) !== -1 ||
            innerEl.id.toLowerCase().indexOf(itemName) !== -1
          )
        })
      })
    })
  )

  const container4 = await checkContainers(
    filteredForName,
    'after childName filter'
  )

  if (container4) return container4

  if (container4 === null) return null
}

const titleNames = ['[class*="title"]', '[class*="name"]']

export const extractData = async (
  websiteBase: string,
  container: ElementHandle<Element>
) => {
  const products = await container.$$(':scope > *')

  const scrapedProducts: ScrapedProduct[] = []

  for (let [index, product] of products.entries()) {
    const title = await getText(product, titleNames)

    const priceString = await getText(product, '[class*="price"]')
    const price = parseFloat(priceString.match(priceExtractionRegex)[0])
    const currency = priceString.match(currenyRegex)[0]

    const imageUrl = await getImageUrl(product, 'img')

    const url = await getHref(product, 'a')

    if (title && priceString && price && currency && imageUrl && url) {
      scrapedProducts.push({
        index,
        price,
        title,
        imageUrl,
        url: websiteBase + url,
        currency,
      })
    }
  }
  logger(
    'info',
    'extracted data from ',
    chalk.greenBright(`${scrapedProducts.length} Products`)
  )
  return scrapedProducts
}
