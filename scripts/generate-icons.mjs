import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const accent = '#2f7d63'
const cream = '#fbf8ef'

const mark = `
  <rect x="112" y="120" width="288" height="272" rx="60" fill="${cream}"/>
  <circle cx="192" cy="176" r="14" fill="${accent}"/>
  <circle cx="320" cy="176" r="14" fill="${accent}"/>
  <path d="M180 288 L236 344 L338 226" fill="none" stroke="${accent}"
    stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
`

const squareSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${accent}"/>
  ${mark}
</svg>`

const roundedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="116" fill="${accent}"/>
  ${mark}
</svg>`

await writeFile('public/favicon.svg', roundedSvg)

const source = Buffer.from(squareSvg)
await sharp(source).resize(192, 192).png().toFile('public/pwa-192x192.png')
await sharp(source).resize(512, 512).png().toFile('public/pwa-512x512.png')
await sharp(source).resize(512, 512).png().toFile('public/maskable-512x512.png')
await sharp(source).resize(180, 180).png().toFile('public/apple-touch-icon.png')

console.log('Icons generated in public/')
