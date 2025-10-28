# marine-licensing-backend

The Marine Licensing Backend is part of a GDS-compliant replacement of the Marine Case Management System (MCMS).

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

## Requirements

### Node.js

For latest minimum versions of Node.js and NPM, see the [package.json](./package.json) 'engines' property.

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

Under the index.js files in ./src/api/\*

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

### Docker Compose

A local environment with:

- Localstack for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out frontend example.

```bash
docker compose up --build -d
```

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
