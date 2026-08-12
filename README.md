# marine-licensing-backend

The Marine Licensing Backend is part of a GDS-compliant replacement of the Marine Case Management System (MCMS).

- [Directory structure](#directory-structure)
- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Local development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Dependency updates](#dependency-updates)
  - [Authentication](#authentication)
- [API endpoints](#api-endpoints)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Releases

### [8.0.0](https://eaflood.atlassian.net/projects/ML/versions/40904/tab/release-report-all-issues)

Details available on the release version ticket

### [7.0.0](https://eaflood.atlassian.net/projects/ML/versions/36894/tab/release-report-all-issues)

Details available on the release version ticket

### [6.0.0](https://eaflood.atlassian.net/projects/ML/versions/33941/tab/release-report-all-issues)

Details available on the release version ticket

### [5.0.0](https://eaflood.atlassian.net/projects/ML/versions/32612/tab/release-report-all-issues)

Details available on the release version ticket

### [4.0.0](https://eaflood.atlassian.net/projects/ML/versions/29700/tab/release-report-all-issues)

Details available on the release version ticket

### [3.0.0](https://eaflood.atlassian.net/projects/ML/versions/29059/tab/release-report-all-issues)

### [2.0.0](https://eaflood.atlassian.net/projects/ML/versions/23737/tab/release-report-all-issues)

Release of the marine licensing backend that will be accessed by marine licensing frontend which will be used by the public. The link lists all the features within the application.

### [1.0.0](https://eaflood.atlassian.net/projects/ML/versions/23736/tab/release-report-all-issues)

Initial release of the marine licensing backend platform.

## Directory structure

The source code under `src/` is split into domain-aligned folders:

| Folder            | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `exemptions`      | All API routes, models, and business logic for marine exemptions                  |
| `marine-licences` | All API routes, models, and business logic for marine licences                    |
| `shared`          | Shared logic across both domains — config, helpers, plugins, routes, and services |

## Requirements

### Node.js

Please install Node.js `>= v24` and npm `>= v11`. For the exact version used by this application, see [.nvmrc](./.nvmrc). Minimum engine versions are also defined in [package.json](./package.json).

- [Node.js](http://nodejs.org/)
- [npm](https://nodejs.org/)
- [Docker](https://www.docker.com/)

You may find it easier to manage Node.js versions using a version manager such
as [nvm](https://github.com/creationix/nvm) or [n](https://www.npmjs.com/package/n). From within the project folder you
can then either run `nvm use` or `n auto` to install the required version.

## Local development

### Setup

Install application dependencies:

```bash
npm install
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json).
To view them in your command line run:

```bash
npm run
```

### Dependency updates

Dependabot automatically creates pull requests to update dependencies.

### Authentication

For authentication when running locally, there are 2 options. Whichever you use it has to match the option used by
marine-licensing-frontend, so that auth tokens sent with requests to the backend are correctly validated:

#### Defra ID stub

The out-of-the-box config will use the [cdp-defra-id-stub](https://github.com/DEFRA/cdp-defra-id-stub).

#### Real Defra ID and Entra ID

To set this up and run
it, [instructions are in marine-licensing-frontend](https://github.com/DEFRA/marine-licensing-frontend/blob/main/local-https-setup/README.md#local-https-development-setup).
The .env.template file referred to by the instructions is in the root of this repo.

### Environment variables

For most local development, you shouldn't need to override any of the env var defaults that are
in [config.js](./src/config/config.js).

## API endpoints

API routes are defined under the `api` folders in each domain:

- `src/exemptions/api/`
- `src/marine-licences/api/`
- `src/shared/api/geo-parser/`

## Docker

### Development image

Build:

```bash
docker build --target development --no-cache --tag marine-licensing-backend:development .
```

Run:

```bash
docker run -e PORT=3001 -p 3001:3001 marine-licensing-backend:development
```

Note - the development image uses the source files directly using volumes, and will automatically rebuild to reflect any
changes.

### Production image

Build:

```bash
docker build --no-cache --tag marine-licensing-backend .
```

Run:

```bash
docker run -e PORT=3001 -p 3001:3001 marine-licensing-backend
```

### Migrations

Database migrations are automatically applied to `mongo` on application start.

```shell
npm run migrate:status
npm run migrate:up
npm run migrate:down
```

See [migrations/README.md](migrations/README.md) for full details

### Docker Compose

A local environment with:

- Localstack for AWS services (S3, SQS)
- Redis
- MongoDB
- [marine-licensing-api-stub](https://github.com/DEFRA/marine-licensing-api-stub) (must be
  checked out as a sibling directory) — stubs the ArcGIS marine-plan-policy lookup and the
  Dynamics contact details API. Policy _wording_ still comes from the real GOV.UK
  marine-plans-explorer API.
- This service.
- A commented out frontend example.

```bash
docker compose up --build -d
```

#### Switching to the real ArcGIS API

By default the backend's marine-plan-policy lookup is pointed at the local stub. To hit the real
DEFRA ArcGIS FeatureServer instead, uncomment `ARCGIS_FEATURE_SERVER_URL` in your local `.env`
(see `.env.template`), then recreate the backend container:

```bash
docker compose up -d marine-licensing-backend
```

Remove/blank the line and recreate again to switch back to the stub.

#### Dynamics contact details

The "who is the exemption for" value comes from the Dynamics contacts API. There are no
Dynamics credentials locally, so `docker compose up` runs with `DYNAMICS_ENABLED=true` and
points the token endpoint and both contact details endpoints at the stub — the real code
path (token fetch → contacts GET → `fullname`) runs end to end against fake data.

The stub is seeded with the same five test users as the local CDP defra-id stub
(Sally Self, Jason Bourne, John Doe, John Silver), so the name shown is the name of the user
you logged in as. They are keyed on the registration's `contactId` — the value stored on
exemptions and sent to Dynamics — rather than the `userId` you type on the defra-id stub
login page, though the `userId` is accepted as an alias. Any other valid GUID resolves to a
placeholder named after itself (`Test User 3fa85f64`), so pre-existing seeded exemptions
still show something.

Under docker compose these values come from [compose/dynamics-stub.env](compose/dynamics-stub.env)
rather than your local `.env` — compose's `env_file` wins over the `.env` the container loads
itself. To hit real Dynamics, replace the values in that file with the commented-out
`DYNAMICS_*` values from `.env.template` and recreate the backend container. When running the
backend outside docker (`npm run dev`), your local `.env` is what counts.

Note that `DYNAMICS_ENABLED` also switches on the exemption submission queue poller. With no
`DYNAMICS_API_URL` configured it will log a failed submission roughly every five minutes if
anything is sitting in `exemption-dynamics-queue`; that is expected locally and does not
affect contact lookups. Set `DYNAMICS_ENABLED=false` in your `.env` to silence it (contact
names then fall back to empty).

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
