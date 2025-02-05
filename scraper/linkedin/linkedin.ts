import { Page } from 'puppeteer'
import { autoScroll, setupScraper } from '../../lib/utils'

require('dotenv').config()
const {
  getDurationInDays,
  formatDate,
  getCleanText,
  getLocationFromText,
} = require('../utils')

const statusLog = async (section, message, scraperSessionId) => {
  const sessionPart = scraperSessionId ? ` (${scraperSessionId})` : ''
  const messagePart = message ? `: ${message}` : null
  return console.log(`Scraper (${section})${sessionPart}${messagePart}`)
}
export const checkIfLoggedIn = async (page) => {
  const isLoggedIn = (await page.$('#login-email')) === null

  return isLoggedIn
}

export const scrapeLinkedinProfile = async (profileUrl: string) => {
  const { page, browser } = await setupScraper({
    cookie: {
      name: 'li_at',
      value: process.env.LINKEDIN_SESSION_COOKIE_VALUE,
      domain: '.www.linkedin.com',
    },
  })

  await page.goto('https://linkedin.com')

  const isLoggedIn = await checkIfLoggedIn(page)

  if (!isLoggedIn) {
    return new Error('Scraper not logged in into LinkedIn')
  }

  // await page.exposeFunction('getCleanText', getCleanText)
  // await page.exposeFunction('formatDate', formatDate)
  // await page.exposeFunction('getDurationInDays', getDurationInDays)
  // await page.exposeFunction('getLocationFromText', getLocationFromText)

  const profile = await getLinkedinProfileDetails(page, profileUrl)
  console.log(JSON.stringify(profile))

  await browser.close()
}

