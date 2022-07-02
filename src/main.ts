import * as core from '@actions/core';
const axios = require('axios').default;

const DONATION_New = 'XRPDonation:New';
const DONATION_Fund = 'XRPDonation:Funding';
const DONATION_Done = 'XRPDonation:Done';

const GRAPHQL_URL = process.env.GITHUB_GRAPHQL_URL || 'https://api.github.com/graphql';
const address: string = core.getInput('address');
const network: string = core.getInput('network');
const prNumber: string = core.getInput('pr-number');
const token: string = core.getInput('repo-token');
const repo: string = process.env.GITHUB_REPOSITORY || '';
const [owner, name] = repo.split('/');
core.debug(`processing for: ${owner} / ${name} / ${prNumber}`);

interface Label {
  id: string,
  name: string
};

interface QueryResponse {
  prId: string,
  target?: number,
  prLabels?:  Array<Label>,
  xrpLabels?: Array<Label>,
}

async function run(): Promise<void> {
  try {
    const query = await githubQuery();

    const intersect = [DONATION_New, DONATION_Fund, DONATION_Done]
      .filter(value => query.prLabels?.map(o => o.name).includes(value));
    if (intersect.length > 0) {
      core.setOutput('status', `no change`);
      return; // done deal, no need to do anything
    }

    const labelNew = query.xrpLabels?.find(o => o.name === DONATION_New);
    if (labelNew == null)
      throw new Error("XRPDonation labels not set!");

    const labelIds = query.prLabels?.map(o => o.id) || [];
    labelIds.push(labelNew.id);

    await githubMutation(query.prId, labelIds);
    core.setOutput('status', `success`);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
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
      }
      labels(query: "XRPDonation", first: 10) {
        nodes { id name }
      }
    }
  }`;
  const response_query = await axios.post(GRAPHQL_URL, { query }, { headers });
  // core.debug(`response: ${JSON.stringify(response_query)}`);

  const pullRequest = response_query.data.data.repository.pullRequest;
  const xrpLabels = response_query.data.data.repository.labels.nodes;
  const prId = pullRequest.id;
  const prBody = pullRequest.bodyText;
  const prLabels = pullRequest.labels.edges.map((o: any) => o.node);

  const regex = /XRPDonationTarget: (\d+.?\d*)/;
  const exec = regex.exec(prBody);
  if (exec == null)
    return { prId };

  const target = parseFloat(exec[1]);
  return { prId, target, prLabels, xrpLabels };
}

async function githubMutation(prId: string, labelIds: Array<string>): Promise<void> {
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

run()
