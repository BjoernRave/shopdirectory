export interface ScrapedProduct {
  index: number
  price: number
  title: string
  imageUrl: string
  url: string
  currency: string
  probabilites?: {
    className: string
    probability: number
  }[]
}
