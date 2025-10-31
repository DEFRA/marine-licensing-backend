export const requiredQueryParams = {
  ACTIVITY_TYPE: 'ACTIVITY_TYPE',
  ARTICLE: 'ARTICLE',
  pdfDownloadUrl: 'pdfDownloadUrl'
}

export const validActivitySubtypes = [
  'coastalProtectionDrainageOrFloodDefence',
  'crossrailAct',
  'deepseaMining',
  'defenceMiningCrossrail',
  'dredgedMaterial',
  'emergency',
  'fishing',
  'hullCleaning',
  'maintenance',
  'markersMooringsAidsToNavigation',
  'markersMooringsAndAidToNavigation',
  'miscellaneous',
  'navigationalDredging',
  'ObstructionsDanger',
  'pollutionResponse',
  'pontoons',
  'scientificResearch',
  'shellfish',
  'waste'
]

export const articleCodes = [
  '13',
  '17',
  '17A',
  '17B',
  '18A',
  '20',
  '21',
  '25',
  '25A',
  '26A',
  '34',
  '35'
]

const purposes = {
  shellfish: {
    article: '13',
    label: 'Shellfish propagation or cultivation'
  },
  scientificInstruments: {
    article: '17',
    label: 'Scientific instruments and associated equipment'
  },
  samples: { article: '17A', label: 'Samples for testing or analysis' },
  accidentalDeposits: { article: '17B', label: 'Accidental deposits' },
  navigationalDredging: { article: '18A', label: 'Navigational dredging' },
  floodRisk: { article: '20', label: 'Flood or flood risk' },
  deadAnimals: { article: '21', label: 'Dead animals' },
  moorings: { article: '25', label: 'Moorings or aids to navigation' },
  pontoons: { article: '25A', label: 'Pontoons' },
  marineSiteMarkers: {
    article: '26',
    label: 'Markers for European marine sites and conservation zones'
  },
  temporaryMarkers: { article: '26A', label: 'Temporary markers' },
  cablesPipelines: { article: '34', label: 'Cables and pipelines' },
  boredTunnels: { article: '35', label: 'Bored tunnels' }
}

export const activityTypes = {
  CON: {
    code: 'CON',
    label: 'Construction',
    purpose: [purposes.moorings, purposes.pontoons, purposes.boredTunnels]
  },
  DEPOSIT: {
    code: 'DEPOSIT',
    label: 'Deposit of a substance or object',
    purpose: [
      purposes.shellfish,
      purposes.scientificInstruments,
      purposes.floodRisk,
      purposes.moorings,
      purposes.pontoons,
      purposes.marineSiteMarkers,
      purposes.temporaryMarkers,
      purposes.cablesPipelines
    ]
  },
  REMOVAL: {
    code: 'REMOVAL',
    label: 'Removal of a substance or object',
    purpose: [
      purposes.shellfish,
      purposes.scientificInstruments,
      purposes.samples,
      purposes.accidentalDeposits,
      purposes.floodRisk,
      purposes.deadAnimals,
      purposes.moorings,
      purposes.pontoons,
      purposes.marineSiteMarkers,
      purposes.temporaryMarkers,
      purposes.cablesPipelines
    ]
  },
  DREDGE: {
    code: 'DREDGE',
    label: 'Dredging',
    purpose: [
      purposes.navigationalDredging,
      purposes.floodRisk,
      purposes.cablesPipelines
    ]
  },
  INCINERATION: {
    code: 'INCINERATION',
    label: 'Incineration of a substance or object',
    purpose: []
  },
  EXPLOSIVES: {
    code: 'EXPLOSIVES',
    label: 'Use of an explosive substance',
    purpose: []
  },
  SCUTTLING: {
    code: 'SCUTTLING',
    label: 'Sinking of a vessel or floating container',
    purpose: []
  }
}
