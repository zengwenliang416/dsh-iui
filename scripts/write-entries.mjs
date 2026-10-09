import { writeFileSync, mkdirSync } from 'node:fs'
mkdirSync('lib/host', { recursive: true })
mkdirSync('lib/client', { recursive: true })
writeFileSync('lib/host/index.js', "export * from './bundle.js'\n")
writeFileSync('lib/client/index.js', "export * from './bundle.js'\n")
writeFileSync('lib/index.js', "export * from './host/bundle.js'\nexport * from './client/bundle.js'\n")
