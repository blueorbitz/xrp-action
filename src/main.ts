import * as core from '@actions/core';
const axios = require('axios').default;

const DEBUG = false;
const log = {
  setOutput: DEBUG ? console.log : core.setOutput,
  setFailed: DEBUG ? console.error : core.setFailed,
  debug: DEBUG ? console.log : core.debug,
};

const DONATION_New = 'XRPDonation:New';
const DONATION_Fund = 'XRPDonation:Funding';
const DONATION_Done = 'XRPDonation:Done';

const GRAPHQL_URL = process.env.GITHUB_GRAPHQL_URL || 'https://api.github.com/graphql';
const XRP_DONATION_URL = process.env.XRP_DONATION_URL || 'http://localhost:/3000';
const address: string = !DEBUG ? core.getInput('address') : (process.env.XRP_ADDRESS || 'rwyZN9Kp7AyjtLSTv9DWzbuUtXEPj9zodP');
const network: string = !DEBUG ? core.getInput('network') : 'testnet';
const prNumber: string = !DEBUG ? core.getInput('pr-number') : '11';
const token: string = !DEBUG ? core.getInput('repo-token') : (process.env.GITHUB_TOKEN || '');
const repo: string = process.env.GITHUB_REPOSITORY || 'blueorbitz/xrp-donation-action';
const [owner, name] = repo.split('/');
log.debug(`processing for: ${owner} / ${name} / ${prNumber}`);

interface Label {
  id: string,
  name: string
};

interface QueryResponse {
  prId: string,
  target?: number,
  prLabels?: Array<Label>,
  prComments?: Array<{ body: string }>
  xrpLabels?: Array<Label>,
}

async function run(): Promise<void> {
  try {
    const { prId, target, prLabels, prComments, xrpLabels } = await githubQuery();

    // nested functions
    const labelsIn = (search: string): Boolean =>
      (prLabels ?? []).map(o => o.name).indexOf(search) !== -1;
    const intersects = (a: Array<string>, b: Array<string>): Array<string> =>
      a.filter(value => b.includes(value));
    const labelIdsWithXrpState = (status: string): Array<string> => {
      const statusLabel = xrpLabels?.find(o => o.name === status);
      const newList: Array<Label> = (prLabels ?? [])
        .filter((value: Label) => value.name !== DONATION_New)
        .filter((value: Label) => value.name !== DONATION_Fund)
        .filter((value: Label) => value.name !== DONATION_Done);
      
      statusLabel && newList.push(statusLabel);
      return newList.map(o => o.id);
    }

    // validated labels
    if (target == null) {
      log.setOutput('status', 'XRPDonationTarget - not found');
      return;
    }

    validateXrpLabelsExist(xrpLabels ?? []);

    // update logic start here
    const insertedXrpLabels = intersects([DONATION_New, DONATION_Fund, DONATION_Done], prLabels?.map(o => o.name) ?? []);
    if (insertedXrpLabels.length === 0) { // No label in the list
      await githubMutationLabels(prId, labelIdsWithXrpState(DONATION_New));
      const donationUrl = `${XRP_DONATION_URL}/${repo}/${prNumber}?addres=${address}&network=${network}&target=${target}`;
      await githubMutationComment(prId, `<strong>XRPDonation</strong> link - <a href=\\"${donationUrl}\\">XRP OSS Donation Page</a>`);
      log.setOutput('status', DONATION_New + ' - added');
      return;
    }

    if ((prComments?.length ?? 0) === 0) { // No comment, nothing to update
      log.setOutput('status', DONATION_New + ' - no comment');
      return;
    }

    let lastComment: string = '';
    if (prComments?.length) lastComment = prComments[0].body;
    log.debug('last comment', lastComment);
    const isTargetAchieved = /XRPDonation:Achieved/.exec(lastComment) != null;
    const isFundingAdded = /XRPDonation:Funded/.exec(lastComment) != null;
    log.debug('isTargetAchieved', isTargetAchieved, 'isFundingAdded', isFundingAdded);

    if (isFundingAdded && labelsIn(DONATION_New)) { // Transition fund
      await githubMutationLabels(prId, labelIdsWithXrpState(DONATION_Fund));
      log.setOutput('status', DONATION_Fund + ' - updated');
      return;
    }

    if (isFundingAdded) { // Adding more fund
      log.setOutput('status', DONATION_Fund + ' - no change');
      return;
    }

    if (isTargetAchieved && !labelsIn(DONATION_Done)) { // Transition to done
      await githubMutationLabels(prId, labelIdsWithXrpState(DONATION_Done));
      log.setOutput('status', DONATION_Done + ' - updated');
      return;
    }

    log.setOutput('status', 'No action');
  } catch (error) {
    if (error instanceof Error) log.setFailed(error.message)
  }
}

async function githubQuery(): Promise<QueryResponse> {
  const headers = {
    'content-type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  const query = `query {
    repository(name: "${name}", owner: "${owner}") {
      pullRequest(number: ${prNumber}) {
        id
        bodyText
        labels(first: 10) {
          edges {
            node { id name }
          }
        }
        comments(last: 1) {
          nodes { body }
        }
      }
      labels(query: "XRPDonation", first: 10) {
        nodes { id name }
      }
    }
  }`;
  const response_query = await axios.post(GRAPHQL_URL, { query }, { headers });
  log.debug(`response: ${JSON.stringify(response_query.data)}`);

  const pullRequest = response_query.data.data.repository.pullRequest;
  const xrpLabels = response_query.data.data.repository.labels.nodes;
  const prId = pullRequest.id;
  const prBody = pullRequest.bodyText;
  const prLabels = pullRequest.labels.edges.map((o: any) => o.node);
  const prComments = pullRequest.comments.nodes;

  const regex = /XRPDonationTarget: (\d+.?\d*)/;
  const exec = regex.exec(prBody);
  if (exec == null)
    return { prId };

  const target = parseFloat(exec[1]);
  return { prId, target, prLabels, prComments, xrpLabels };
}

async function githubMutationLabels(prId: string, labelIds: Array<string>): Promise<void> {
  const headers = {
    'content-type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  const query = `mutation {
    updatePullRequest(
      input: {pullRequestId: "${prId}", labelIds: [${labelIds.map(o => `"${o}"`).join(',')}]}
    ) {
      pullRequest {
        labels(first: 10) {
          nodes { id name }
        }
      }
    }
  }`

  await axios.post(GRAPHQL_URL, { query }, { headers });
}

async function githubMutationComment(prId: string, comment: string): Promise<void> {
  const headers = {
    'content-type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  const query = `mutation {
    addComment(input: {subjectId: "${prId}", body: "${comment}"}) {
      subject { id }
    }
  }`

  await axios.post(GRAPHQL_URL, { query }, { headers });
}

function validateXrpLabelsExist(xrpLabels: Array<Label>) {
  const labelNew = xrpLabels?.find(o => o.name === DONATION_New);
  if (labelNew == null)
    throw new Error(DONATION_New + " label not set!");

  const labelFund = xrpLabels?.find(o => o.name === DONATION_Fund);
  if (labelFund == null)
    throw new Error(DONATION_Fund + " label not set!");

  const labelDone = xrpLabels?.find(o => o.name === DONATION_Done);
  if (labelDone == null)
    throw new Error(DONATION_Done + " label not set!");
}

run()
