import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function toCamelCase(str) {
  return str
    .split(/\s+/)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('')
}

const geoJSONPath = join(__dirname, 'Marine_Areas.geojson')
console.log(`Reading GeoJSON from: ${geoJSONPath}`)

let geoJSON = JSON.parse(readFileSync(geoJSONPath, 'utf8'))

// Fix missing FeatureCollection type if needed
if (!geoJSON.type && geoJSON.features) {
  geoJSON = {
    type: 'FeatureCollection',
    features: geoJSON.features
  }
}

const documents = []

geoJSON.features.forEach((feature) => {
  const baseName = toCamelCase(feature.properties.name)

  // If it's a MultiPolygon, split it into individual Polygons
  if (feature.geometry.type === 'MultiPolygon') {
    feature.geometry.coordinates.forEach((polygonCoords, index) => {
      documents.push({
        name: `${baseName}_${index + 1}`,
        info: feature.properties.info,
        geometry: {
          type: 'Polygon',
          coordinates: polygonCoords
        },
        properties: feature.properties,
        originalType: 'MultiPolygon',
        partIndex: index + 1
      })
    })
  } else {
    // Keep Polygons as-is
    documents.push({
      name: baseName,
      info: feature.properties.info,
      geometry: feature.geometry,
      properties: feature.properties
    })
  }
})

const outputPath = join(__dirname, 'marine-areas-import.json')
writeFileSync(outputPath, JSON.stringify(documents, null, 2))

console.log(`✅ Generated ${documents.length} documents`)
console.log(`📁 Saved to: ${outputPath}`)
console.log(`\n📋 Next steps:`)
console.log(`1. Open MongoDB Compass`)
console.log(`2. Connect to your database`)
console.log(`3. Navigate to your marine areas collection`)
console.log(`4. Click "ADD DATA" → "Import JSON or CSV file"`)
console.log(`5. Select: ${outputPath}`)
console.log(`6. After import, create 2dsphere index:`)
console.log(
  `   db.getCollection("your-collection-name").createIndex({ geometry: "2dsphere" })`
)
