# XRP Donation Action

This is the Github custom action implementation for listening to Github action workflow related to XRP Donation and to provide the related updates base on the donation interaction on Xumm Wallet.

For more information refer to the sister projec: [XRP-Donation-App](https://github.com/blueorbitz/xrp-donation-app).

<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

## How to use

Make sure to have the following labels configure in your repository:
- XRPDonation:New
- XRPDonation:Funding
- XRPDonation:Done

PS: *this is due to github does not support create label api at the moment*

Create a github action yml. It should listed to the following:
```
on:
  pull_request:
    types: [opened, reopened, 'edited', 'closed']
  issue_comment:
    types: [created]
```

Provide the include this into the steps:
```
  uses: blueorbitz/xrp-donation-action@latest
  with:
    address: ${{ secrets.XRP_OWNER_ADDRESS }}
    network: testnet // or mainnet
    pr-number: ${{ github.event.number || github.event.issue.number }}
    repo-token: ${{ secrets.GITHUB_TOKEN }}
  env:
    XRP_DONATION_URL: https://xrp-donation-app.vercel.app
```

Refer to workflow `pr-labeling.yml` for example.

## How it workflows

1. When PR is created, include the following detail as part of the PR message: `XRPDonationTarget: {amount of XRP}`
1. The custom action will pickup the content and decode the message accordingly.
1. A Pull Request comment will be added for contributor to click on the link and send donation through it.
1. When the payment is received, we used the comment section to triggers the workflow for the update.
1. Pull Request label will be updated accordingly based on the status of the Donation target.

## Quick deveploment tips
Run using normal Node JS for quick development:

Edit `const DEBUG = false;` to `true`, and run the following 2 command in separate console.
```
npx tsc -w  src/main.ts
nodemon src/main.js
```

## Forked project from 
https://github.com/actions/typescript-action

## Create an action from this template

Click the `Use this Template` and provide the new repo details for your action

## Code in Main

> First, you'll need to have a reasonably modern version of `node` handy. This won't work with versions older than 9, for instance.

Install the dependencies  
```bash
$ npm install
```

Build the typescript and package it for distribution
```bash
$ npm run build && npm run package
```

Run the tests :heavy_check_mark:  
```bash
$ npm test

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)

...
```

## Change action.yml

The action.yml defines the inputs and output for your action.

Update the action.yml with your name, description, inputs and outputs for your action.

See the [documentation](https://help.github.com/en/articles/metadata-syntax-for-github-actions)

## Change the Code

Most toolkit and CI/CD operations involve async operations so the action is run in an async function.

```javascript
import * as core from '@actions/core';
...

async function run() {
  try { 
      ...
  } 
  catch (error) {
    core.setFailed(error.message);
  }
}

run()
```

See the [toolkit documentation](https://github.com/actions/toolkit/blob/master/README.md#packages) for the various packages.

## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed dist folder. 

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ npm run package
$ git add dist
$ git commit -a -m "prod dependencies"
$ git push origin releases/v1
```

Note: We recommend using the `--license` option for ncc, which will create a license file for all of the production node modules used in your project.

Your action is now published! :rocket: 

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

## Validate

You can now validate the action by referencing `./` in a workflow in your repo (see [test.yml](.github/workflows/test.yml))

```yaml
uses: ./
with:
  milliseconds: 1000
```

See the [actions tab](https://github.com/actions/typescript-action/actions) for runs of this action! :rocket:

## Usage:

After testing you can [create a v1 tag](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md) to reference the stable and latest V1 action
