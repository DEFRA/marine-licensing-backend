export const testExemptions = [
  {
    dbRecord: {
      _id: {
        $oid: '69020200af9bd9354c7d3575'
      },
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
        Status: 'Closed',
        SubDate: '2025-10-29',
        PubConsent: '0'
      },
      geometry: {
        rings: [],
        spatialReference: {
          wkid: 4258
        }
      }
    }
  },
  {
    dbRecord: {
      _id: {
        $oid: '690204a0af9bd9354c7d3578'
      },
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
        Status: 'Closed',
        SubDate: '2025-10-29',
        PubConsent: '0'
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
          wkid: 4258
        }
      }
    }
  },
  {
    dbRecord: {
      _id: {
        $oid: '6902090baf9bd9354c7d357b'
      },
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
          siteName: 'Site #2',
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
                    [1.6096117990976233, 52.1678686825681],
                    [1.6095341380163704, 52.16774611724207],
                    [1.609885246126368, 52.167660989220245],
                    [1.609958803416291, 52.16779260465744],
                    [1.609610012974624, 52.16787052220535]
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
          siteName: 'Site #3',
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
                    [1.3890194762820705, 51.98086171066518],
                    [1.3829332112719828, 51.97630106775375],
                    [1.3838622751776053, 51.97584598445269],
                    [1.3900312485502069, 51.980225711300136],
                    [1.3890002484365713, 51.98086226453486]
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
          siteName: 'Site #4',
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
                    [1.391423403021677, 51.989591765757694],
                    [1.3890954800560156, 51.983780730341756],
                    [1.3899536102544048, 51.98366081609864],
                    [1.3923795902861513, 51.98949280664955],
                    [1.39138314421904, 51.98956912813729]
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
          siteName: 'Site #5',
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
                    [1.5986630013109462, 52.139913908062084],
                    [1.5993826166929939, 52.13984432440361],
                    [1.5982812122473182, 52.13626053461891],
                    [1.5970292666649013, 52.13392482711445],
                    [1.596122911819585, 52.13203668656392],
                    [1.5954197284300085, 52.13074921100251],
                    [1.5947021646949484, 52.13084250849524],
                    [1.5953911477644915, 52.13243385792204],
                    [1.5960261666519364, 52.13365499277757],
                    [1.5966655656639208, 52.13487004099598],
                    [1.5974666719923802, 52.136291363137516],
                    [1.5980262845373028, 52.13759511231342],
                    [1.5986673453781755, 52.139907825621364]
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
          siteName: 'Site #6',
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
                    [1.6862076675903137, 52.33366242654051],
                    [1.6874059045554368, 52.333589290059535],
                    [1.6877342552798311, 52.337065589744],
                    [1.6865493718292195, 52.337066914066],
                    [1.6862464160782153, 52.333661216067824]
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
        Status: 'Closed',
        SubDate: '2025-10-29',
        PubConsent: '1'
      },
      geometry: {
        rings: [],
        spatialReference: {
          wkid: 4258
        }
      }
    }
  },
  {
    dbRecord: {
      _id: {
        $oid: '69020b36af9bd9354c7d357e'
      },
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
        Status: 'Closed',
        SubDate: '2025-10-29',
        PubConsent: '0'
      },
      geometry: {
        rings: [
          [
            [-1.3995, 55.02011356992924],
            [-1.3994591443843456, 55.02011233970484],
            [-1.399418736398802, 55.02010866251045],
            [-1.3993792187688252, 55.02010257863484],
            [-1.3993410244643139, 55.020094154735304],
            [-1.399304571955616, 55.02008348310726],
            [-1.3992702606284388, 55.02007068067304],
            [-1.3992384664079025, 55.02005588770073],
            [-1.3992095376396951, 55.02003926626731],
            [-1.399183791273455, 55.02002099848283],
            [-1.3991615093902054, 55.020001284495045],
            [-1.399142936111885, 55.01998034029647],
            [-1.3991282749268272, 55.01995839535785],
            [-1.3991176864604922, 55.01993569011397],
            [-1.399111286715862, 55.01991247332928],
            [-1.3991091458027696, 55.0198889993724],
            [-1.399111287170071, 55.01986552542915],
            [-1.3991176873490594, 55.01984230868473],
            [-1.3991282762109176, 55.01981960350601],
            [-1.399142937735378, 55.019797658654596],
            [-1.3991615112821465, 55.01977671456147],
            [-1.399183793351157, 55.01975700069274],
            [-1.399209539812353, 55.019738733035744],
            [-1.3992384685805603, 55.019722111732676],
            [-1.3992702627061409, 55.019707318887846],
            [-1.3993045738475571, 55.01969451657268],
            [-1.399341026087807, 55.01968384505008],
            [-1.399379220052916, 55.019675421237764],
            [-1.3994187372873692, 55.01966933742732],
            [-1.399459144838555, 55.019665660273205],
            [-1.3995, 55.01966443006242],
            [-1.399540855161445, 55.019665660273205],
            [-1.3995812627126307, 55.019669337427324],
            [-1.3996207799470837, 55.01967542123775],
            [-1.3996589739121927, 55.01968384505008],
            [-1.3996954261524426, 55.01969451657268],
            [-1.3997297372938589, 55.019707318887846],
            [-1.3997615314194394, 55.019722111732676],
            [-1.3997904601876467, 55.019738733035744],
            [-1.3998162066488427, 55.01975700069274],
            [-1.3998384887178532, 55.019776714561466],
            [-1.3998570622646218, 55.019797658654596],
            [-1.399871723789082, 55.01981960350601],
            [-1.3998823126509403, 55.01984230868473],
            [-1.3998887128299287, 55.01986552542915],
            [-1.3998908541972301, 55.0198889993724],
            [-1.3998887132841378, 55.01991247332928],
            [-1.3998823135395075, 55.01993569011397],
            [-1.3998717250731725, 55.01995839535785],
            [-1.3998570638881147, 55.01998034029647],
            [-1.3998384906097943, 55.020001284495045],
            [-1.3998162087265449, 55.02002099848283],
            [-1.3997904623603046, 55.02003926626731],
            [-1.3997615335920972, 55.02005588770073],
            [-1.3997297393715609, 55.02007068067304],
            [-1.3996954280443836, 55.020083483107264],
            [-1.3996589755356859, 55.020094154735304],
            [-1.3996207812311745, 55.020102578634834],
            [-1.3995812636011977, 55.02010866251045],
            [-1.3995408556156541, 55.02011233970484],
            [-1.3995, 55.02011356992924],
            [-1.3995, 55.02011356992924]
          ],
          [
            [-1.401725560044382, 55.015068843390814],
            [-1.4016030085920246, 55.01506515267341],
            [-1.4014817999059368, 55.01505412095943],
            [-1.4013632620378351, 55.01503586912058],
            [-1.4012486937716728, 55.01501059713745],
            [-1.401139350391344, 55.014978581908],
            [-1.4010364299253475, 55.01494017421334],
            [-1.4009410600192058, 55.01489579487374],
            [-1.4008542855795527, 55.01484593013731],
            [-1.4007770573253069, 55.014791126351746],
            [-1.4007102213713984, 55.014731983977555],
            [-1.4006545099591674, 55.014669151008505],
            [-1.4006105334349706, 55.014603315871284],
            [-1.4005787735648254, 55.0145351998823],
            [-1.4005595782582616, 55.01446554934417],
            [-1.4005531577590962, 55.0143951273687],
            [-1.400559582344752, 55.014324705515826],
            [-1.4005787815592072, 55.014255055340094],
            [-1.400610544987851, 55.014186939937474],
            [-1.4006545245656299, 55.01412110558499],
            [-1.4007102383930705, 55.014058273564714],
            [-1.4007770760182596, 55.01399913226188],
            [-1.4008543051268147, 55.01394432962344],
            [-1.4009410795664676, 55.01389446605977],
            [-1.4010364486183002, 55.0138500878673],
            [-1.401139367413016, 55.01381168124399],
            [-1.401248708378135, 55.01377966696334],
            [-1.401363273590715, 55.01375439576492],
            [-1.4014818079003184, 55.01373614451245],
            [-1.401603012678515, 55.01372511316087],
            [-1.401725560044382, 55.013721422566036],
            [-1.4018481074102491, 55.01372511316087],
            [-1.4019693121884458, 55.01373614451245],
            [-1.402087846498049, 55.01375439576491],
            [-1.4022024117106293, 55.01377966696333],
            [-1.4023117526757483, 55.01381168124399],
            [-1.402414671470464, 55.0138500878673],
            [-1.4025100405222966, 55.01389446605976],
            [-1.4025968149619497, 55.01394432962344],
            [-1.4026740440705046, 55.01399913226188],
            [-1.4027408816956939, 55.014058273564714],
            [-1.4027965955231345, 55.014121105584984],
            [-1.4028405751009134, 55.01418693993748],
            [-1.4028723385295572, 55.014255055340094],
            [-1.402891537744012, 55.014324705515826],
            [-1.402897962329668, 55.0143951273687],
            [-1.4028915418305028, 55.01446554934417],
            [-1.402872346523939, 55.0145351998823],
            [-1.4028405866537936, 55.014603315871284],
            [-1.402796610129597, 55.014669151008505],
            [-1.402740898717366, 55.014731983977555],
            [-1.4026740627634573, 55.014791126351746],
            [-1.4025968345092115, 55.01484593013731],
            [-1.4025100600695586, 55.014895794873745],
            [-1.4024146901634167, 55.014940174213336],
            [-1.40231176969742, 55.014978581908],
            [-1.4022024263170914, 55.01501059713745],
            [-1.402087858050929, 55.01503586912058],
            [-1.4019693201828274, 55.01505412095942],
            [-1.4018481114967398, 55.01506515267341],
            [-1.401725560044382, 55.015068843390814],
            [-1.401725560044382, 55.015068843390814]
          ]
        ],
        spatialReference: {
          wkid: 4258
        }
      }
    }
  }
]
