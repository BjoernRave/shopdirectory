import * as fs from 'fs'
import {
  getHref,
  getHrefFromEl,
  getText,
  getTextFromEl,
  setupScraper,
  waitRndm,
} from '../../lib/utils'
import { paginateResults } from './helper'
import { checkIfLoggedIn } from './linkedin'

export const scrapeCompanies = async (searchTerms: string[]) => {
  const baseCompaniesLink = `https://www.linkedin.com/search/results/companies/?keywords=${searchTerms.join(
    ' '
  )}`

  const { page, browser } = await setupScraper({
    cookie: {
      name: 'li_at',
      value: process.env.LINKEDIN_SESSION_COOKIE_VALUE,
      domain: '.www.linkedin.com',
    },
  })

  await page.goto(baseCompaniesLink, {
    waitUntil: 'domcontentloaded',
  })

  const isLoggedIn = await checkIfLoggedIn(page)

  if (!isLoggedIn) {
    return new Error('Scraper not logged in into LinkedIn')
  }

  const resultListSelector = '.search-results__list'

  const resultWrapper = '.search-result__wrapper'

  await page.waitForSelector(resultListSelector)

  let companiesUrls = []
  await paginateResults({
    page,
    maxPages: 3,
    baseLink: baseCompaniesLink,
    callback: async () => {
      const links = await page.$$(`.search-result__info a[href*="/company"]`)

      for (let link of links) {
        const href = await getHrefFromEl(page, link)
        companiesUrls.push(href)
      }
    },
  })

  let companies = []
  for (let companyUrl of companiesUrls) {
    await page.goto(companyUrl)

    const leftInfoBox = '.org-top-card__left-col'

    await page.waitForSelector(leftInfoBox)

    const title = await getText(
      page,
      `${leftInfoBox} h1.org-top-card-summary__title`
    )

    const infoEls = await page.$$(
      `${leftInfoBox} .org-top-card-summary-info-list__info-item`
    )

    const category = await getTextFromEl(page, infoEls[0])

    const location = await getTextFromEl(page, infoEls[1])

    const follower = await getTextFromEl(page, infoEls[2])

    const employeesUrl = await getHref(
      page,
      'a[href*="/search/results/people"]'
    )

    await waitRndm(page)

    let employees = []
    await paginateResults({
      page,
      maxPages: 1,
      baseLink: employeesUrl,
      callback: async () => {
        const employeeBoxes = await page.$$(
          `${resultListSelector} ${resultWrapper}`
        )

        for (let employeeBox of employeeBoxes) {
          const name = await getText(employeeBox, `.actor-name`)

          const description = await getText(employeeBox, `.subline-level-1`)

          employees.push({ name, description })
        }
      },
    })

    companies.push({ title, category, location, follower, employees })
  }

  fs.writeFileSync('./companies.json', JSON.stringify(companies))

  await browser.close()
}
