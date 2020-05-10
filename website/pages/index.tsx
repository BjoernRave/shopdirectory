import { PrismaClient, Product } from '@prisma/client'
import { NextPage } from 'next'
import React from 'react'
import styled from 'styled-components'

const Wrapper = styled.div`
  display: grid;
  align-items: center;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  margin: 50px;
`

const ProductWrapper = styled.div`
  box-shadow: 3px 3px 10px gray;
  border-radius: 10px;
  padding: 10px;
  margin: 20px;
`

const ProductImage = styled.img`
  width: 100%;
  height: auto;
`

const Link = styled.a`
  text-decoration: none;
  color: black;
`

const ProductName = styled.span``

const ProductPrice = styled.span`
  font-weight: bold;
  font-size: 24px;
`

const ProductMeta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const Home: NextPage<Props> = ({ products }) => {
  return (
    <Wrapper>
      {products.map((product) => (
        <Link key={product.id} href={product.url} target='_blank'>
          <ProductWrapper>
            <ProductImage src={product.images[0]} />
            <ProductMeta>
              <ProductName>{product.name}</ProductName>
              <ProductPrice>{`${product.price} ${product.currency}`}</ProductPrice>
            </ProductMeta>
          </ProductWrapper>
        </Link>
      ))}
    </Wrapper>
  )
}

export default Home

export const getServerSideProps = async () => {
  const prisma = new PrismaClient()

  const products = await prisma.product.findMany()

  return {
    props: {
      products,
    },
  }
}

interface Props {
  products: Product[]
}
