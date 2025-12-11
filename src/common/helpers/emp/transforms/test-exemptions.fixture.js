export const testExemptions = [
  {
    dbRecord: {
      _id: '69020200af9bd9354c7d3575',
      projectName: 'File upload - KML',
      createdBy: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      createdAt: '2025-10-29T12:01:04.693Z',
      updatedBy: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      updatedAt: '2025-10-29T12:11:46.333Z',
      status: 'ACTIVE',
      contactId: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      mcmsContext: {
        activity: {
          code: 'DEPOSIT',
          label: 'Deposit of a substance or object',
          purpose: 'Scientific instruments and associated equipment',
          subType: 'scientificResearch'
        },
        articleCode: '17',
        pdfDownloadUrl:
          'https://marinelicensingtest.marinemanagement.org.uk/mmofox5uat/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f'
      },
      organisation: {
        id: '7cc92559-c39f-449d-98b0-cc6057b34bcc',
        name: 'Test Company',
        userRelationshipType: 'Employee'
      },
      multipleSiteDetails: {
        multipleSitesEnabled: false
      },
      siteDetails: [
        {
          coordinatesType: 'file',
          activityDates: {
            start: '2026-10-01T00:00:00.000Z',
            end: '2026-11-01T00:00:00.000Z'
          },
          activityDescription:
            'Collect a 0.1 cubic metre seabed sample by day grab from a workboat for particle size analysis',
          fileUploadType: 'kml',
          geoJSON: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    [
                      [-2.432477106050502, 50.59693819063759, 0],
                      [-2.432820607861697, 50.59660089761306, 0],
                      [-2.433162249385978, 50.59615168906067, 0],
                      [-2.433503617704271, 50.59570283172726, 0],
                      [-2.433495164944779, 50.59514302522575, 0],
                      [-2.433488408058219, 50.59469557630374, 0],
                      [-2.432615993474494, 50.59447352794986, 0],
                      [-2.432093021608731, 50.59436268923199, 0],
                      [-2.431396385086173, 50.59425217712862, 0],
                      [-2.430699887810009, 50.59414168776472, 0],
                      [-2.429829794327116, 50.59403151712687, 0],
                      [-2.429132336871807, 50.59380939805938, 0],
                      [-2.428437526780005, 50.59381061779619, 0],
                      [-2.427744948713778, 50.59403517521042, 0],
                      [-2.427400718212715, 50.59437096593417, 0],
                      [-2.427406117535603, 50.59493000488292, 0],
                      [-2.427410441065787, 50.5953776353171, 0],
                      [-2.427240754500448, 50.59582593020374, 0],
                      [-2.427071981784945, 50.59638671085902, 0],
                      [-2.427077225794202, 50.59694772542507, 0],
                      [-2.427776213150947, 50.59717104467807, 0],
                      [-2.428647333211504, 50.59716950809774, 0],
                      [-2.429865577495705, 50.59705508344542, 0],
                      [-2.432304488335521, 50.59705077644811, 0],
                      [-2.432477106050502, 50.59693819063759, 0]
                    ]
                  ]
                },
                properties: {
                  name: 'Marine',
                  styleUrl: '#m_ylw-pushpin',
                  'icon-scale': 1.1,
                  'icon-offset': [20, 2],
                  'icon-offset-units': ['pixels', 'pixels'],
                  icon: 'https://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png'
                }
              }
            ]
          },
          featureCount: 1,
          uploadedFile: {
            filename: 'Marine.kml'
          },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key:
              'exemptions/059908e4-e546-4d41-ac14-4025cdc66ce5/873a486e-c1e0-4554-b6d1-77157de9f680',
            checksumSha256: 'mleqOl/4WZVN3Kz6Bz23pqwPON1kPNUg0Z1KpPD9eOM='
          }
        }
      ],
      publicRegister: {
        reason: null,
        consent: 'yes'
      },
      applicationReference: 'EXE/2025/10158',
      submittedAt: '2025-10-29T12:11:46.373Z'
    },
    expected: {
      attributes: {
        CaseReference: 'EXE/2025/10158',
        ApplicationTy: 'Exemption notification',
        ApplicantID: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
        ApplicantName: 'Test Applicant',
        ApplicantOrg: 'Test Company',
        ClientOrgID: '7cc92559-c39f-449d-98b0-cc6057b34bcc',
        ClientOrgName: 'Test Company',
        Project: 'File upload - KML',
        ActivityTy: 'Deposit of a substance or object',
        SubActTy: 'Scientific instruments and associated equipment',
        ArticleNo: '17',
        IAT_URL:
          'https://marinelicensingtest.marinemanagement.org.uk/mmofox5uat/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f',
        ProjStartDate: '2026-10-01',
        ProjEndDate: '2026-11-01',
        Status: '',
        SubDate: '2025-10-29',
        PubConsent: '0',
        Exemptions_URL:
          'http://localhost:3000/exemption/view-public-details/69020200af9bd9354c7d3575'
      },
      geometry: {
        rings: [
          [
            [-2.432477106050502, 50.59693819063759, 0],
            [-2.432304488335521, 50.59705077644811, 0],
            [-2.429865577495705, 50.59705508344542, 0],
            [-2.428647333211504, 50.59716950809774, 0],
            [-2.427776213150947, 50.59717104467807, 0],
            [-2.427077225794202, 50.59694772542507, 0],
            [-2.427071981784945, 50.59638671085902, 0],
            [-2.427240754500448, 50.59582593020374, 0],
            [-2.427410441065787, 50.5953776353171, 0],
            [-2.427406117535603, 50.59493000488292, 0],
            [-2.427400718212715, 50.59437096593417, 0],
            [-2.427744948713778, 50.59403517521042, 0],
            [-2.428437526780005, 50.59381061779619, 0],
            [-2.429132336871807, 50.59380939805938, 0],
            [-2.429829794327116, 50.59403151712687, 0],
            [-2.430699887810009, 50.59414168776472, 0],
            [-2.431396385086173, 50.59425217712862, 0],
            [-2.432093021608731, 50.59436268923199, 0],
            [-2.432615993474494, 50.59447352794986, 0],
            [-2.433488408058219, 50.59469557630374, 0],
            [-2.433495164944779, 50.59514302522575, 0],
            [-2.433503617704271, 50.59570283172726, 0],
            [-2.433162249385978, 50.59615168906067, 0],
            [-2.432820607861697, 50.59660089761306, 0],
            [-2.432477106050502, 50.59693819063759, 0]
          ]
        ],
        spatialReference: {
          wkid: 4326
        }
      }
    }
  },
  {
    dbRecord: {
      _id: '690204a0af9bd9354c7d3578',
      projectName: 'Manual - polygons',
      createdBy: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      createdAt: '2025-10-29T12:12:16.243Z',
      updatedBy: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      updatedAt: '2025-10-29T12:29:10.365Z',
      status: 'ACTIVE',
      contactId: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      mcmsContext: null,
      organisation: {
        id: '7cc92559-c39f-449d-98b0-cc6057b34bcc',
        name: 'Test Company',
        userRelationshipType: 'Employee'
      },
      multipleSiteDetails: {
        multipleSitesEnabled: true,
        sameActivityDates: 'yes',
        sameActivityDescription: 'yes'
      },
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          siteName: 'Site 1',
          activityDates: {
            start: '2026-10-01T00:00:00.000Z',
            end: '2026-11-01T00:00:00.000Z'
          },
          activityDescription: 'desc',
          coordinatesEntry: 'multiple',
          coordinateSystem: 'wgs84',
          coordinates: [
            {
              latitude: '50.696698',
              longitude: '-1.982385'
            },
            {
              latitude: '50.698190',
              longitude: '-1.980264'
            },
            {
              latitude: '50.699503',
              longitude: '-1.985637'
            },
            {
              latitude: '50.698048',
              longitude: '-1.988771'
            }
          ]
        },
        {
          coordinatesType: 'coordinates',
          siteName: 'Site 2',
          activityDates: {
            start: '2026-10-01T00:00:00.000Z',
            end: '2026-11-01T00:00:00.000Z'
          },
          activityDescription: 'desc',
          coordinatesEntry: 'multiple',
          coordinateSystem: 'osgb36',
          coordinates: [
            {
              eastings: '402265',
              northings: '187084'
            },
            {
              eastings: '402260',
              northings: '186891'
            },
            {
              eastings: '402255',
              northings: '186878'
            }
          ]
        }
      ],
      publicRegister: {
        reason: null,
        consent: 'yes'
      },
      applicationReference: 'EXE/2025/10159',
      submittedAt: '2025-10-29T12:29:10.394Z'
    },
    expected: {
      attributes: {
        CaseReference: 'EXE/2025/10159',
        ApplicationTy: 'Exemption notification',
        ApplicantID: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
        ApplicantName: 'Test Applicant',
        ApplicantOrg: 'Test Company',
        ClientOrgID: '7cc92559-c39f-449d-98b0-cc6057b34bcc',
        ClientOrgName: 'Test Company',
        Project: 'Manual - polygons',
        ActivityTy: undefined,
        SubActTy: undefined,
        ArticleNo: undefined,
        IAT_URL: undefined,
        ProjStartDate: '2026-10-01',
        ProjEndDate: '2026-11-01',
        Status: '',
        SubDate: '2025-10-29',
        PubConsent: '0',
        Exemptions_URL:
          'http://localhost:3000/exemption/view-public-details/690204a0af9bd9354c7d3578'
      },
      geometry: {
        rings: [
          [
            [-1.982385, 50.696698],
            [-1.980264, 50.69819],
            [-1.985637, 50.699503],
            [-1.988771, 50.698048],
            [-1.982385, 50.696698]
          ],
          [
            [-1.968705949257527, 51.58261074927972],
            [-1.9687792896329952, 51.580875440418716],
            [-1.968851527411761, 51.58075857203545],
            [-1.968705949257527, 51.58261074927972]
          ]
        ],
        spatialReference: {
          wkid: 4326
        }
      }
    }
  },
  {
    dbRecord: {
      _id: '6902090baf9bd9354c7d357b',
      projectName: 'File upload - shapefile',
      createdBy: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      createdAt: '2025-10-29T12:31:07.223Z',
      updatedBy: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      updatedAt: '2025-10-29T12:34:40.916Z',
      status: 'ACTIVE',
      contactId: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      mcmsContext: null,
      organisation: {
        id: '7cc92559-c39f-449d-98b0-cc6057b34bcc',
        name: 'Test Company',
        userRelationshipType: 'Employee'
      },
      multipleSiteDetails: {
        multipleSitesEnabled: true,
        sameActivityDates: 'yes',
        sameActivityDescription: 'yes'
      },
      siteDetails: [
        {
          coordinatesType: 'file',
          activityDates: {
            start: '2026-11-30T00:00:00.000Z',
            end: '2026-12-01T00:00:00.000Z'
          },
          activityDescription:
            'Collect a 0.1 cubic metre seabed sample by day grab from a workboat for particle size analysis',
          siteName: 'Site #1',
          fileUploadType: 'shapefile',
          geoJSON: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [1.6284157546554894, 52.23759846982049],
                    [1.6282675421984352, 52.23726687168712],
                    [1.6291517667282598, 52.23705819074145],
                    [1.6292970768352808, 52.23735417884111],
                    [1.628410678960097, 52.23759565116425]
                  ]
                }
              }
            ]
          },
          featureCount: 1,
          uploadedFile: {
            filename: 'Suffolk MMO shapefiles.zip'
          },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key:
              'exemptions/697ff02d-e5e7-4e42-ba47-c36fc116af47/45265950-72fb-4bb7-ab1c-2fb722ab15ec',
            checksumSha256: 'V3nR8yISvb6pfVp1g1eUdFo5Cer80JpGlqkGAJb/O8k='
          }
        },
        {
          coordinatesType: 'file',
          activityDates: {
            start: '2026-11-30T00:00:00.000Z',
            end: '2026-12-01T00:00:00.000Z'
          },
          activityDescription:
            'Collect a 0.1 cubic metre seabed sample by day grab from a workboat for particle size analysis',
          siteName: 'Site #7',
          fileUploadType: 'shapefile',
          geoJSON: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [1.333488427963183, 51.94626960763471],
                    [1.3342331961152953, 51.94592722722229],
                    [1.3292184782868377, 51.941654785539406],
                    [1.3278274707921998, 51.94029008157034],
                    [1.3271440894977846, 51.93977099053317],
                    [1.326272543567838, 51.94015558364375],
                    [1.3282124030004485, 51.94158806795781],
                    [1.328736668551831, 51.9420897820311],
                    [1.3293832189757593, 51.942630729901126],
                    [1.3315498017038332, 51.94458624398117],
                    [1.3335037245481494, 51.94626812274346]
                  ]
                }
              }
            ]
          },
          featureCount: 1,
          uploadedFile: {
            filename: 'Suffolk MMO shapefiles.zip'
          },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key:
              'exemptions/697ff02d-e5e7-4e42-ba47-c36fc116af47/45265950-72fb-4bb7-ab1c-2fb722ab15ec',
            checksumSha256: 'V3nR8yISvb6pfVp1g1eUdFo5Cer80JpGlqkGAJb/O8k='
          }
        }
      ],
      publicRegister: {
        reason: 'Private',
        consent: 'no'
      },
      applicationReference: 'EXE/2025/10160',
      submittedAt: '2025-10-29T12:34:40.947Z'
    },
    expected: {
      attributes: {
        CaseReference: 'EXE/2025/10160',
        ApplicationTy: 'Exemption notification',
        ApplicantID: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
        ApplicantName: 'Test Applicant',
        ApplicantOrg: 'Test Company',
        ClientOrgID: '7cc92559-c39f-449d-98b0-cc6057b34bcc',
        ClientOrgName: 'Test Company',
        Project: 'File upload - shapefile',
        ActivityTy: undefined,
        SubActTy: undefined,
        ArticleNo: undefined,
        IAT_URL: undefined,
        ProjStartDate: '2026-11-30',
        ProjEndDate: '2026-12-01',
        Status: '',
        SubDate: '2025-10-29',
        PubConsent: '1',
        Exemptions_URL:
          'http://localhost:3000/exemption/view-public-details/6902090baf9bd9354c7d357b'
      },
      geometry: {
        rings: [
          [
            [1.6284157546554894, 52.23759846982049],
            [1.6282675421984352, 52.23726687168712],
            [1.6291517667282598, 52.23705819074145],
            [1.6292970768352808, 52.23735417884111],
            [1.628410678960097, 52.23759565116425]
          ],
          [
            [1.333488427963183, 51.94626960763471],
            [1.3342331961152953, 51.94592722722229],
            [1.3292184782868377, 51.941654785539406],
            [1.3278274707921998, 51.94029008157034],
            [1.3271440894977846, 51.93977099053317],
            [1.326272543567838, 51.94015558364375],
            [1.3282124030004485, 51.94158806795781],
            [1.328736668551831, 51.9420897820311],
            [1.3293832189757593, 51.942630729901126],
            [1.3315498017038332, 51.94458624398117],
            [1.3335037245481494, 51.94626812274346]
          ]
        ],
        spatialReference: {
          wkid: 4326
        }
      }
    }
  },
  {
    dbRecord: {
      _id: '69020b36af9bd9354c7d357e',
      projectName: 'Manual - circles',
      createdBy: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      createdAt: '2025-10-29T12:40:22.472Z',
      updatedBy: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      updatedAt: '2025-10-29T12:43:05.167Z',
      status: 'ACTIVE',
      contactId: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
      mcmsContext: null,
      organisation: {
        id: '7cc92559-c39f-449d-98b0-cc6057b34bcc',
        name: 'Test Company',
        userRelationshipType: 'Employee'
      },
      multipleSiteDetails: {
        multipleSitesEnabled: true,
        sameActivityDates: 'no',
        sameActivityDescription: 'yes'
      },
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          siteName: 'Site #1',
          activityDates: {
            start: '2026-03-01T00:00:00.000Z',
            end: '2026-04-01T00:00:00.000Z'
          },
          activityDescription: 'Test desc',
          coordinatesEntry: 'single',
          coordinateSystem: 'wgs84',
          coordinates: {
            latitude: '55.019889',
            longitude: '-1.399500'
          },
          circleWidth: '50'
        },
        {
          coordinatesType: 'coordinates',
          siteName: 'Site #2',
          activityDates: {
            start: '2026-04-01T00:00:00.000Z',
            end: '2026-05-01T00:00:00.000Z'
          },
          activityDescription: 'Test desc',
          coordinatesEntry: 'single',
          coordinateSystem: 'osgb36',
          coordinates: {
            eastings: '438356',
            northings: '569035'
          },
          circleWidth: '150'
        }
      ],
      publicRegister: {
        reason: null,
        consent: 'yes'
      },
      applicationReference: 'EXE/2025/10161',
      submittedAt: '2025-10-29T12:43:05.192Z'
    },
    expected: {
      attributes: {
        CaseReference: 'EXE/2025/10161',
        ApplicationTy: 'Exemption notification',
        ApplicantID: '06b68b07-9296-4f7c-b74d-5fd59ef2a513',
        ApplicantName: 'Test Applicant',
        ApplicantOrg: 'Test Company',
        ClientOrgID: '7cc92559-c39f-449d-98b0-cc6057b34bcc',
        ClientOrgName: 'Test Company',
        Project: 'Manual - circles',
        ActivityTy: undefined,
        SubActTy: undefined,
        ArticleNo: undefined,
        IAT_URL: undefined,
        ProjStartDate: '2026-03-01',
        ProjEndDate: '2026-05-01',
        Status: '',
        SubDate: '2025-10-29',
        PubConsent: '0',
        Exemptions_URL:
          'http://localhost:3000/exemption/view-public-details/69020b36af9bd9354c7d357e'
      },
      geometry: {
        rings: [
          [
            [-1.3995, 55.020114],
            [-1.399459, 55.020112],
            [-1.399419, 55.020109],
            [-1.399379, 55.020103],
            [-1.399341, 55.020094],
            [-1.399305, 55.020083],
            [-1.39927, 55.020071],
            [-1.399238, 55.020056],
            [-1.39921, 55.020039],
            [-1.399184, 55.020021],
            [-1.399162, 55.020001],
            [-1.399143, 55.01998],
            [-1.399128, 55.019958],
            [-1.399118, 55.019936],
            [-1.399111, 55.019912],
            [-1.399109, 55.019889],
            [-1.399111, 55.019866],
            [-1.399118, 55.019842],
            [-1.399128, 55.01982],
            [-1.399143, 55.019798],
            [-1.399162, 55.019777],
            [-1.399184, 55.019757],
            [-1.39921, 55.019739],
            [-1.399238, 55.019722],
            [-1.39927, 55.019707],
            [-1.399305, 55.019695],
            [-1.399341, 55.019684],
            [-1.399379, 55.019675],
            [-1.399419, 55.019669],
            [-1.399459, 55.019666],
            [-1.3995, 55.019664],
            [-1.399541, 55.019666],
            [-1.399581, 55.019669],
            [-1.399621, 55.019675],
            [-1.399659, 55.019684],
            [-1.399695, 55.019695],
            [-1.39973, 55.019707],
            [-1.399762, 55.019722],
            [-1.39979, 55.019739],
            [-1.399816, 55.019757],
            [-1.399838, 55.019777],
            [-1.399857, 55.019798],
            [-1.399872, 55.01982],
            [-1.399882, 55.019842],
            [-1.399889, 55.019866],
            [-1.399891, 55.019889],
            [-1.399889, 55.019912],
            [-1.399882, 55.019936],
            [-1.399872, 55.019958],
            [-1.399857, 55.01998],
            [-1.399838, 55.020001],
            [-1.399816, 55.020021],
            [-1.39979, 55.020039],
            [-1.399762, 55.020056],
            [-1.39973, 55.020071],
            [-1.399695, 55.020083],
            [-1.399659, 55.020094],
            [-1.399621, 55.020103],
            [-1.399581, 55.020109],
            [-1.399541, 55.020112],
            [-1.3995, 55.020114]
          ],
          [
            [-1.401726, 55.015069],
            [-1.401603, 55.015065],
            [-1.401482, 55.015054],
            [-1.401363, 55.015036],
            [-1.401249, 55.015011],
            [-1.401139, 55.014979],
            [-1.401036, 55.01494],
            [-1.400941, 55.014896],
            [-1.400854, 55.014846],
            [-1.400777, 55.014791],
            [-1.40071, 55.014732],
            [-1.400655, 55.014669],
            [-1.400611, 55.014603],
            [-1.400579, 55.014535],
            [-1.40056, 55.014466],
            [-1.400553, 55.014395],
            [-1.40056, 55.014325],
            [-1.400579, 55.014255],
            [-1.400611, 55.014187],
            [-1.400655, 55.014121],
            [-1.40071, 55.014058],
            [-1.400777, 55.013999],
            [-1.400854, 55.013944],
            [-1.400941, 55.013894],
            [-1.401036, 55.01385],
            [-1.401139, 55.013812],
            [-1.401249, 55.01378],
            [-1.401363, 55.013754],
            [-1.401482, 55.013736],
            [-1.401603, 55.013725],
            [-1.401726, 55.013721],
            [-1.401848, 55.013725],
            [-1.401969, 55.013736],
            [-1.402088, 55.013754],
            [-1.402202, 55.01378],
            [-1.402312, 55.013812],
            [-1.402415, 55.01385],
            [-1.40251, 55.013894],
            [-1.402597, 55.013944],
            [-1.402674, 55.013999],
            [-1.402741, 55.014058],
            [-1.402797, 55.014121],
            [-1.402841, 55.014187],
            [-1.402872, 55.014255],
            [-1.402892, 55.014325],
            [-1.402898, 55.014395],
            [-1.402892, 55.014466],
            [-1.402872, 55.014535],
            [-1.402841, 55.014603],
            [-1.402797, 55.014669],
            [-1.402741, 55.014732],
            [-1.402674, 55.014791],
            [-1.402597, 55.014846],
            [-1.40251, 55.014896],
            [-1.402415, 55.01494],
            [-1.402312, 55.014979],
            [-1.402202, 55.015011],
            [-1.402088, 55.015036],
            [-1.401969, 55.015054],
            [-1.401848, 55.015065],
            [-1.401726, 55.015069]
          ]
        ],
        spatialReference: {
          wkid: 4326
        }
      }
    }
  }
]
