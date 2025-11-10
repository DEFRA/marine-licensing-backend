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
        rings: [
          [
            [-118.2, 34.1],
            [-118.4, 34.3],
            [-118.2, 34.1]
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
            [-118.2, 34.1],
            [-118.4, 34.3],
            [-118.2, 34.1]
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
        rings: [
          [
            [-118.2, 34.1],
            [-118.4, 34.3],
            [-118.2, 34.1]
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
          circleWidth: '5'
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
            eastings: '402556',
            northings: '186891'
          },
          circleWidth: '1'
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
            [-118.2, 34.1],
            [-118.4, 34.3],
            [-118.2, 34.1]
          ]
        ],
        spatialReference: {
          wkid: 4258
        }
      }
    }
  }
]
