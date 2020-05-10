import { setupScraper, waitRndm } from '../../lib/utils'
import { paginateResults } from './helper'

export const getConnections = async (searchTerms: string[]) => {
  const basePeopleLink = `https://www.linkedin.com/search/results/people/?keywords=${searchTerms.join(
    ' '
  )}`

  const { browser, page } = await setupScraper({
    cookie: {
      name: 'li_at',
      value: process.env.LINKEDIN_SESSION_COOKIE_VALUE,
      domain: '.www.linkedin.com',
    },
    headless: false,
  })

  await page.goto(basePeopleLink)

  await paginateResults({
    page,
    maxPages: 3,
    baseLink: basePeopleLink,
    callback: async () => {
      const connectButtons = await page.$$('[aria-label*="Connect with"]')

      for (let btn of connectButtons) {
        btn.click()

        await waitRndm(page)

        const confirmSend = await page.$('[aria-label="Send now"]')

        if (confirmSend) {
          await waitRndm(page)

          confirmSend.click()
        }
      }
    },
  })

  await browser.close()
}
