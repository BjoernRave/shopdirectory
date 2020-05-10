import * as fs from 'fs'
import { getTextFromEl, setupScraper } from '../../lib/utils'

export const getLinkedinCategories = async () => {
  const { page, browser } = await setupScraper({})

  await page.goto('https://www.aidantaylor.com/mktg/linkedin-industry-list/')

  const categoriesEL = await page.$$(`tbody td`)

  let categories = []

  for (let categoryEl of categoriesEL) {
    const name = await getTextFromEl(page, categoryEl)

    categories.push(
      name.replace('(Aidan Taylor Marketing Competency)', '').trim()
    )
  }
  fs.writeFileSync('./linkedincategories.json', JSON.stringify(categories))
  await browser.close()
}
