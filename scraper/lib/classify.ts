import * as mobilenet from '@tensorflow-models/mobilenet'
import { Tensor3D } from '@tensorflow/tfjs'
import * as tfnode from '@tensorflow/tfjs-node'
import fs from 'fs'
import request from 'request-promise'

const loadImageFromUrl = (url: string): Promise<Buffer> => {
  return request(url, { encoding: null }) as any
}

const readImage = (path: string) => {
  const imageBuffer = fs.readFileSync(path)
  const tfImage = tfnode.node.decodeImage(imageBuffer)
  return tfImage
}

export const classifyImage = async (buffer: Buffer) => {
  const image = tfnode.node.decodeImage(buffer)

  const mobileNetModel = await mobilenet.load()
  const predictions = await mobileNetModel.classify(image as Tensor3D)
  return predictions
}

export const classifyImageFromUrl = async (url: string) => {
  const imageBuffer = await loadImageFromUrl(url)

  return classifyImage(imageBuffer)
}