const getLinkedinProfileDetails = async (page: Page, profileUrl: string) => {
  const logSection = 'scraping'

  const scraperSessionId = new Date().getTime()

  statusLog(
    logSection,
    `Navigating to LinkedIn profile: ${profileUrl}`,
    scraperSessionId
  )

  await page.goto(profileUrl, {
    waitUntil: 'domcontentloaded',
  })

  statusLog(logSection, 'LinkedIn profile page loaded!', scraperSessionId)

  // TODO: first check if the needed selectors are present on the page, or else we need to update it in this script
  // TODO: notifier should be build if LinkedIn changes their selectors

  statusLog(
    logSection,
    'Getting all the LinkedIn profile data by scrolling the page to the bottom, so all the data gets loaded into the page...',
    scraperSessionId
  )

  await autoScroll(page)

  statusLog(logSection, 'Parsing data...', scraperSessionId)

  // Only click the expanding buttons when they exist
  const expandButtonsSelectors = [
    '.pv-profile-section.pv-about-section .lt-line-clamp__more', // About
    '#experience-section .pv-profile-section__see-more-inline.link', // Experience
    '.pv-profile-section.education-section button.pv-profile-section__see-more-inline', // Education
    '.pv-skill-categories-section [data-control-name="skill_details"]', // Skills
  ]

  const seeMoreButtonsSelectors = [
    '.pv-entity__description .lt-line-clamp__line.lt-line-clamp__line--last .lt-line-clamp__more[href="#"]',
    '.lt-line-clamp__more[href="#"]:not(.lt-line-clamp__ellipsis--dummy)',
  ]

  statusLog(
    logSection,
    'Expanding all sections by clicking their "See more" buttons',
    scraperSessionId
  )

  for (const buttonSelector of expandButtonsSelectors) {
    if ((await page.$(buttonSelector)) !== null) {
      statusLog(
        logSection,
        `Clicking button ${buttonSelector}`,
        scraperSessionId
      )
      await page.click(buttonSelector)
    }
  }

  // To give a little room to let data appear. Setting this to 0 might result in "Node is detached from document" errors
  await page.waitFor(100)

  statusLog(
    logSection,
    'Expanding all descriptions by clicking their "See more" buttons',
    scraperSessionId
  )

  for (const seeMoreButtonSelector of seeMoreButtonsSelectors) {
    const buttons = await page.$$(seeMoreButtonSelector)

    for (const button of buttons) {
      if (button) {
        statusLog(
          logSection,
          `Clicking button ${seeMoreButtonSelector}`,
          scraperSessionId
        )
        await button.click()
      }
    }
  }

  // TODO: check if we need to expand experience, education and skills AGAIN (for the rest of the data)

  // Converting the complete string to a document, so we can querySelector into it instead of using Puppeteer
  // TODO: we can also close this thread now so puppeteer can crawl other profiles, resulting on more pages per minute we can crawl
  // const html = await page.content()
  // const dom = new JSDOM(html);
  // console.log(dom.document.querySelector('.pv-entity__description').textContent)

  statusLog(logSection, 'Parsing profile data...', scraperSessionId)

  const userProfile = await page.evaluate(async () => {
    const profileSection = document.querySelector('.pv-top-card')

    const url = (window as any).location.href

    const fullNameElement = profileSection.querySelector(
      '.pv-top-card--list li:first-child'
    )
    const fullName =
      fullNameElement && fullNameElement.textContent
        ? await getCleanText(fullNameElement.textContent)
        : null

    const titleElement = profileSection.querySelector('h2')
    const title =
      titleElement && titleElement.textContent
        ? await getCleanText(titleElement.textContent)
        : null

    const locationElement = profileSection.querySelector(
      '.pv-top-card--list.pv-top-card--list-bullet.mt1 li:first-child'
    )
    const locationText =
      locationElement && locationElement.textContent
        ? await getCleanText(locationElement.textContent)
        : null
    const location = await getLocationFromText(locationText)

    const photoElement =
      profileSection.querySelector('.pv-top-card__photo') ||
      profileSection.querySelector('.profile-photo-edit__preview')
    const photo =
      photoElement && photoElement.getAttribute('src')
        ? photoElement.getAttribute('src')
        : null

    const descriptionElement = document.querySelector(
      '.pv-about__summary-text .lt-line-clamp__raw-line'
    ) // Is outside "profileSection"
    const description =
      descriptionElement && descriptionElement.textContent
        ? await getCleanText(descriptionElement.textContent)
        : null

    return {
      fullName,
      title,
      location,
      photo,
      description,
      url,
    }
  })

  statusLog(
    logSection,
    `Got user profile data: ${JSON.stringify(userProfile)}`,
    scraperSessionId
  )

  statusLog(logSection, `Parsing experiences data...`, scraperSessionId)

  const experiences = await page.$$eval(
    '#experience-section ul > .ember-view',
    async (nodes) => {
      let data = []

      // Using a for loop so we can use await inside of it
      for (const node of nodes) {
        const titleElement = node.querySelector('h3')
        const title =
          titleElement && titleElement.textContent
            ? await getCleanText(titleElement.textContent)
            : null

        const companyElement = node.querySelector('.pv-entity__secondary-title')
        const company =
          companyElement && companyElement.textContent
            ? await getCleanText(companyElement.textContent)
            : null

        const descriptionElement = node.querySelector('.pv-entity__description')
        const description =
          descriptionElement && descriptionElement.textContent
            ? await getCleanText(descriptionElement.textContent)
            : null

        const dateRangeElement = node.querySelector(
          '.pv-entity__date-range span:nth-child(2)'
        )
        const dateRangeText =
          dateRangeElement && dateRangeElement.textContent
            ? await getCleanText(dateRangeElement.textContent)
            : null

        const startDatePart = dateRangeText
          ? await getCleanText(dateRangeText.split('–')[0])
          : null
        const startDate = startDatePart ? await formatDate(startDatePart) : null

        const endDatePart = dateRangeText
          ? await getCleanText(dateRangeText.split('–')[1])
          : null
        const endDateIsPresent = endDatePart
          ? endDatePart.trim().toLowerCase() === 'present'
          : false
        const endDate =
          endDatePart && !endDateIsPresent
            ? await formatDate(endDatePart)
            : null

        const durationInDaysWithEndDate =
          startDate && endDate && !endDateIsPresent
            ? await getDurationInDays(startDate, endDate)
            : null
        const durationInDaysForPresentDate = endDateIsPresent
          ? await getDurationInDays(startDate, new Date())
          : null
        const durationInDays = endDateIsPresent
          ? durationInDaysForPresentDate
          : durationInDaysWithEndDate

        const locationElement = node.querySelector(
          '.pv-entity__location span:nth-child(2)'
        )
        const locationText =
          locationElement && locationElement.textContent
            ? await getCleanText(locationElement.textContent)
            : null
        const location = await getLocationFromText(locationText)

        data.push({
          title,
          company,
          location,
          startDate,
          endDate,
          endDateIsPresent,
          durationInDays,
          description,
        })
      }

      return data
    }
  )

  statusLog(
    logSection,
    `Got experiences data: ${JSON.stringify(experiences)}`,
    scraperSessionId
  )

  statusLog(logSection, `Parsing education data...`, scraperSessionId)

  const education = await page.$$eval(
    '#education-section ul > .ember-view',
    async (nodes) => {
      // Note: the $$eval context is the browser context.
      // So custom methods you define in this file are not available within this $$eval.
      let data = []
      for (const node of nodes) {
        const schoolNameElement = node.querySelector(
          'h3.pv-entity__school-name'
        )
        const schoolName =
          schoolNameElement && schoolNameElement.textContent
            ? await getCleanText(schoolNameElement.textContent)
            : null

        const degreeNameElement = node.querySelector(
          '.pv-entity__degree-name .pv-entity__comma-item'
        )
        const degreeName =
          degreeNameElement && degreeNameElement.textContent
            ? await getCleanText(degreeNameElement.textContent)
            : null

        const fieldOfStudyElement = node.querySelector(
          '.pv-entity__fos .pv-entity__comma-item'
        )
        const fieldOfStudy =
          fieldOfStudyElement && fieldOfStudyElement.textContent
            ? await getCleanText(fieldOfStudyElement.textContent)
            : null

        const gradeElement = node.querySelector(
          '.pv-entity__grade .pv-entity__comma-item'
        )
        const grade =
          gradeElement && gradeElement.textContent
            ? await getCleanText(fieldOfStudyElement.textContent)
            : null

        const dateRangeElement = node.querySelectorAll('.pv-entity__dates time')

        const startDatePart =
          dateRangeElement &&
          dateRangeElement[0] &&
          dateRangeElement[0].textContent
            ? await getCleanText(dateRangeElement[0].textContent)
            : null
        const startDate = startDatePart ? await formatDate(startDatePart) : null

        const endDatePart =
          dateRangeElement &&
          dateRangeElement[1] &&
          dateRangeElement[1].textContent
            ? await getCleanText(dateRangeElement[1].textContent)
            : null
        const endDate = endDatePart ? await formatDate(endDatePart) : null

        const durationInDays =
          startDate && endDate
            ? await getDurationInDays(startDate, endDate)
            : null

        data.push({
          schoolName,
          degreeName,
          fieldOfStudy,
          startDate,
          endDate,
          durationInDays,
        })
      }

      return data
    }
  )

  statusLog(
    logSection,
    `Got education data: ${JSON.stringify(education)}`,
    scraperSessionId
  )

  statusLog(logSection, `Parsing skills data...`, scraperSessionId)

  const skills = await page.$$eval(
    '.pv-skill-categories-section ol > .ember-view',
    (nodes) => {
      // Note: the $$eval context is the browser context.
      // So custom methods you define in this file are not available within this $$eval.

      return nodes.map((node) => {
        const skillName = node.querySelector(
          '.pv-skill-category-entity__name-text'
        )
        const endorsementCount = node.querySelector(
          '.pv-skill-category-entity__endorsement-count'
        )

        return {
          skillName: skillName ? skillName.textContent.trim() : null,
          endorsementCount: endorsementCount
            ? parseInt(endorsementCount.textContent.trim())
            : 0,
        }
      })
    }
  )

  statusLog(
    logSection,
    `Got skills data: ${JSON.stringify(skills)}`,
    scraperSessionId
  )

  statusLog(
    logSection,
    `Done! Returned profile details for: ${profileUrl}`,
    scraperSessionId
  )

  return {
    userProfile,
    experiences,
    education,
    skills,
  }
}
