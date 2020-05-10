import { Page } from 'puppeteer'
import { autoScroll, getText } from '../../lib/utils'

export const paginateResults = async ({
  page,
  maxPages,
  callback,
  baseLink,
}: {
  page: Page
  callback: () => void
  maxPages?: number
  baseLink: string
}) => {
  await autoScroll(page)

  const pageNumber = Number(
    await getText(page, '.artdeco-pagination__pages li:last-child')
  )

  const pages = pageNumber < maxPages ? pageNumber : maxPages

  for (let i = 0; i < pages; i++) {
    await page.goto(`${baseLink}&page=${i}`)
    await page.waitForNavigation()

    await autoScroll(page)

    await callback()
  }
}
