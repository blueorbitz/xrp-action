import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    const address: string = core.getInput('address');
    const network: string = core.getInput('network');
    core.debug(`processing for: ${network}: ${address}`);

    core.setOutput('status', 'success');
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
